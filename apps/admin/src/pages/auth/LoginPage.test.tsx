import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "./LoginPage";
import { authApi } from "../../lib/authApi";

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({ setSession: vi.fn() })),
}));
vi.mock("../../lib/authApi", () => ({
  authApi: { login: vi.fn() },
}));

describe("LoginPage validation", () => {
  it("shows validation errors for an empty form and never calls the API", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(vi.mocked(authApi.login)).not.toHaveBeenCalled();
  });

  it("shows an error for a malformed email", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "whatever-password");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(vi.mocked(authApi.login)).not.toHaveBeenCalled();
  });
});
