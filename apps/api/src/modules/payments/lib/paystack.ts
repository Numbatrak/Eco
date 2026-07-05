import { createHmac } from "node:crypto";
import { constantTimeEqual } from "./constant-time.js";
import type {
  InitializedTransaction,
  OrderForPayment,
  PaymentProvider,
  VerifiedTransaction,
  WebhookHeaders,
} from "./provider.js";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

interface PaystackInitializeResponse {
  status: boolean;
  message?: string;
  data?: { authorization_url: string; reference: string };
}

interface PaystackVerifyResponse {
  status: boolean;
  message?: string;
  data?: { status: string; amount: number; currency: string };
}

export class PaystackProvider implements PaymentProvider {
  constructor(
    private readonly publicKey: string,
    private readonly secretKey: string,
  ) {}

  async initializeTransaction(order: OrderForPayment): Promise<InitializedTransaction> {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: order.customerEmail,
        amount: order.totalCents,
        currency: order.currency,
        reference: `${order.orderNumber}-${order.id.slice(0, 8)}`,
        callback_url: order.callbackUrl,
      }),
    });
    const data = (await response.json()) as PaystackInitializeResponse;
    if (!response.ok || !data.status || !data.data) {
      throw new Error(`Paystack initialize failed: ${data.message ?? response.statusText}`);
    }
    return { checkoutUrl: data.data.authorization_url, reference: data.data.reference };
  }

  async verifyTransaction(reference: string): Promise<VerifiedTransaction> {
    const response = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${this.secretKey}` } },
    );
    const data = (await response.json()) as PaystackVerifyResponse;
    if (!response.ok || !data.status || !data.data) {
      return { status: "failed", reference };
    }
    const providerStatus = data.data.status;
    return {
      status:
        providerStatus === "success"
          ? "success"
          : providerStatus === "abandoned"
            ? "pending"
            : "failed",
      reference,
      amountCents: data.data.amount,
      currency: data.data.currency,
    };
  }

  verifyWebhookSignature(rawBody: Buffer, headers: WebhookHeaders): boolean {
    const signature = headers["x-paystack-signature"];
    if (!signature || Array.isArray(signature)) {
      return false;
    }
    const expected = createHmac("sha512", this.secretKey).update(rawBody).digest("hex");
    return constantTimeEqual(expected, signature);
  }
}
