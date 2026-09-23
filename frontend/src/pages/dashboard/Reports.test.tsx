import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
    totalConversations: 12,
    conversationsHandled: 10,
    totalMessages: 40,
    aiReplies: 20,
    handoffs: 2,
    inHumanMode: 1,
    technicalErrors: 1,
    reportedErrors: 2,
  },
  agentOptions: [
    { id: "agent-1", name: "Front desk" },
    { id: "agent-2", name: "Sales bot" },
  ],
};

const sampleReportedRows = [
  {
    id: "report-1",
    conversationId: "conv-1",
    conversationName: "Amara Okafor",
    contactName: "Amara Okafor",
    reason: "Agent quoted the wrong refund policy",
    reportedByName: "User One",
    agentId: "agent-1",
    agentName: "Front desk",
    createdAt: "2026-07-21T14:32:00.000Z",
  },
  {
    id: "report-2",
    conversationId: "conv-2",
    conversationName: "VIP Customers",
    contactName: null,
    reason: "Sent a message after opt-out",
    reportedByName: "User Two",
    agentId: null,
    agentName: null,
    createdAt: "2026-07-20T09:05:00.000Z",
  },
];

describe("Reports page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-07-31T12:00:00Z"));
    mockGet.mockImplementation((path: string) => {
      if (String(path).startsWith("/api/user/reports/conversation-reports")) {
        return Promise.resolve({ reports: sampleReportedRows, total: 2 });
      }
      return Promise.resolve(sampleReport);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Heading, tabs, and metrics content render — confirms the upgraded reports
  // page is mounted and wired to the reports API.
  it("renders tabs and the metrics tab from the API", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        "/api/user/reports/agents?from=2026-07-25&to=2026-07-31",
      );
    });
    expect(screen.getByRole("tab", { name: "Metrics", selected: true })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Reported conversations 2", selected: false }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("Front desk").length).toBeGreaterThan(0);
    });
  });

  // Summary cards surface the new volume and error metrics returned by the API.
  it("renders the new summary metric cards", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Total conversations")).toBeInTheDocument();
    });
    expect(screen.getByText("Conversations handled")).toBeInTheDocument();
    expect(screen.getByText("Total messages")).toBeInTheDocument();
    expect(screen.getByText("Technical errors")).toBeInTheDocument();
    expect(screen.getByText("Reported errors")).toBeInTheDocument();
  });

  // Each metric card carries an "i" hint whose panel defines the metric, so
  // the dense numbers stay explainable without cluttering the cards.
  it("shows the metric definition when a card info hint is opened", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Total conversations")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "About technical errors" }));
    const tooltip = screen.getByRole("tooltip");
    expect(within(tooltip).getByText(/failed to send after retries/)).toBeInTheDocument();
  });

  // Table column headers carry the same "i" hints — e.g. "In human mode"
  // must explain that it is a live snapshot which ignores the date range.
  it("shows column definitions from the table header hints", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Total conversations")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "About in human mode" }));
    const tooltip = screen.getByRole("tooltip");
    expect(within(tooltip).getByText(/live snapshot/)).toBeInTheDocument();
  });

  // Switching tabs loads the reported conversations listing with reasons —
  // the user-visible core of the "report as wrong" feature.
  it("lists reported conversations on the Reported tab", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        "/api/user/reports/conversation-reports?from=2026-07-25&to=2026-07-31&limit=7&offset=0",
      ),
    );
    await user.click(screen.getByRole("tab", { name: "Reported conversations 2" }));
    expect(screen.getByRole("heading", { name: "Reported conversations" })).toBeInTheDocument();
    expect(screen.getAllByText("Amara Okafor").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Agent quoted the wrong refund policy").length,
    ).toBeGreaterThan(0);
  });

  // Selecting an agent refetches the metrics scoped to that agent.
  it("refetches with the agentId filter when an agent is selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    await user.selectOptions(screen.getByLabelText("Agent"), "agent-1");
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        "/api/user/reports/agents?from=2026-07-25&to=2026-07-31&agentId=agent-1",
      );
    });
  });

  // Changing From refetches both report endpoints with new query params.
  it("refetches when the date range changes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
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

  // Topic names link into Knowledge → Human handoff for the matching group/entry.
  it("links configured handoff topics to the agent handoff editor", async () => {
    renderPage();
    await waitFor(() => {
      const links = screen.getAllByRole("link", { name: "Refund request" });
      expect(links[0]).toHaveAttribute(
        "href",
        "/ws-1/knowledge?tab=handoff&handoffGroupId=group-1&handoffEntryId=topic-1",
      );
    });
  });
});