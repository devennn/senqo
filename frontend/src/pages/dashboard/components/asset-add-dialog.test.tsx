import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/api";
import { AssetAddDialog } from "./asset-add-dialog";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    postForm: vi.fn(),
  },
}));

const onAdded = vi.fn();
const onOpenChange = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  onAdded.mockResolvedValue(undefined);
  vi.mocked(api.get).mockResolvedValue({ composioConfigured: false, apps: [] } as never);
  vi.mocked(api.post).mockResolvedValue({} as never);
  vi.mocked(api.postForm).mockResolvedValue({} as never);
});

function renderDialog() {
  render(
    <AssetAddDialog groupId="group-1" open onOpenChange={onOpenChange} onAdded={onAdded} />,
  );
}

describe("AssetAddDialog", () => {
  // Uploads get an AI-drafted description and are saved as sendable files with kind=file.
  it("drafts a description for an uploaded file and adds a sendable file", async () => {
    const user = userEvent.setup();
    vi.mocked(api.postForm).mockImplementation((async (path: string) => {
      if (String(path).endsWith("/summarize")) return { description: "AI menu description" };
      return {};
    }) as never);
    renderDialog();

    expect(screen.getByRole("radio", { name: /sendable file/i })).toBeChecked();

    await user.upload(
      screen.getByLabelText("File"),
      new File(["%PDF"], "menu.pdf", { type: "application/pdf" }),
    );

    await screen.findByDisplayValue("AI menu description");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
    const createCall = vi
      .mocked(api.postForm)
      .mock.calls.find(([path]) => String(path).endsWith("/assets"));
    expect(createCall).toBeDefined();
    const body = createCall?.[1] as FormData;
    expect(body.get("kind")).toBe("file");
    expect(body.get("description")).toBe("AI menu description");
    expect((body.get("file") as File).name).toBe("menu.pdf");
  });

  // Choosing the Reference kind uploads the file as a doc the agent re-reads at chat time.
  it("adds an uploaded reference when the Reference kind is chosen", async () => {
    const user = userEvent.setup();
    vi.mocked(api.postForm).mockImplementation((async (path: string) => {
      if (String(path).endsWith("/summarize")) return { description: "AI doc description" };
      return {};
    }) as never);
    renderDialog();

    await user.click(screen.getByRole("radio", { name: /reference/i }));
    await user.upload(
      screen.getByLabelText(/Document/),
      new File(["# Notes"], "notes.md", { type: "text/markdown" }),
    );

    await screen.findByDisplayValue("AI doc description");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
    const createCall = vi
      .mocked(api.postForm)
      .mock.calls.find(([path]) => String(path).endsWith("/assets"));
    expect((createCall?.[1] as FormData).get("kind")).toBe("doc");
  });

  // Picking a Drive file drafts from live content and saves it as a google_drive reference.
  it("adds a reference from a Google Drive pick", async () => {
    const user = userEvent.setup();
    vi.mocked(api.get).mockImplementation((async (path: string) => {
      if (String(path).endsWith("/api/user/apps")) {
        return {
          composioConfigured: true,
          apps: [
            {
              toolkit: "googledrive",
              displayName: "Google Drive",
              status: "active",
              connectedAt: null,
              accessLabel: "Entire Drive",
            },
          ],
        };
      }
      if (String(path).includes("/googledrive/files")) {
        return { files: [{ id: "drive-1", name: "stock.csv", mimeType: "text/csv" }] };
      }
      return {};
    }) as never);
    vi.mocked(api.post).mockImplementation((async (path: string) => {
      if (String(path).endsWith("/summarize-drive")) {
        return { description: "Live stock sheet" };
      }
      return {};
    }) as never);
    renderDialog();

    await user.click(screen.getByRole("radio", { name: /reference/i }));
    await user.click(screen.getByRole("tab", { name: "Google Drive" }));
    await user.click(await screen.findByRole("button", { name: /stock\.csv/ }));

    await screen.findByDisplayValue("Live stock sheet");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith(
      "/api/user/workspace-asset-groups/group-1/assets/drive",
      {
        source: "google_drive",
        driveFileId: "drive-1",
        fileName: "stock.csv",
        mimeType: "text/csv",
        description: "Live stock sheet",
      },
    );
  });

  // Nothing to submit until a file is picked and a description exists, so Add stays disabled.
  it("keeps Add disabled until a file and description are present", async () => {
    const user = userEvent.setup();
    vi.mocked(api.postForm).mockResolvedValue({ description: "" } as never);
    renderDialog();

    const addButton = screen.getByRole("button", { name: "Add" });
    expect(addButton).toBeDisabled();

    await user.upload(
      screen.getByLabelText("File"),
      new File(["%PDF"], "menu.pdf", { type: "application/pdf" }),
    );
    await waitFor(() => expect(vi.mocked(api.postForm)).toHaveBeenCalled());

    expect(addButton).toBeDisabled();
  });

  // Switching kind changes what the agent does with the file, so stale picks and drafts are cleared.
  it("clears the picked file and draft when switching asset kind", async () => {
    const user = userEvent.setup();
    vi.mocked(api.postForm).mockImplementation((async (path: string) => {
      if (String(path).endsWith("/summarize")) return { description: "AI menu description" };
      return {};
    }) as never);
    renderDialog();

    await user.upload(
      screen.getByLabelText("File"),
      new File(["%PDF"], "menu.pdf", { type: "application/pdf" }),
    );
    await screen.findByDisplayValue("AI menu description");

    await user.click(screen.getByRole("radio", { name: /reference/i }));

    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });
});
