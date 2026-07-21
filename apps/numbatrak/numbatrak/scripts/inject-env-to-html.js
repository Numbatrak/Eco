#!/usr/bin/env node
/**
 * Script to inject environment variables from .env into HTML test files
 * Usage: node scripts/inject-env-to-html.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file
const envPath = path.join(__dirname, "..", ".env");
const envContent = fs.readFileSync(envPath, "utf-8");

// Parse .env file
const envVars = {};
envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join("=").trim();
    }
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL || "";
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env file",
  );
  process.exit(1);
}

// Update test-form-local.html
const localHtmlPath = path.join(__dirname, "..", "test-form-local.html");
let localHtml = fs.readFileSync(localHtmlPath, "utf-8");

localHtml = localHtml.replace(
  /window\.CRM_SUPABASE_URL\s*=\s*['"][^'"]*['"]/,
  `window.CRM_SUPABASE_URL = '${supabaseUrl}'`,
);

localHtml = localHtml.replace(
  /window\.CRM_SUPABASE_ANON_KEY\s*=\s*['"][^'"]*['"]/,
  `window.CRM_SUPABASE_ANON_KEY = '${supabaseAnonKey}'`,
);

fs.writeFileSync(localHtmlPath, localHtml, "utf-8");
console.log("✅ Updated test-form-local.html with values from .env");

// Update test-form-production.html
const prodHtmlPath = path.join(__dirname, "..", "test-form-production.html");
let prodHtml = fs.readFileSync(prodHtmlPath, "utf-8");

prodHtml = prodHtml.replace(
  /window\.CRM_SUPABASE_URL\s*=\s*['"][^'"]*['"]/,
  `window.CRM_SUPABASE_URL = '${supabaseUrl}'`,
);

prodHtml = prodHtml.replace(
  /window\.CRM_SUPABASE_ANON_KEY\s*=\s*['"][^'"]*['"]/,
  `window.CRM_SUPABASE_ANON_KEY = '${supabaseAnonKey}'`,
);

fs.writeFileSync(prodHtmlPath, prodHtml, "utf-8");
console.log("✅ Updated test-form-production.html with values from .env");

console.log(
  "\n📝 Both HTML files have been updated with Supabase credentials from .env",
);
