import { sql, getTableName, is, Table } from "drizzle-orm";
import { getDb, schema, type Database } from "@platform/db";

type AnyTable = Table<import("drizzle-orm").TableConfig>;

/**
 * Real-Postgres db handle for Tier B tests (anything asserting Better
 * Auth's own internals: organization hooks, permission resolution, TOTP/
 * email-OTP flows) - these have no per-call mock seam, unlike Tier A tests
 * that mock app.auth.api.* wholesale.
 *
 * setup.ts points DATABASE_URL at TEST_DATABASE_URL for the whole test
 * process, so this is just the ordinary getDb() singleton - every module
 * that calls getDb() (routes, ../../lib/auth.ts's drizzleAdapter, this
 * helper) transparently shares the same test database, no separate
 * connection pool or dependency injection needed.
 */
export function getTestDb(): Database {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL is not set - required for Tier B (real-DB) tests.");
  }
  return getDb();
}

/** Truncates every table (CASCADE handles FK ordering). */
export async function truncateAll(): Promise<void> {
  const db = getTestDb();
  const tableNames = (Object.values(schema) as AnyTable[])
    .filter((value) => is(value, Table))
    .map((table) => getTableName(table));
  if (tableNames.length === 0) return;
  await db.execute(sql.raw(`TRUNCATE TABLE ${tableNames.map((n) => `"${n}"`).join(", ")} CASCADE`));
}
