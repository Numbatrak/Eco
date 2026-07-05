import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ForgotPasswordPage from "./ForgotPasswordPage";
import { authApi } from "../../lib/authApi";

vi.mock("../../lib/authApi", () => ({
  authApi: { requestPasswordReset: vi.fn() },
}));

describe("ForgotPasswordPage validation", () => {
  it("shows a validation error for a malformed email and does not call the API", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(vi.mocked(authApi.requestPasswordReset)).not.toHaveBeenCalled();
  });

  it("shows the same generic confirmation regardless of whether the account exists", async () => {
    vi.mocked(authApi.requestPasswordReset).mockResolvedValue({ message: "ignored" });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "someone@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(
      await screen.findByText(/if an account exists for that email, we've sent a reset link/i),
    ).toBeInTheDocument();
  });
});
