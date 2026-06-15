import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

const {
  mockLogin,
  mockSaveAuthTokens,
  mockNavigate,
  mockSetSearchParams,
  mockUseSearchParams,
} = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockSaveAuthTokens: vi.fn(),
  mockNavigate: vi.fn(),
  mockSetSearchParams: vi.fn(),
  mockUseSearchParams: vi.fn(() => [new URLSearchParams() as URLSearchParams, vi.fn()] as const),
}));

vi.mock("@/lib/auth-client", () => ({
  login: mockLogin,
  saveAuthTokens: mockSaveAuthTokens,
  getSession: vi.fn().mockResolvedValue(null),
  getAuthConfig: vi.fn().mockResolvedValue({ allowPublicRegistration: true }),
}));

vi.mock("react-router-dom", async () => {
  const actual = (await vi.importActual("react-router-dom")) as Record<string, unknown>;
  return {
    ...actual,
    Link: ({ to, children, ...props }: Record<string, unknown>) => (
      <a href={to as string} {...props}>{children as React.ReactNode}</a>
    ),
    useNavigate: () => mockNavigate,
    useSearchParams: () => mockUseSearchParams(),
  };
});

import { AuthProvider } from "@/context/auth";
import SignInPage from "./SignIn";

function renderSignIn() {
  return render(
    <AuthProvider>
      <SignInPage />
    </AuthProvider>,
  );
}

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams(),
      mockSetSearchParams,
    ]);
  });

  // Smoke test: the sign-in form must render email and password input fields so users can enter credentials.
  it("renders email and password fields", () => {
    renderSignIn();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  // The page must display the "Welcome back" heading to give users clear context on the sign-in page.
  it("shows Welcome back heading", () => {
    renderSignIn();
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
  });

  // The primary call-to-action "Sign in" button must be rendered and accessible by role.
  it("shows Sign in button", () => {
    renderSignIn();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  // The "Create an account" link must point to /sign-up so new users can navigate to registration.
  it('renders New to Senqo? link pointing to /sign-up', () => {
    renderSignIn();
    const link = screen.getByRole("link", { name: "Create an account" });
    expect(link).toHaveAttribute("href", "/sign-up");
  });

  // When redirected with an error query param, the page must display that error message to the user.
  it("shows error message when search params contain error", () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams({ error: "Invalid credentials" }),
      mockSetSearchParams,
    ]);

    renderSignIn();
    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });

  // Full flow: submitting valid credentials calls login, persists tokens, and navigates to the dashboard.
  it("calls login on form submit and navigates on success", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      user: { id: "u1", email: "user@example.com" },
    });

    renderSignIn();

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mockLogin).toHaveBeenCalledWith("user@example.com", "password123");
    expect(mockSaveAuthTokens).toHaveBeenCalledWith("at", "rt");
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
