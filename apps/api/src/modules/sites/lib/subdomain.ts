import { eq } from "drizzle-orm";
import { reservedSubdomains, type Database } from "@platform/db";

const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function isValidSubdomainFormat(subdomain: string): boolean {
  return SUBDOMAIN_PATTERN.test(subdomain);
}

/**
 * Reserved-subdomains source of truth is the reserved_subdomains table
 * (seeded from the old RESERVED_SUBDOMAINS env var at migration time, see
 * packages/db/drizzle/0006_*.sql), managed via
 * GET/POST/DELETE /platform-admin/reserved-subdomains.
 */
export async function isReservedSubdomain(db: Database, subdomain: string): Promise<boolean> {
  const [row] = await db
    .select({ word: reservedSubdomains.word })
    .from(reservedSubdomains)
    .where(eq(reservedSubdomains.word, subdomain.toLowerCase()))
    .limit(1);
  return Boolean(row);
}
