import { buildStorefrontBaseUrl } from "../../../lib/storefront-url.js";

/** Builds the URL the payment provider's hosted checkout redirects back to. */
export function buildCheckoutCallbackUrl(subdomain: string, orderId: string): string {
  return `${buildStorefrontBaseUrl(subdomain)}/order/${orderId}/status`;
}
