import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConversationReportDialog } from "@/pages/dashboard/components/conversation-report-dialog";

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

const existingReport = {
  id: "report-1",
  reason: "Agent quoted the wrong refund policy",
  reportedByName: "User One",
  createdAt: "2026-07-21T14:32:00.000Z",
};

describe("ConversationReportDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ reports: [existingReport] });
  });

  // The header trigger opens the report dialog with a required reason field.
  it("opens from the trigger and disables submit until a reason is typed", async () => {
    const user = userEvent.setup();
    render(
      <ConversationReportDialog conversationId="conv-1" conversationTitle="Amara Okafor" />,
    );
    await user.click(screen.getByRole("button", { name: "Report" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Report this conversation as wrong/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Reason/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report" })).toBeDisabled();

    await user.type(screen.getByLabelText(/Reason/), "Agent gave wrong refund policy");
    expect(screen.getByRole("button", { name: "Report" })).toBeEnabled();
  });

  // Opening loads the conversation's report history from the API.
  it("loads and shows previous reports on open", async () => {
    const user = userEvent.setup();
    render(
      <ConversationReportDialog conversationId="conv-1" conversationTitle="Amara Okafor" />,
    );
    await user.click(screen.getByRole("button", { name: "Report" }));
    await screen.findByRole("dialog");
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith("/api/user/conversations/conv-1/reports");
    });
    expect(screen.getByText("Agent quoted the wrong refund policy")).toBeInTheDocument();
  });

  // Submitting POSTs the reason and closes the dialog; the new entry appears
  // in the visible history without refetching.
  it("posts the reason and records the returned entry", async () => {
    const user = userEvent.setup();
    render(
      <ConversationReportDialog conversationId="conv-1" conversationTitle="Amara Okafor" />,
    );
    await user.click(screen.getByRole("button", { name: "Report" }));
    await screen.findByRole("dialog");
    await user.type(screen.getByLabelText(/Reason/), "Agent misunderstood the delivery address");
    const createdEntry = {
      id: "report-2",
      reason: "Agent misunderstood the delivery address",
      reportedByName: "User One",
      createdAt: "2026-07-22T10:00:00.000Z",
    };
    mockPost.mockResolvedValue({ report: createdEntry });
    await user.click(screen.getByRole("button", { name: "Report" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(mockPost).toHaveBeenCalledWith("/api/user/conversations/conv-1/reports", {
      reason: "Agent misunderstood the delivery address",
    });

    // Reopen: the submitted reason should now appear in Previous reports
    // (the API returns the updated history).
    mockGet.mockResolvedValue({ reports: [createdEntry, existingReport] });
    await user.click(screen.getByRole("button", { name: "Report" }));
    await screen.findByRole("dialog");
    expect(
      screen.getAllByText("Agent misunderstood the delivery address").length,
    ).toBeGreaterThan(0);
  });

  // A failed submit keeps the dialog open with an error so the user can retry.
  it("shows an error and stays open when the submit fails", async () => {
    const user = userEvent.setup();
    render(
      <ConversationReportDialog conversationId="conv-1" conversationTitle="Amara Okafor" />,
    );
    await user.click(screen.getByRole("button", { name: "Report" }));
    await screen.findByRole("dialog");
    await user.type(screen.getByLabelText(/Reason/), "Wrong answer");
    mockPost.mockRejectedValue(new Error("network"));
    await user.click(screen.getByRole("button", { name: "Report" }));

    await waitFor(() => {
      expect(screen.getByText("Could not submit the report. Try again.")).toBeInTheDocument();
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});