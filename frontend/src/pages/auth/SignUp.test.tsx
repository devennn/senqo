import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

const {
  mockNavigate,
  mockRegister,
  mockSaveAuthTokens,
  mockUseSearchParams,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockRegister: vi.fn(),
  mockSaveAuthTokens: vi.fn(),
  mockUseSearchParams: vi.fn(() => [new URLSearchParams() as URLSearchParams, vi.fn()] as const),
}));

vi.mock("@/lib/auth-client", () => ({
  register: mockRegister,
  saveAuthTokens: mockSaveAuthTokens,
  getAuthConfig: vi.fn().mockResolvedValue({ allowPublicRegistration: true }),
  getInvitePreview: vi.fn().mockResolvedValue(null),
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

import SignUpPage from "./SignUp";

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders name, email, and password fields", () => {
    render(<SignUpPage />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows Create your account heading", () => {
    render(<SignUpPage />);
    expect(screen.getByText("Create your account")).toBeInTheDocument();
  });

  it("shows Create account button", () => {
    render(<SignUpPage />);
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it('renders Already have an account? link to /sign-in', () => {
    render(<SignUpPage />);
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/sign-in");
  });

  it("calls register on form submit and navigates on success", async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValue({ accessToken: "at", refreshToken: "rt" });

    render(<SignUpPage />);

    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(mockRegister).toHaveBeenCalledWith("jane@example.com", "password123", "Jane Doe", undefined);
    expect(mockSaveAuthTokens).toHaveBeenCalledWith("at", "rt");
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
