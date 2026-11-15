import fs from "node:fs";
import postgres from "postgres";
import * as schema from "./dist/index.js";
import { getTableConfig } from "drizzle-orm/pg-core";

const url = fs.readFileSync("../../apps/api/.env","utf8").split("\n")
  .map(l=>l.match(/^\s*DATABASE_URL\s*=\s*"?([^"]+)"?/)).find(Boolean)[1];
const sql = postgres(url,{ssl:"require",max:1});

const rows = await sql`select table_name, column_name from information_schema.columns where table_schema='public'`;
const dbCols = new Map();
for (const r of rows) {
  if (!dbCols.has(r.table_name)) dbCols.set(r.table_name, new Set());
  dbCols.get(r.table_name).add(r.column_name);
}

let problems = 0;
for (const [key, value] of Object.entries(schema)) {
  let cfg;
  try { cfg = getTableConfig(value); } catch { continue; }
  if (!cfg?.name) continue;
  const have = dbCols.get(cfg.name);
  if (!have) { console.log(`TABLE MISSING   ${cfg.name}`); problems++; continue; }
  const missing = cfg.columns.map(c => c.name).filter(n => !have.has(n));
  if (missing.length) { console.log(`COLUMNS MISSING ${cfg.name}: ${missing.join(", ")}`); problems++; }
}
console.log(problems === 0 ? "\nNo drift." : `\n${problems} table(s) drifted.`);
await sql.end();
