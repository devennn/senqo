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

import SignInPage from "./SignIn";

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams(),
      mockSetSearchParams,
    ]);
  });

  it("renders email and password fields", () => {
    render(<SignInPage />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows Welcome back heading", () => {
    render(<SignInPage />);
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
  });

  it("shows Sign in button", () => {
    render(<SignInPage />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it('renders New to Senqo? link pointing to /sign-up', () => {
    render(<SignInPage />);
    const link = screen.getByRole("link", { name: "Create an account" });
    expect(link).toHaveAttribute("href", "/sign-up");
  });

  it("shows error message when search params contain error", () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams({ error: "Invalid credentials" }),
      mockSetSearchParams,
    ]);

    render(<SignInPage />);
    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });

  it("calls login on form submit and navigates on success", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({ accessToken: "at", refreshToken: "rt" });

    render(<SignInPage />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mockLogin).toHaveBeenCalledWith("user@example.com", "password123");
    expect(mockSaveAuthTokens).toHaveBeenCalledWith("at", "rt");
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
