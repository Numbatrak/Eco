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

async function createMissingProfiles() {
  console.log("🔍 Checking for users without profiles...");

  // Get all auth users
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError) {
    console.error("❌ Error fetching users:", usersError);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log("✅ No users found");
    return;
  }

  console.log(`📋 Found ${users.length} user(s)`);

  // Get all existing profiles
  const { data: existingProfiles, error: profilesError } = await supabase
    .from("user_profiles")
    .select("id");

  if (profilesError) {
    // Table might not exist
    if (profilesError.code === "PGRST116" || profilesError.code === "42P01") {
      console.error("❌ user_profiles table does not exist!");
      console.error("💡 Please run the setupRolesAndPermissions.sql script first");
      process.exit(1);
    }
    console.error("❌ Error fetching profiles:", profilesError);
    process.exit(1);
  }

  const existingProfileIds = new Set(existingProfiles?.map((p) => p.id) || []);

  // Find users without profiles
  const usersWithoutProfiles = users.filter((user) => !existingProfileIds.has(user.id));

  if (usersWithoutProfiles.length === 0) {
    console.log("✅ All users already have profiles");
    return;
  }

  console.log(`📝 Found ${usersWithoutProfiles.length} user(s) without profiles`);

  // Create profiles for missing users
  const profilesToCreate = usersWithoutProfiles.map((user) => ({
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || user.email || "User",
    role: "Customer Relations", // Default role
  }));

  console.log("📤 Creating profiles...");
  const { data, error } = await supabase
    .from("user_profiles")
    .insert(profilesToCreate)
    .select();

  if (error) {
    console.error("❌ Error creating profiles:", error);
    process.exit(1);
  }

  console.log(`✅ Successfully created ${data.length} profile(s)`);
  console.log("\n📊 Created profiles:");
  data.forEach((profile) => {
    console.log(`   - ${profile.email} (${profile.role})`);
  });
}

createMissingProfiles()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });








