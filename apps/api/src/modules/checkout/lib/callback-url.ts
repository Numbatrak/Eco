/**
 * Builds the URL the payment provider's hosted checkout redirects back to.
 * `{subdomain}` is substituted into a template so this works both for local
 * dev (no wildcard DNS) and production (real wildcard subdomains) without
 * code changes - see STOREFRONT_BASE_URL_TEMPLATE in .env.example.
 */
export function buildCheckoutCallbackUrl(subdomain: string, orderId: string): string {
  const template = process.env.STOREFRONT_BASE_URL_TEMPLATE ?? "http://{subdomain}.localhost:3000";
  const base = template.replace("{subdomain}", subdomain);
  return `${base}/order/${orderId}/status`;
}
