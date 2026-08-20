/**
 * Schema-only database initialization.
 *
 * Applies every migration in ./drizzle (in order, tracked via drizzle's
 * __drizzle_migrations table) to DATABASE_URL, creating all tables -
 * including the numbatrak_* ones - with no data. Safe to re-run: already
 * applied migrations are skipped.
 *
 * This does NOT copy any Numbatrak data - for that, see
 * scripts/migrate-numbatrak.ts, which requires SOURCE_DATABASE_URL.
 *
 * Run: pnpm --filter @platform/db db:init
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

async function main(): Promise<void> {
  console.log("Applying migrations from ./drizzle ...");
  const start = Date.now();
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log(`Done in ${Date.now() - start}ms.`);
}

main()
  .catch((err) => {
    console.error("Database initialization failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
