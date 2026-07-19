// Minimal client for Platform's OWN Paystack account — used to issue refunds on
// subscription charges. Distinct from the tenant payments provider
// (modules/payments/lib/paystack.ts), which uses each tenant's own keys. This
// reads PLATFORM_PAYSTACK_SECRET_KEY and must never touch tenant keys.

const PAYSTACK_BASE = "https://api.paystack.co";

export interface RefundResult {
  ok: boolean;
  status: string;
  message: string;
}

/**
 * Issues a refund for a transaction by its Paystack reference. Returns the
 * gateway outcome; the caller decides whether to flip the ledger row. Throws if
 * the platform secret isn't configured (a refund must actually reach Paystack —
 * we never silently "succeed" a refund that didn't happen).
 */
export async function issuePaystackRefund(reference: string): Promise<RefundResult> {
  const secret = process.env.PLATFORM_PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new Error("PLATFORM_PAYSTACK_SECRET_KEY is not set");
  }
  const response = await fetch(`${PAYSTACK_BASE}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transaction: reference }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: { status?: string };
  };
  return {
    ok: response.ok && body.status === true,
    status: body.data?.status ?? (response.ok ? "pending" : "failed"),
    message: body.message ?? (response.ok ? "Refund queued" : "Refund request failed"),
  };
}
