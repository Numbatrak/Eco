import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyBaseLogger } from "fastify";

vi.mock("./orders.js", () => ({
  findAbandonedCheckoutCandidates: vi.fn(),
  markOrderAbandoned: vi.fn(),
  markOrderPaid: vi.fn(),
  markOrderFailed: vi.fn(),
}));
vi.mock("../../payments/lib/provider-factory.js", () => ({
  getProviderForTenant: vi.fn(),
}));
vi.mock("../../sites/lib/site-store.js", () => ({
  findTenantSettings: vi.fn(async () => ({ subdomain: "acme" })),
}));
vi.mock("../../auth/lib/email.js", () => ({
  sendEmail: vi.fn(async () => {}),
}));
vi.mock("../../../lib/whatsapp.js", () => ({
  sendAbandonedCheckoutWhatsApp: vi.fn(async () => {}),
}));

const { findAbandonedCheckoutCandidates, markOrderAbandoned, markOrderPaid, markOrderFailed } = await import(
  "./orders.js"
);
const { getProviderForTenant } = await import("../../payments/lib/provider-factory.js");
const { sendEmail } = await import("../../auth/lib/email.js");
const { sendAbandonedCheckoutWhatsApp } = await import("../../../lib/whatsapp.js");
const { runAbandonedCheckoutSweep } = await import("./abandoned-checkout-sweep.js");

const db = {} as any;
const log = { info: vi.fn(), warn: vi.fn() } as unknown as FastifyBaseLogger;

function order(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "order-1",
    tenantId: "tenant-1",
    orderNumber: "ORD1",
    customerName: "Ada",
    customerEmail: "ada@example.com",
    customerPhone: "+2348000000000",
    currency: "NGN",
    totalCents: 5000,
    paymentReference: null,
    status: "pending",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(findAbandonedCheckoutCandidates).mockReset();
  vi.mocked(markOrderAbandoned).mockReset();
  vi.mocked(markOrderPaid).mockReset();
  vi.mocked(markOrderFailed).mockReset();
  vi.mocked(getProviderForTenant).mockReset();
  vi.mocked(sendEmail).mockClear();
  vi.mocked(sendAbandonedCheckoutWhatsApp).mockClear();
});

describe("runAbandonedCheckoutSweep", () => {
  it("flags and notifies a candidate with no payment reference to re-verify", async () => {
    vi.mocked(findAbandonedCheckoutCandidates).mockResolvedValue([order()] as any);
    vi.mocked(markOrderAbandoned).mockResolvedValue(true);

    const result = await runAbandonedCheckoutSweep(db, log);

    expect(getProviderForTenant).not.toHaveBeenCalled();
    expect(markOrderAbandoned).toHaveBeenCalledWith(db, "order-1");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendAbandonedCheckoutWhatsApp).toHaveBeenCalledTimes(1);
    expect(result.flagged).toEqual(["order-1"]);
    expect(result.recoveredByReverify).toEqual([]);
  });

  it("recovers via re-verify instead of flagging when the provider confirms payment succeeded", async () => {
    vi.mocked(findAbandonedCheckoutCandidates).mockResolvedValue([
      order({ paymentReference: "ref-1" }),
    ] as any);
    vi.mocked(getProviderForTenant).mockResolvedValue({
      verifyTransaction: vi.fn(async () => ({ status: "success", reference: "ref-1" })),
    } as any);
    vi.mocked(markOrderPaid).mockResolvedValue(true);

    const result = await runAbandonedCheckoutSweep(db, log);

    expect(markOrderPaid).toHaveBeenCalled();
    expect(markOrderAbandoned).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(result.recoveredByReverify).toEqual(["order-1"]);
    expect(result.flagged).toEqual([]);
  });

  it("marks failed (not abandoned-recovered) and still flags when the provider confirms failure", async () => {
    vi.mocked(findAbandonedCheckoutCandidates).mockResolvedValue([
      order({ paymentReference: "ref-1" }),
    ] as any);
    vi.mocked(getProviderForTenant).mockResolvedValue({
      verifyTransaction: vi.fn(async () => ({ status: "failed", reference: "ref-1" })),
    } as any);
    vi.mocked(markOrderAbandoned).mockResolvedValue(true);

    const result = await runAbandonedCheckoutSweep(db, log);

    expect(markOrderFailed).toHaveBeenCalled();
    expect(markOrderAbandoned).toHaveBeenCalled();
    expect(result.flagged).toEqual(["order-1"]);
  });

  it("does not notify when a concurrent run already flagged the order", async () => {
    vi.mocked(findAbandonedCheckoutCandidates).mockResolvedValue([order()] as any);
    vi.mocked(markOrderAbandoned).mockResolvedValue(false);

    const result = await runAbandonedCheckoutSweep(db, log);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendAbandonedCheckoutWhatsApp).not.toHaveBeenCalled();
    expect(result.flagged).toEqual([]);
  });
});
