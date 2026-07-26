import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, "..", ".env");
const envLocalPath = join(__dirname, "..", ".env.local");

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  config({ path: envPath });
} else {
  config();
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Supabase URL and Key must be set in environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrdersData() {
  console.log("🔍 Checking orders data in database...\n");

  // Get total count
  const { count, error: countError } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("❌ Error checking orders:", countError);
    process.exit(1);
  }

  console.log(`📊 Total orders in database: ${count || 0}\n`);

  if (count === 0) {
    console.log("⚠️  No orders found in database.");
    return;
  }

  // Get a few sample orders
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .limit(5);

  if (error) {
    console.error("❌ Error fetching orders:", error);
    process.exit(1);
  }

  if (!orders || orders.length === 0) {
    console.log("⚠️  No orders found.");
    return;
  }

  console.log(`📋 Analyzing ${orders.length} sample order(s):\n`);

  orders.forEach((order, index) => {
    console.log(`\n--- Order ${index + 1} (ID: ${order.id}) ---`);
    
    const fieldsWithData = [];
    const fieldsWithoutData = [];
    
    Object.keys(order).forEach((key) => {
      const value = order[key];
      if (value !== null && value !== undefined && value !== "" && value !== false) {
        fieldsWithData.push(key);
      } else {
        fieldsWithoutData.push(key);
      }
    });

    console.log(`✅ Fields with data (${fieldsWithData.length}):`, fieldsWithData.join(", "));
    console.log(`❌ Fields without data (${fieldsWithoutData.length}):`, fieldsWithoutData.join(", "));
    
    // Show key fields
    console.log("\nKey fields:");
    console.log(`  Customer Name: "${order.customer_name || "—"}"`);
    console.log(`  Phone: "${order.phone_number || "—"}"`);
    console.log(`  Location: "${order.location || "—"}"`);
    console.log(`  Order Date: "${order.order_date || "—"}"`);
    console.log(`  Product: "${order.product_name || "—"}"`);
    console.log(`  Quantity: ${order.quantity ?? "—"}`);
    console.log(`  Cost Price: ${order.cost_price ?? "—"}`);
    console.log(`  Sales Price: ${order.sales_price ?? "—"}`);
    console.log(`  Status: "${order.order_status || "—"}"`);
    console.log(`  Agent: "${order.agent_name || "—"}"`);
  });

  // Check column names in database
  console.log("\n\n📋 Database column names:");
  if (orders.length > 0) {
    console.log(Object.keys(orders[0]).join(", "));
  }

  console.log("\n\n💡 If you see mostly empty fields, the data wasn't imported correctly.");
  console.log("💡 Try re-running the import script: node scripts/importOrders.js <csv-file>");
}

checkOrdersData()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });








