import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
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
  console.error(
    "Error: Supabase URL and Key must be set in environment variables"
  );
  console.error("For imports, use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)");
  console.error("Or set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

if (!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "⚠️  Warning: Using anon key. If you encounter RLS errors, use SUPABASE_SERVICE_ROLE_KEY instead."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse currency string to number
function parseCurrency(value) {
  if (!value || value.trim() === "") return null;
  // Remove ₦, commas, and spaces
  const cleaned = value.replace(/[₦,\s]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// Parse date string "8 May 2025" to ISO format
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === "") return null;
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  } catch {
    // If parsing fails, return null
  }
  return null;
}

// Parse boolean from string
function parseBoolean(value) {
  if (!value) return false;
  const str = String(value).trim().toUpperCase();
  return str === "TRUE" || str === "1" || str === "YES";
}

// Parse integer
function parseInteger(value) {
  if (!value || value.trim() === "") return null;
  const parsed = parseInt(value);
  return isNaN(parsed) ? null : parsed;
}

// Parse CSV line (handles quoted fields with commas)
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Read and parse CSV file
function parseCSV(filePath) {
  const content = readFileSync(filePath, "utf-8");
  // Handle different line endings
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");
  const headers = parseCSVLine(lines[0]);
  
  console.log(`\n📋 CSV Headers (${headers.length} columns):`);
  console.log(headers.join(", "));
  
  const rows = [];
  let skippedRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) {
      console.warn(`⚠️  Row ${i + 1}: Expected ${headers.length} columns, got ${values.length}. Skipping.`);
      skippedRows++;
      if (skippedRows <= 5) {
        console.warn(`   Line: ${lines[i].substring(0, 100)}...`);
      }
      continue;
    }
    const row = {};
    headers.forEach((header, index) => {
      // Preserve the actual value, even if it's empty
      const value = values[index];
      row[header] = value !== undefined ? value : "";
    });
    rows.push(row);
  }

  if (skippedRows > 0) {
    console.warn(`\n⚠️  Skipped ${skippedRows} rows due to column count mismatch`);
  }

  return rows;
}

// Convert CSV row to order data
function csvRowToOrder(row) {
  // Handle both exact column names and variations
  const getValue = (keys) => {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null) {
        const strValue = String(value).trim();
        if (strValue !== "" && strValue.toLowerCase() !== "null") {
          return strValue;
        }
      }
    }
    return null;
  };

  // Get raw value for debugging
  const getRawValue = (keys) => {
    for (const key of keys) {
      if (row.hasOwnProperty(key)) {
        return row[key];
      }
    }
    return undefined;
  };

  const order = {
    customer_name: getValue(["Customer_Name", "customer_name", "Customer Name"]) || "",
    phone_number: getValue(["Phone_number", "phone_number", "Phone Number"]),
    location: getValue(["Location", "location"]),
    order_date: parseDate(getValue(["Order_Date", "order_date", "Order Date"])) || new Date().toISOString().split("T")[0],
    order_month: getValue(["Order_Month", "order_month", "Order Month"]),
    order_year: getValue(["Order_Year", "order_year", "Order Year"]),
    product_name: getValue(["Product_Name", "product_name", "Product Name"]),
    mail_quan: parseInteger(getValue(["Mail_Quan", "mail_quan", "Mail Quan"])),
    agent_quan: parseInteger(getValue(["Agent_Quan", "agent_quan", "Agent Quan"])),
    quantity: parseInteger(getValue(["Quantity", "quantity"])),
    product2: getValue(["Product2", "product2"]),
    mail_quan2: parseInteger(getValue(["Mail_Quan2", "mail_quan2", "Mail Quan2"])),
    agent_quan2: parseInteger(getValue(["Agent_Quan2", "agent_quan2", "Agent Quan2"])),
    quantity2: parseInteger(getValue(["Quantity2", "quantity2"])),
    cost_price: parseCurrency(getValue(["Cost_Price", "cost_price", "Cost Price"])),
    delivery_fee: parseCurrency(getValue(["Delivery_Fee", "delivery_fee", "Delivery Fee"])),
    sales_price: parseCurrency(getValue(["Sales_Price", "sales_price", "Sales Price"])),
    profit: parseCurrency(getValue(["Profit", "profit"])),
    order_status: getValue(["Order_Status", "order_status", "Order Status"]),
    delivery_date: parseDate(getValue(["Delivery_Date", "delivery_date", "Delivery Date"])),
    delivery_month: getValue(["Delivery_Month", "delivery_month", "Delivery Month"]),
    delivery_year: getValue(["Delivery_Year", "delivery_year", "Delivery Year"]),
    confirmed_delivery: parseBoolean(getValue(["Confirmed_Delievery", "Confirmed_Delivery", "confirmed_delivery", "Confirmed Delivery"])),
    agent_name: getValue(["Agent_Name", "agent_name", "Agent Name"]),
    note: getValue(["Note", "note"]),
    subject: getValue(["Subject", "subject"]),
  };

  return order;
}

// Drop orders table (use with caution!)
async function dropOrdersTable() {
  console.log("🗑️  Dropping orders table...");
  const { error } = await supabase.rpc("exec_sql", {
    sql: "DROP TABLE IF EXISTS orders CASCADE;",
  });

  // If RPC doesn't work, try direct query (may require service role key)
  if (error) {
    console.log("⚠️  RPC method failed, trying alternative...");
    // Note: This might not work with anon key, but we'll try
    const { error: dropError } = await supabase
      .from("orders")
      .delete()
      .neq("id", 0); // Delete all records

    if (dropError) {
      console.error("❌ Error dropping orders table:", dropError);
      console.error("💡 You may need to drop the table manually in Supabase SQL Editor:");
      console.error("   DROP TABLE IF EXISTS orders CASCADE;");
      return false;
    }
  }

  console.log("✅ Orders table dropped successfully");
  return true;
}

// Main import function
async function importOrders(csvFilePath, shouldDropTable = false) {
  if (shouldDropTable) {
    await dropOrdersTable();
    // Wait a moment for the table to be dropped
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("📄 Reading CSV file...");
  const rows = parseCSV(csvFilePath);
  console.log(`✅ Parsed ${rows.length} rows from CSV`);

  console.log("🔄 Converting to order format...");
  
  // Log first raw CSV row for debugging
  if (rows.length > 0) {
    console.log("\n📋 First raw CSV row (for debugging):");
    console.log("Headers:", Object.keys(rows[0]));
    console.log("Sample row (first 5 fields):", Object.fromEntries(Object.entries(rows[0]).slice(0, 5)));
  }
  
  const orders = rows.map(csvRowToOrder);
  console.log(`✅ Converted ${orders.length} orders`);

  // Log sample converted order with data analysis
  if (orders.length > 0) {
    const sample = orders[0];
    const fieldsWithData = Object.keys(sample).filter(key => {
      const value = sample[key];
      return value !== null && value !== undefined && value !== "" && value !== false;
    });
    console.log(`\n📊 First order analysis: ${fieldsWithData.length}/${Object.keys(sample).length} fields have data`);
    console.log("Fields with data:", fieldsWithData.join(", "));
    console.log("\n📋 Sample converted order (first order):");
    console.log(JSON.stringify(sample, null, 2));
  }

  // Check if orders table exists and has data
  const { data: existingOrders, error: checkError } = await supabase
    .from("orders")
    .select("id")
    .limit(1);

  if (checkError && checkError.code !== "PGRST116") {
    // PGRST116 is "relation does not exist"
    console.error("❌ Error checking orders table:", checkError);
    console.error(
      "💡 Make sure the 'orders' table exists in your Supabase database."
    );
    console.error(
      "💡 You may need to create it with the following schema:"
    );
    console.error(`
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  phone_number TEXT,
  location TEXT,
  order_date DATE NOT NULL,
  order_month TEXT,
  order_year TEXT,
  product_name TEXT,
  mail_quan INTEGER,
  agent_quan INTEGER,
  quantity INTEGER,
  product2 TEXT,
  mail_quan2 INTEGER,
  agent_quan2 INTEGER,
  quantity2 INTEGER,
  cost_price DECIMAL(10, 2),
  delivery_fee DECIMAL(10, 2),
  sales_price DECIMAL(10, 2),
  profit DECIMAL(10, 2),
  order_status TEXT,
  delivery_date DATE,
  delivery_month TEXT,
  delivery_year TEXT,
  confirmed_delivery BOOLEAN DEFAULT FALSE,
  agent_name TEXT,
  note TEXT,
  subject TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
    `);
    process.exit(1);
  }

  if (existingOrders && existingOrders.length > 0 && !shouldDropTable) {
    console.log(
      "⚠️  Warning: Orders table already contains data. This will add new orders."
    );
  }

  console.log("📤 Inserting orders into database...");
  const batchSize = 100;
  let inserted = 0;
  let errors = 0;
  const errorDetails = [];

  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    
    // Log first order of first batch for debugging
    if (i === 0 && batch.length > 0) {
      console.log("\n📋 First order being inserted (sample):");
      const sampleOrder = batch[0];
      const nonNullFields = Object.keys(sampleOrder).filter(key => {
        const val = sampleOrder[key];
        return val !== null && val !== undefined && val !== "";
      });
      console.log(`   Fields with values: ${nonNullFields.length}/${Object.keys(sampleOrder).length}`);
      console.log(`   Sample: customer_name="${sampleOrder.customer_name}", order_date="${sampleOrder.order_date}", cost_price=${sampleOrder.cost_price}`);
    }
    
    const { data, error } = await supabase
      .from("orders")
      .insert(batch)
      .select();

    if (error) {
      console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
      console.error(`   Batch start index: ${i}, Batch size: ${batch.length}`);
      errorDetails.push({
        batch: Math.floor(i / batchSize) + 1,
        error: error.message,
        startIndex: i,
      });
      errors += batch.length;
      
      // Try inserting one by one to find the problematic record
      if (batch.length > 1) {
        console.log(`   Attempting to insert records individually to identify problem...`);
        for (let j = 0; j < batch.length; j++) {
          const { error: singleError } = await supabase
            .from("orders")
            .insert([batch[j]])
            .select();
          
          if (singleError) {
            console.error(`   ❌ Failed to insert record ${i + j + 1}:`, singleError.message);
            console.error(`   Record data:`, JSON.stringify(batch[j], null, 2));
          } else {
            inserted++;
          }
        }
      }
    } else {
      inserted += data.length;
      console.log(
        `✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(orders.length / batchSize)} (${inserted}/${orders.length} orders)`
      );
    }
  }

  console.log("\n📊 Import Summary:");
  console.log(`   ✅ Successfully inserted: ${inserted} orders`);
  if (errors > 0) {
    console.log(`   ❌ Failed: ${errors} orders`);
    if (errorDetails.length > 0) {
      console.log(`   📋 Error details:`, errorDetails);
    }
  }
  console.log(`   📝 Total processed: ${orders.length} orders`);
  
  if (inserted < orders.length) {
    console.log("\n⚠️  Warning: Not all orders were imported successfully.");
    console.log("   Check the error messages above for details.");
  }
}

// Get CSV file path from command line argument
const csvFilePath = process.argv[2];
const shouldDropTable = process.argv[3] === "--drop";

if (!csvFilePath) {
  console.error("❌ Error: CSV file path is required");
  console.error("Usage: node scripts/importOrders.js <path-to-csv-file> [--drop]");
  console.error(
    "Example: node scripts/importOrders.js '/Users/macbookpro/Downloads/Copy of Test - Ilezen - Nuella.csv' --drop"
  );
  console.error("\n  --drop: Drop the orders table before importing (use with caution!)");
  process.exit(1);
}

if (!existsSync(csvFilePath)) {
  console.error(`❌ Error: File not found: ${csvFilePath}`);
  process.exit(1);
}

// Run import
importOrders(csvFilePath, shouldDropTable)
  .then(() => {
    console.log("\n✅ Import completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Import failed:", error);
    process.exit(1);
  });

