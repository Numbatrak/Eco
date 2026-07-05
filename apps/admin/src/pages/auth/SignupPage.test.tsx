import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SignupPage from "./SignupPage";
import { authApi } from "../../lib/authApi";

vi.mock("../../lib/authApi", () => ({
  authApi: { register: vi.fn() },
}));

describe("SignupPage validation", () => {
  it("shows validation errors for missing business name, bad email, and a short password", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(await screen.findByText(/at least 12 character/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/^string must contain at least 1 character\(s\)$/i),
    ).toBeInTheDocument();
    expect(vi.mocked(authApi.register)).not.toHaveBeenCalled();
  });

  it("shows a password strength hint as the user types", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Password"), "aVeryStr0ngPassword!42");

    expect(await screen.findByText(/password strength/i)).toBeInTheDocument();
  });
});
