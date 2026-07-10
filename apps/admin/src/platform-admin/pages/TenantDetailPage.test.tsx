import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import TenantDetailPage from "./TenantDetailPage";
import { platformAdminApi } from "../lib/platformAdminApi";
import type { PlatformAdminTenantDetail } from "@platform/shared-types";

vi.mock("../lib/platformAdminApi", () => ({
  platformAdminApi: {
    getTenant: vi.fn(),
    suspendTenant: vi.fn(),
    reactivateTenant: vi.fn(),
    updateTenantPlan: vi.fn(),
    adjustTenantCredits: vi.fn(),
  },
}));

const fakeTenant: PlatformAdminTenantDetail = {
  id: "tenant-1",
  name: "Acme Co",
  subdomain: "acme",
  status: "active",
  plan: "free",
  creditBalance: 10,
  orderCount: 2,
  revenueCents: 5000,
  createdAt: new Date().toISOString(),
  creditAdjustments: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/platform-admin/tenants/tenant-1"]}>
      <Routes>
        <Route path="/platform-admin/tenants/:tenantId" element={<TenantDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TenantDetailPage", () => {
  beforeEach(() => {
    vi.mocked(platformAdminApi.getTenant).mockResolvedValue(fakeTenant);
  });

  it("rejects a credit adjustment submission with an empty reason and never calls the API", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Acme Co")).toBeInTheDocument();

    const deltaInput = screen.getByLabelText("Delta");
    await user.clear(deltaInput);
    await user.type(deltaInput, "50");
    // Reason left blank on purpose.
    await user.click(screen.getByRole("button", { name: /apply adjustment/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 1 character/i);
    expect(vi.mocked(platformAdminApi.adjustTenantCredits)).not.toHaveBeenCalled();
  });

  it("shows the suspend confirmation modal with its effect explained, and only suspends on explicit confirm", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Acme Co")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^suspend tenant$/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/lose dashboard access/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/temporarily-unavailable/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(vi.mocked(platformAdminApi.suspendTenant)).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^suspend tenant$/i }));
    const secondDialog = await screen.findByRole("dialog");
    await user.click(within(secondDialog).getByRole("button", { name: /^suspend$/i }));

    expect(vi.mocked(platformAdminApi.suspendTenant)).toHaveBeenCalledWith("tenant-1");
  });
});
