const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "admin",
  "app",
  "mail",
  "status",
  "blog",
  "help",
  "docs",
  "cdn",
  "assets",
]);

/**
 * Extracts a tenant subdomain from a request Host header, given the bare
 * base domain tenants sit under (e.g. "acme.localhost:3000" with
 * baseDomain "localhost:3000" -> "acme"). Returns null for the base domain
 * itself, an unrelated host, a multi-level subdomain, or a reserved word -
 * all of which mean "don't rewrite, this isn't a tenant site".
 */
export function resolveSubdomain(host: string | null | undefined, baseDomain: string): string | null {
  if (!host) {
    return null;
  }
  const normalizedHost = host.toLowerCase();
  const normalizedBase = baseDomain.toLowerCase();

  if (normalizedHost === normalizedBase) {
    return null;
  }
  if (!normalizedHost.endsWith(`.${normalizedBase}`)) {
    return null;
  }

  const subdomain = normalizedHost.slice(0, -(normalizedBase.length + 1));
  if (!subdomain || subdomain.includes(".")) {
    return null;
  }
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return null;
  }
  return subdomain;
}

/**
 * Builds a same-origin path for `window.location.href`-style full-page
 * navigation within a tenant site. On a real tenant subdomain (e.g.
 * acme.numbatrak.com), middleware.ts already rewrites every path onto
 * /sites/acme/*, so the bare path must be used or the rewrite doubles up
 * (/sites/acme/sites/acme/... -> 404). On the base domain (e.g. the
 * dashboard's own storefront preview, hit directly with no subdomain), no
 * rewrite happens, so the /sites/{subdomain} prefix must be added explicitly.
 */
export function siteRelativePath(subdomain: string, path: string): string {
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "localhost:3000";
  const onTenantSubdomain =
    typeof window !== "undefined" && resolveSubdomain(window.location.host, baseDomain) !== null;
  return onTenantSubdomain ? path : `/sites/${subdomain}${path}`;
}
