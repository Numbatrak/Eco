import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PlatformAdminLoginPage from "./PlatformAdminLoginPage";
import PlatformAdminTwoFactorVerifyPage from "./PlatformAdminTwoFactorVerifyPage";
import { platformAdminAuthApi } from "../lib/platformAdminAuthApi";

vi.mock("../context/PlatformAdminAuthContext", () => ({
  usePlatformAdminAuth: vi.fn(() => ({ refreshMe: vi.fn() })),
}));
vi.mock("../lib/platformAdminAuthApi", () => ({
  platformAdminAuthApi: { login: vi.fn(), verifyTotp: vi.fn(), verifyBackupCode: vi.fn() },
}));

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<PlatformAdminLoginPage />} />
        <Route path="/2fa/verify" element={<PlatformAdminTwoFactorVerifyPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PlatformAdminLoginPage", () => {
  it("shows a validation error for an empty form and never calls the API", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    expect(vi.mocked(platformAdminAuthApi.login)).not.toHaveBeenCalled();
  });

  it("navigates to the 2FA verify page when the server requests a second factor", async () => {
    vi.mocked(platformAdminAuthApi.login).mockResolvedValueOnce({
      twoFactorRedirect: true,
      twoFactorMethods: ["totp"],
    });
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText("Email"), "owner@example.com");
    await user.type(screen.getByLabelText("Password"), "a-strong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("button", { name: /^verify$/i })).toBeInTheDocument();
    expect(screen.getByText(/enter the 6-digit code/i)).toBeInTheDocument();
  });
});
