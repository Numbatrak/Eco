import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import TwoFactorVerifyPage from "./TwoFactorVerifyPage";
import { authApi } from "../../lib/authApi";

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({ setSession: vi.fn() })),
}));
vi.mock("../../lib/authApi", () => ({
  authApi: { mfaVerify: vi.fn(), mfaSendEmailOtp: vi.fn() },
}));

function renderWithChallenge() {
  return render(
    <MemoryRouter
      initialEntries={[
        { pathname: "/2fa/verify", state: { challengeToken: "not-a-real-jwt", method: "totp" } },
      ]}
    >
      <Routes>
        <Route path="/2fa/verify" element={<TwoFactorVerifyPage />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TwoFactorVerifyPage", () => {
  it("redirects to /login when there is no challenge in the router state", () => {
    render(
      <MemoryRouter initialEntries={["/2fa/verify"]}>
        <Routes>
          <Route path="/2fa/verify" element={<TwoFactorVerifyPage />} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("shows a validation error for an empty code and never calls the API", async () => {
    const user = userEvent.setup();
    renderWithChallenge();

    await user.click(screen.getByRole("button", { name: /verify/i }));

    expect(await screen.findByText(/string must contain at least 1/i)).toBeInTheDocument();
    expect(vi.mocked(authApi.mfaVerify)).not.toHaveBeenCalled();
  });

  it("switches to backup-code entry when the link is clicked", async () => {
    const user = userEvent.setup();
    renderWithChallenge();

    await user.click(screen.getByRole("button", { name: /use a backup code instead/i }));

    expect(screen.getByLabelText(/backup code/i)).toBeInTheDocument();
  });
});
