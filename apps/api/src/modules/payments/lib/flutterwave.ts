import { randomUUID } from "node:crypto";
import { constantTimeEqual } from "./constant-time.js";
import type {
  InitializedTransaction,
  OrderForPayment,
  PaymentProvider,
  VerifiedTransaction,
  WebhookHeaders,
} from "./provider.js";

const FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3";

interface FlutterwaveInitializeResponse {
  status: string;
  message?: string;
  data?: { link: string };
}

interface FlutterwaveVerifyResponse {
  status: string;
  message?: string;
  data?: { status: string; amount: number; currency: string };
}

export class FlutterwaveProvider implements PaymentProvider {
  constructor(
    private readonly publicKey: string,
    private readonly secretKey: string,
  ) {}

  async initializeTransaction(order: OrderForPayment): Promise<InitializedTransaction> {
    const txRef = `${order.orderNumber}-${randomUUID()}`;
    const response = await fetch(`${FLUTTERWAVE_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: txRef,
        // Flutterwave's API takes amount in the major currency unit, not
        // cents - this division is a one-off boundary conversion for the
        // outbound request only, never used for any internal arithmetic.
        amount: (order.totalCents / 100).toFixed(2),
        currency: order.currency,
        redirect_url: order.callbackUrl,
        customer: { email: order.customerEmail },
      }),
    });
    const data = (await response.json()) as FlutterwaveInitializeResponse;
    if (!response.ok || data.status !== "success" || !data.data) {
      throw new Error(`Flutterwave initialize failed: ${data.message ?? response.statusText}`);
    }
    return { checkoutUrl: data.data.link, reference: txRef };
  }

  async verifyTransaction(reference: string): Promise<VerifiedTransaction> {
    const response = await fetch(
      `${FLUTTERWAVE_BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${this.secretKey}` } },
    );
    const data = (await response.json()) as FlutterwaveVerifyResponse;
    if (!response.ok || data.status !== "success" || !data.data) {
      return { status: "failed", reference };
    }
    const providerStatus = data.data.status;
    return {
      status:
        providerStatus === "successful"
          ? "success"
          : providerStatus === "pending"
            ? "pending"
            : "failed",
      reference,
      amountCents: Math.round(data.data.amount * 100),
      currency: data.data.currency,
    };
  }

  verifyWebhookSignature(_rawBody: Buffer, headers: WebhookHeaders): boolean {
    const hash = headers["verif-hash"];
    if (!hash || Array.isArray(hash)) {
      return false;
    }
    return constantTimeEqual(this.secretKey, hash);
  }
}
