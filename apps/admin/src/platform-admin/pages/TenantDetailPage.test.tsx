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
    grantTenantCredits: vi.fn(),
    extendTenantTrial: vi.fn(),
    resetTenantPassword: vi.fn(),
    deleteTenant: vi.fn(),
  },
}));

const fakeTenant: PlatformAdminTenantDetail = {
  id: "tenant-1",
  name: "Acme Co",
  subdomain: "acme",
  ownerEmail: "owner@acme.test",
  status: "active",
  planTier: "starter",
  mrrContributionCents: 999900,
  teamSize: 3,
  signupSource: "google",
  emailCredits: 100,
  whatsappCredits: 50,
  lastActiveAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  subscription: null,
  transactions: [],
  capabilities: {
    productCount: 0,
    publishedProductCount: 0,
    collectionCount: 0,
    orderCount: 0,
    storefrontPublished: false,
    paymentConfigured: false,
    analyticsConfigured: false,
    deliveryConfigured: false,
  },
  team: [],
  credits: { emailBalance: 100, whatsappBalance: 50, history: [] },
  activity: [],
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
    vi.clearAllMocks();
    vi.mocked(platformAdminApi.getTenant).mockResolvedValue(fakeTenant);
  });

  it("rejects a credit grant with an empty reason and never calls the API", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Acme Co")).toBeInTheDocument();

    const amountInput = screen.getByLabelText("Amount");
    await user.clear(amountInput);
    await user.type(amountInput, "50");
    // Grant reason left blank on purpose.
    await user.click(screen.getByRole("button", { name: /grant credits/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 1 character/i);
    expect(vi.mocked(platformAdminApi.grantTenantCredits)).not.toHaveBeenCalled();
  });

  it("requires a reason before suspending, then suspends only on explicit confirm", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Acme Co")).toBeInTheDocument();

    // Clicking suspend with no reason shows an error and opens no dialog.
    await user.click(screen.getByRole("button", { name: /^suspend tenant$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/reason is required/i);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // With a reason, the confirm dialog explains the effect.
    await user.type(screen.getByLabelText("Suspension reason"), "non-payment");
    await user.click(screen.getByRole("button", { name: /^suspend tenant$/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/lose dashboard access/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /^suspend$/i }));
    expect(vi.mocked(platformAdminApi.suspendTenant)).toHaveBeenCalledWith("tenant-1", {
      reason: "non-payment",
    });
  });
});
