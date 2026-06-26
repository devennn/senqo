import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CrmPage from "@/pages/dashboard/Crm";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseContacts = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useContacts", () => ({ useContacts: mockUseContacts }));

vi.mock("@/components/layout/app-frame", () => ({
  AppFrame: ({ mainPanel }: { mainPanel: React.ReactNode }) => <div>{mainPanel}</div>,
}));

vi.mock("@/pages/dashboard/components/crm-filters", () => ({
  CrmFilters: () => <div data-testid="crm-filters" />,
}));

vi.mock("@/pages/dashboard/components/crm-table", () => ({
  CrmTable: ({ contacts }: { contacts: { id: string; first_name: string }[] }) => (
    <div data-testid="crm-table">
      {contacts.map((c) => (
        <div key={c.id}>{c.first_name}</div>
      ))}
    </div>
  ),
}));

vi.mock("@/pages/dashboard/components/table-pagination", () => ({
  TablePagination: () => <div data-testid="pagination" />,
}));

vi.mock("@/pages/dashboard/components/table-list-loading", () => ({
  TableListLoading: () => <div data-testid="loading">Loading contacts</div>,
}));

vi.mock("@/context/workspace", () => ({
  useWorkspace: () => ({ workspaceId: "ws-1", wsPath: (p: string) => `/ws-1${p}` }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultHookState(overrides = {}) {
  return {
    contacts: [],
    total: 0,
    loading: false,
    pageSize: 10,
    addContact: vi.fn(),
    setIsTest: vi.fn(),
    deleteContact: vi.fn(),
    refetch: vi.fn(),
    updatingIsTestId: null,
    deletingContactId: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/ws-1/crm"]}>
      <CrmPage />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CRM page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseContacts.mockReturnValue(defaultHookState());
  });

  // Heading renders — confirms correct page.
  it("renders CRM heading", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "CRM" })).toBeInTheDocument();
  });

  // Contact rows render from hook data — verifies table displays contacts.
  it("renders contacts from hook data", () => {
    mockUseContacts.mockReturnValue(
      defaultHookState({
        contacts: [
          { id: "c1", first_name: "Alice", last_name: "Smith", phone: "+1234567890", is_test: false },
          { id: "c2", first_name: "Bob", last_name: "Jones", phone: "+9876543210", is_test: false },
        ],
        total: 2,
      }),
    );

    renderPage();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  // Empty state renders when total is 0 — prevents blank table body.
  it("shows empty state when no contacts", () => {
    renderPage();
    expect(screen.getByText(/No contacts match your current filters/i)).toBeInTheDocument();
  });

  // Loading state shows the loader.
  it("shows loader while contacts are loading", () => {
    mockUseContacts.mockReturnValue(defaultHookState({ loading: true }));
    renderPage();
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  // Pagination renders when contacts exist.
  it("renders pagination when contacts exist", () => {
    mockUseContacts.mockReturnValue(
      defaultHookState({
        contacts: [{ id: "c1", first_name: "Alice" }],
        total: 25,
        pageSize: 10,
      }),
    );
    renderPage();
    expect(screen.getByTestId("pagination")).toBeInTheDocument();
  });

  // Total count badge shows contact count.
  it("displays total contact count in badge", () => {
    mockUseContacts.mockReturnValue(defaultHookState({ total: 42 }));
    renderPage();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
