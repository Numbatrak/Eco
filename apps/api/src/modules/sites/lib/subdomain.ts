const DEFAULT_RESERVED_SUBDOMAINS = [
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
];

const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function reservedSubdomains(): Set<string> {
  const raw = process.env.RESERVED_SUBDOMAINS;
  const list = raw
    ? raw
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
    : DEFAULT_RESERVED_SUBDOMAINS;
  return new Set(list);
}

export function isValidSubdomainFormat(subdomain: string): boolean {
  return SUBDOMAIN_PATTERN.test(subdomain);
}

export function isReservedSubdomain(subdomain: string): boolean {
  return reservedSubdomains().has(subdomain.toLowerCase());
}
