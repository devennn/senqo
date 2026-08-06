import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ReportsPage from "@/pages/dashboard/Reports";

const mockGet = vi.fn();

vi.mock("@/components/layout/app-frame", () => ({
  AppFrame: ({ mainPanel }: { mainPanel: React.ReactNode }) => <div>{mainPanel}</div>,
}));

vi.mock("@/context/workspace", () => ({
  useWorkspace: () => ({ workspaceId: "ws-1", wsPath: (p: string) => `/ws-1${p}` }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ReportsPage />
    </MemoryRouter>,
  );
}

const sampleReport = {
  agents: [
    {
      id: "agent-1",
      name: "Front desk",
      conversationsHandled: 10,
      aiReplies: 20,
      handoffs: 2,
      inHumanMode: 1,
    },
  ],
  topics: [
    {
      id: "topic-1",
      topicName: "Refund request",
      groupName: "Billing",
      groupId: "group-1",
      handoffs: 2,
    },
  ],
  summary: {
    conversationsHandled: 10,
    aiReplies: 20,
    handoffs: 2,
    inHumanMode: 1,
  },
};

describe("Reports page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-07-31T12:00:00Z"));
    mockGet.mockResolvedValue(sampleReport);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Heading renders — confirms the reports page is mounted.
  it("renders reports heading", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("Front desk").length).toBeGreaterThan(0);
    });
  });

  // Default window is last 30 days — From/To must match today and 29 days earlier.
  it("defaults date range to last 30 days and fetches the report", async () => {
    renderPage();
    expect(screen.getByLabelText("From")).toHaveValue("2026-07-02");
    expect(screen.getByLabelText("To")).toHaveValue("2026-07-31");
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        "/api/user/reports/agents?from=2026-07-02&to=2026-07-31",
      );
    });
  });

  // Date pickers must not allow days after today — verifies max is capped at the current date.
  it("caps From and To so future dates cannot be chosen", async () => {
    renderPage();
    expect(screen.getByLabelText("From")).toHaveAttribute("max", "2026-07-31");
    expect(screen.getByLabelText("To")).toHaveAttribute("max", "2026-07-31");
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
  });

  // Changing From refetch with new query params — verifies live date query wiring.
  it("refetches when the date range changes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    await user.clear(screen.getByLabelText("From"));
    await user.type(screen.getByLabelText("From"), "2026-07-25");
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        "/api/user/reports/agents?from=2026-07-25&to=2026-07-31",
      );
    });
  });

  // Handoff topics section lists topic names from the API response.
  it("renders handoff topic names from the API", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Handoff topics" })).toBeInTheDocument();
      expect(screen.getAllByText("Refund request").length).toBeGreaterThan(0);
    });
  });

  // Topic names link into Agent setup → Human handoff for the matching group/entry.
  it("links configured handoff topics to the agent handoff editor", async () => {
    renderPage();
    await waitFor(() => {
      const links = screen.getAllByRole("link", { name: "Refund request" });
      expect(links[0]).toHaveAttribute(
        "href",
        "/ws-1/agent?tab=handoff&handoffGroupId=group-1&handoffEntryId=topic-1",
      );
    });
  });
});
