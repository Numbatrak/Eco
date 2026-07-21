import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

// Validate Supabase URL format
if (!supabaseUrl.startsWith("https://") || !supabaseUrl.includes(".supabase.co")) {
  console.warn(
    `Warning: Supabase URL format looks incorrect: ${supabaseUrl}. Expected format: https://xxxxx.supabase.co`
  );
}

// Create Supabase client with optimized settings
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
  db: {
    schema: "public",
  },
  global: {
    headers: {
      "x-client-info": "numbatrak@1.0.0",
    },
  },
});










