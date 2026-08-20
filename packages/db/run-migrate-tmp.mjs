import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(sql);

const start = Date.now();
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied successfully in", Date.now() - start, "ms");
} catch (e) {
  console.error("MIGRATION ERROR:", e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
