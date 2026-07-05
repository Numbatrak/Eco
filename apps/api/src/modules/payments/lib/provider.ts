export interface OrderForPayment {
  id: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  customerEmail: string;
  /** Where the provider's hosted checkout redirects the shopper back to. */
  callbackUrl: string;
}

export interface InitializedTransaction {
  checkoutUrl: string;
  reference: string;
}

export type TransactionStatus = "success" | "pending" | "failed";

export interface VerifiedTransaction {
  status: TransactionStatus;
  reference: string;
  amountCents?: number;
  currency?: string;
}

export type WebhookHeaders = Record<string, string | string[] | undefined>;

/**
 * Implemented by PaystackProvider and FlutterwaveProvider. The client-side
 * redirect after a hosted checkout is never sufficient proof of payment on
 * its own - verifyTransaction always calls the provider's verify API
 * server-side before anything is marked paid.
 */
export interface PaymentProvider {
  initializeTransaction(order: OrderForPayment): Promise<InitializedTransaction>;
  verifyTransaction(reference: string): Promise<VerifiedTransaction>;
  verifyWebhookSignature(rawBody: Buffer, headers: WebhookHeaders): boolean;
}
