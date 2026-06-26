import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LabelsPage from "@/pages/dashboard/Labels";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/components/layout/app-frame", () => ({
  AppFrame: ({ mainPanel }: { mainPanel: React.ReactNode }) => <div>{mainPanel}</div>,
}));

vi.mock("@/pages/dashboard/components/conversation-labels-manager", () => ({
  ConversationLabelsManager: () => <div data-testid="labels-manager">Labels Manager</div>,
}));

vi.mock("@/context/workspace", () => ({
  useWorkspace: () => ({ workspaceId: "ws-1", wsPath: (p: string) => `/ws-1${p}` }),
}));

// ── Helper ────────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <LabelsPage />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Labels page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Heading renders — confirms correct page.
  it("renders conversation labels heading", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Conversation labels" })).toBeInTheDocument();
  });

  // Labels manager component mounts — verifies the page delegates label management.
  it("renders the labels manager component", () => {
    renderPage();
    expect(screen.getByTestId("labels-manager")).toBeInTheDocument();
  });

  // Descriptive subtitle is visible — confirms page layout is complete.
  it("renders descriptive subtitle", () => {
    renderPage();
    expect(screen.getByText(/Define labels for your workspace/i)).toBeInTheDocument();
  });
});
