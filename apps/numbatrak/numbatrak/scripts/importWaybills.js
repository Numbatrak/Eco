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
  // Try to load from process.env (might be set in shell)
  config();
}

// Load environment variables or use defaults
// Prefer service role key (bypasses RLS) for admin operations like imports
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

// Map of location hints to states
const locationToState = {
  Uyo: "Akwa Ibom",
  Calabar: "Cross River",
  Rivers: "Rivers",
  Enugu: "Enugu",
  Plateau: "Plateau",
  "plateau online": "Plateau",
};

// Map agent names to their states based on location hints
function getAgentState(agentName) {
  if (!agentName) return null;

  // Extract location from parentheses
  const match = agentName.match(/\(([^)]+)\)/);
  if (match) {
    const location = match[1].trim();
    // Check if it's already a state name
    if (locationToState[location]) {
      return locationToState[location];
    }
    // Check if location matches any key (case insensitive)
    for (const [key, state] of Object.entries(locationToState)) {
      if (location.toLowerCase() === key.toLowerCase()) {
        return state;
      }
    }
    // If not found, return the location as-is (might be a state name)
    return location;
  }

  // Some agents might have state in their name
  const nameLower = agentName.toLowerCase();
  for (const [key, state] of Object.entries(locationToState)) {
    if (nameLower.includes(key.toLowerCase())) {
      return state;
    }
  }

  return null;
}

// Parse currency string to number
function parseCurrency(value) {
  if (!value || value.trim() === "") return 0;
  // Remove ₦, commas, and spaces
  const cleaned = value.replace(/[₦,\s]/g, "");
  return parseFloat(cleaned) || 0;
}

// Parse date string "1 Sep 2025" to ISO format
function parseDate(dateStr) {
  if (!dateStr || !dateStr.trim()) {
    throw new Error("Empty date string");
  }

  const months = {
    Jan: "01",
    January: "01",
    Feb: "02",
    February: "02",
    Mar: "03",
    March: "03",
    Apr: "04",
    April: "04",
    May: "05",
    Jun: "06",
    June: "06",
    Jul: "07",
    July: "07",
    Aug: "08",
    August: "08",
    Sep: "09",
    September: "09",
    Oct: "10",
    October: "10",
    Nov: "11",
    November: "11",
    Dec: "12",
    December: "12",
  };

  const parts = dateStr.trim().split(/\s+/);
  if (parts.length < 3) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  const day = parts[0].padStart(2, "0");
  const monthAbbr = parts[1];
  const month = months[monthAbbr] || months[monthAbbr.substring(0, 3)];
  if (!month) {
    throw new Error(`Invalid month: ${monthAbbr} in date: ${dateStr}`);
  }
  const year = parts[2];

  return `${year}-${month}-${day}`;
}

// Parse locations from text field (comma-separated string)
function parseLocations(locations) {
  if (!locations) return [];
  if (Array.isArray(locations)) return locations;
  return locations
    .toString()
    .split(",")
    .map((loc) => loc.trim())
    .filter(Boolean);
}

// Get or create agent
async function getOrCreateAgent(agentName) {
  if (!agentName || agentName.trim() === "") return null;

  const trimmedName = agentName.trim();

  // Check if agent exists
  const { data: agents, error: fetchError } = await supabase
    .from("agents")
    .select("*");

  if (fetchError) {
    throw fetchError;
  }

  const existingAgent = agents.find(
    (a) => a.name.toLowerCase() === trimmedName.toLowerCase()
  );

  if (existingAgent) {
    return existingAgent.id;
  }

  // Create new agent with location
  const state = getAgentState(trimmedName);
  const locations = state ? [state] : [];

  const { data, error } = await supabase
    .from("agents")
    .insert([
      {
        name: trimmedName,
        locations: locations.join(", "),
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  console.log(
    `Created agent: ${trimmedName} with locations: ${locations.join(", ")}`
  );
  return data.id;
}

// Get or create product
async function getOrCreateProduct(productName) {
  if (!productName || productName.trim() === "") return null;

  const trimmedName = productName.trim();

  // Check if product exists
  const { data: products, error: fetchError } = await supabase
    .from("products")
    .select("*");

  if (fetchError) {
    throw fetchError;
  }

  const existingProduct = products.find(
    (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
  );

  if (existingProduct) {
    return existingProduct.id;
  }

  // Create new product
  const { data, error } = await supabase
    .from("products")
    .insert([{ name: trimmedName }])
    .select()
    .single();

  if (error) {
    throw error;
  }

  console.log(`Created product: ${trimmedName}`);
  return data.id;
}

// Parse CSV-like data
function parseWaybillData(data) {
  const lines = data.trim().split("\n");

  const rows = [];

  // Skip header row if it exists
  const startIndex = lines[0]?.toLowerCase().includes("date") ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split by tab
    const values = line.split("\t");
    if (values.length < 8) continue; // At least need date, agent, status, product, quantity, cost

    // Skip rows with empty agent or product
    const agent = values[3]?.trim();
    const product = values[6]?.trim();
    if (!agent || !product) continue;

    // Skip rows with 0 quantity or cost
    const quantity = parseInt(values[7]?.trim() || "0", 10) || 0;
    const cost = parseCurrency(values[8]?.trim() || "0");
    if (quantity === 0 || cost === 0) continue;

    try {
      rows.push({
        date: values[0]?.trim() || "",
        month: values[1]?.trim() || "",
        csr: values[2]?.trim() || "",
        agent: agent,
        supplier: values[4]?.trim() || "",
        status: values[5]?.trim() || "",
        product: product,
        quantity: quantity,
        cost: cost,
        waybillFee: parseCurrency(values[9]?.trim() || "0"),
      });
    } catch (err) {
      console.error(`Error parsing row ${i + 1}:`, err, values);
    }
  }

  return rows;
}

// Import waybill data
async function importWaybillData() {
  // Read the data file
  const dataPath = join(__dirname, "../src/data/waybills-data.txt");
  const fileContent = readFileSync(dataPath, "utf-8");

  const rows = parseWaybillData(fileContent);
  let success = 0;
  let errors = 0;
  const errorsList = [];

  console.log(`Starting import of ${rows.length} rows...`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      // Skip if quantity is 0 or cost is 0
      if (row.quantity === 0 || row.cost === 0) {
        continue;
      }

      // Parse date
      const date = parseDate(row.date);

      // Get or create agent
      const agentId = await getOrCreateAgent(row.agent);
      if (!agentId) {
        errors++;
        errorsList.push(
          `Row ${i + 2}: Could not create/find agent: ${row.agent}`
        );
        continue;
      }

      // Get or create product
      const productId = await getOrCreateProduct(row.product);
      if (!productId) {
        errors++;
        errorsList.push(
          `Row ${i + 2}: Could not create/find product: ${row.product}`
        );
        continue;
      }

      // Validate status
      if (row.status !== "Waybilled" && row.status !== "Delivered") {
        errors++;
        errorsList.push(`Row ${i + 2}: Invalid status: ${row.status}`);
        continue;
      }

      // Create delivery
      const { error: deliveryError } = await supabase
        .from("deliveries")
        .insert([
          {
            date,
            csr: row.csr || null,
            agent_id: agentId,
            status: row.status,
            product_id: productId,
            quantity: row.quantity,
            cost: row.cost,
            waybilling_fee: row.waybillFee || 0,
          },
        ]);

      if (deliveryError) {
        throw deliveryError;
      }

      success++;

      // Log progress every 50 rows
      if ((i + 1) % 50 === 0) {
        console.log(`Processed ${i + 1}/${rows.length} rows...`);
      }
    } catch (err) {
      errors++;
      const errorMsg = err instanceof Error ? err.message : String(err);
      errorsList.push(`Row ${i + 2}: ${errorMsg}`);
      console.error(`Error processing row ${i + 2}:`, err);
    }
  }

  console.log(`\nImport complete!`);
  console.log(`Success: ${success}`);
  console.log(`Errors: ${errors}`);
  if (errorsList.length > 0) {
    console.log("\nFirst 10 errors:");
    errorsList.slice(0, 10).forEach((error) => console.log(`  - ${error}`));
    if (errorsList.length > 10) {
      console.log(`  ... and ${errorsList.length - 10} more errors`);
    }
  }

  return { success, errors, errorsList };
}

// Run the import
importWaybillData()
  .then(() => {
    console.log("\n✅ Import finished!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Import failed:", err);
    process.exit(1);
  });
