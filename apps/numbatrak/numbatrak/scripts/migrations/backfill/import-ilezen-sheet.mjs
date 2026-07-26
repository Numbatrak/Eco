/**
 * Optional: import historical rows from Test - Ilezen.xlsx (Nuella / CRS1 tabs)
 * into `customer_orders` with source='manual'.
 *
 * Usage (after: npm i xlsx dotenv @supabase/supabase-js):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrations/backfill/import-ilezen-sheet.mjs "./Test - Ilezen.xlsx" <org_uuid>
 *
 * Map CSR names to user IDs in csr_name_aliases first, then resolve csr_id in SQL
 * or extend this script to look up user_profiles.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
async function main() {
  const XLSX = await import("xlsx").then((m) => m.default || m);
  const [filePath, orgId] = process.argv.slice(2);
  if (!filePath || !orgId) {
    console.error("Usage: node import-ilezen-sheet.mjs <xlsx> <organization_id>");
    process.exit(1);
  }
  if (!existsSync(filePath)) {
    console.error("File not found:", filePath);
    process.exit(1);
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  console.log("Sheets:", wb.SheetNames);
  // Template: map sheet rows to customer_orders — adjust columns to your workbook.
  for (const name of ["Nuella", "CRS1"]) {
    if (!wb.SheetNames.includes(name)) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" });
    console.log(name, "rows", rows.length);
    // Example insert shape (uncomment and map columns):
    // await supabase.from("customer_orders").insert({ organization_id: orgId, source: "manual", ... });
  }
  console.log("Done (template). Edit this script to map your columns → customer_orders.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
