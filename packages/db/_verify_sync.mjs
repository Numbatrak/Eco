import postgres from "postgres";

const prodUrl =
  "postgresql://neondb_owner:npg_dO4BEbiJ7CWI@ep-shy-resonance-axmk2imy-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require";

const sql = postgres(prodUrl, { prepare: false, connect_timeout: 10 });
try {
  const rows = await sql`
    select id, source, status, customer_name, phone_number, order_revenue, order_cost, delivery_fee, profit, notes, agent_id, csr_id, created_at
    from numbatrak_customer_orders
    where source = 'storefront'
    order by created_at desc
    limit 5
  `;
  console.log(`found ${rows.length} storefront-sourced numbatrak orders`);
  for (const r of rows) {
    console.log("---", r.created_at, "---");
    console.log(JSON.stringify(r, null, 2));
  }
} catch (e) {
  console.log("ERROR:", e.message);
} finally {
  await sql.end();
}
