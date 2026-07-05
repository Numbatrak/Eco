import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ResetPasswordPage from "./ResetPasswordPage";
import { authApi } from "../../lib/authApi";

vi.mock("../../lib/authApi", () => ({
  authApi: { completePasswordReset: vi.fn() },
}));

describe("ResetPasswordPage validation", () => {
  it("shows an error when the link has no token at all", () => {
    render(
      <MemoryRouter initialEntries={["/reset-password"]}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument();
  });

  it("shows a mismatch error when the confirmation doesn't match", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/reset-password?token=abc123"]}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("New password"), "a-strong-new-password");
    await user.type(screen.getByLabelText("Confirm new password"), "does-not-match-at-all");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(vi.mocked(authApi.completePasswordReset)).not.toHaveBeenCalled();
  });

  it("shows a length error for a too-short password", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/reset-password?token=abc123"]}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("New password"), "short");
    await user.type(screen.getByLabelText("Confirm new password"), "short");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByText(/at least 12 character/i)).toBeInTheDocument();
  });
});
