import { supabase } from "../supabaseClient";
import { createAgent, fetchAgents } from "../services/agents";
import { createProduct, fetchProducts } from "../services/products";
import { intakeDeliveryRecord } from "../services/waybillIntake";

// Map of location hints to states
const locationToState: Record<string, string> = {
  "Uyo": "Akwa Ibom",
  "Calabar": "Cross River",
  "Rivers": "Rivers",
  "Enugu": "Enugu",
  "Plateau": "Plateau",
  "plateau online": "Plateau",
};

// Map agent names to their states based on location hints
function getAgentState(agentName: string): string | null {
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
function parseCurrency(value: string): number {
  if (!value || value.trim() === "") return 0;
  // Remove ₦, commas, and spaces
  const cleaned = value.replace(/[₦,\s]/g, "");
  return parseFloat(cleaned) || 0;
}

// Parse date string "1 Sep 2025" to ISO format
function parseDate(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) {
    throw new Error("Empty date string");
  }
  
  const months: Record<string, string> = {
    "Jan": "01", "January": "01",
    "Feb": "02", "February": "02",
    "Mar": "03", "March": "03",
    "Apr": "04", "April": "04",
    "May": "05",
    "Jun": "06", "June": "06",
    "Jul": "07", "July": "07",
    "Aug": "08", "August": "08",
    "Sep": "09", "September": "09",
    "Oct": "10", "October": "10",
    "Nov": "11", "November": "11",
    "Dec": "12", "December": "12"
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

interface WaybillRow {
  date: string;
  month: string;
  csr: string;
  agent: string;
  supplier: string;
  status: string;
  product: string;
  quantity: number;
  cost: number;
  waybillFee: number;
}

// Parse CSV-like data
function parseWaybillData(data: string): WaybillRow[] {
  const lines = data.trim().split("\n");
  
  const rows: WaybillRow[] = [];
  
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

// Get or create agent
async function getOrCreateAgent(
  organizationId: string,
  agentName: string
): Promise<number | null> {
  if (!agentName || agentName.trim() === "") return null;
  
  const trimmedName = agentName.trim();
  
  // Check if agent exists
  const agents = await fetchAgents(organizationId);
  const existingAgent = agents.find(
    (a) => a.name.toLowerCase() === trimmedName.toLowerCase()
  );
  
  if (existingAgent) {
    return existingAgent.id;
  }
  
  // Create new agent with location
  const state = getAgentState(trimmedName);
  const locations = state ? [state] : [];
  
  try {
    const newAgent = await createAgent({
      name: trimmedName,
      locations,
      organization_id: organizationId,
    });
    console.log(`Created agent: ${trimmedName} with locations: ${locations.join(", ")}`);
    return newAgent.id;
  } catch (err) {
    console.error(`Error creating agent ${trimmedName}:`, err);
    return null;
  }
}

// Get or create product
async function getOrCreateProduct(
  organizationId: string,
  productName: string
): Promise<string | null> {
  if (!productName || productName.trim() === "") return null;
  
  const trimmedName = productName.trim();
  
  // Check if product exists
  const products = await fetchProducts(organizationId);
  const existingProduct = products.find(
    (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
  );
  
  if (existingProduct) {
    return existingProduct.id;
  }
  
  // Create new product
  try {
    const newProduct = await createProduct({
      name: trimmedName,
      organization_id: organizationId,
      base_price: 0,
      cost_price: 0,
    });
    console.log(`Created product: ${trimmedName}`);
    return newProduct.id;
  } catch (err) {
    console.error(`Error creating product ${trimmedName}:`, err);
    return null;
  }
}

// Import waybill data
export async function importWaybillData(
  organizationId: string,
  data: string
): Promise<{
  success: number;
  errors: number;
  errorsList: string[];
}> {
  const rows = parseWaybillData(data);
  let success = 0;
  let errors = 0;
  const errorsList: string[] = [];
  
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
      const agentId = await getOrCreateAgent(organizationId, row.agent);
      if (!agentId) {
        errors++;
        errorsList.push(`Row ${i + 2}: Could not create/find agent: ${row.agent}`);
        continue;
      }
      
      // Get or create product
      const productId = await getOrCreateProduct(organizationId, row.product);
      if (!productId) {
        errors++;
        errorsList.push(`Row ${i + 2}: Could not create/find product: ${row.product}`);
        continue;
      }
      
      // Validate status
      if (row.status !== "Waybilled" && row.status !== "Delivered") {
        errors++;
        errorsList.push(`Row ${i + 2}: Invalid status: ${row.status}`);
        continue;
      }
      
      // Create delivery (Waybilled → stock + fee expense; Delivered → balance record only)
      await intakeDeliveryRecord({
        date,
        csr: row.csr || null,
        agent_id: agentId,
        status: row.status as "Waybilled" | "Delivered",
        product_id: productId,
        quantity: row.quantity,
        cost: row.cost,
        waybilling_fee: row.waybillFee || 0,
        organization_id: organizationId,
      });
      
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
  
  console.log(`Import complete! Success: ${success}, Errors: ${errors}`);
  if (errorsList.length > 0) {
    console.log("Errors:", errorsList.slice(0, 10)); // Show first 10 errors
  }
  
  return { success, errors, errorsList };
}

