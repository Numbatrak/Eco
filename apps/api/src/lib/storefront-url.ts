/**
 * Base URL for a tenant's public storefront. `{subdomain}` is substituted
 * into a template so this works both for local dev (no wildcard DNS) and
 * production (real wildcard subdomains) without code changes - see
 * STOREFRONT_BASE_URL_TEMPLATE in .env.example.
 */
export function buildStorefrontBaseUrl(subdomain: string): string {
  const template = process.env.STOREFRONT_BASE_URL_TEMPLATE ?? "http://{subdomain}.numbatrak.com";
  return template.replace("{subdomain}", subdomain);
}
