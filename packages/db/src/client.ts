import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { schema } from "./schema.js";

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
    }
    const client = postgres(connectionString);
    _db = drizzle(client, { schema });
  }
  return _db;
}

export type Database = ReturnType<typeof getDb>;

/** The `tx` handle passed into `db.transaction(async (tx) => ...)` - a
 * structurally narrower type than `Database` (no `$client`), needed by any
 * helper function that must run identically whether called standalone or
 * inside a caller's transaction (e.g. FIFO lot consumption that has to be
 * part of the same atomic unit as the rest of an order insert). */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Accepts either a plain `Database` handle or an in-progress `Transaction`. */
export type Queryable = Database | Transaction;
