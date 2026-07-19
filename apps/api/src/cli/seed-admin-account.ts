/**
 * Non-interactive platform-admin account creator. Reads email/password from
 * argv (or env), creates the account, and prints the credentials.
 *
 * Run: pnpm --filter @platform/api seed-admin -- <email> <password>
 * Or:  ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @platform/api seed-admin
 */
import { platformAdminAuth } from "../lib/platform-admin-auth.js";

function deriveName(email: string): string {
  return email.split("@")[0] || "Platform Admin";
}

async function main(): Promise<void> {
  const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? "").trim();
  const password = process.argv[3] ?? process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 12) {
    console.error("Usage: seed-admin <email> <password>  (password >= 12 chars)");
    process.exitCode = 1;
    return;
  }

  console.log(`Creating platform-admin account for ${email}...`);
  const signUpResult = await platformAdminAuth.api.signUpEmail({
    body: { email, password, name: deriveName(email) },
    asResponse: true,
  });
  if (!signUpResult.ok) {
    const body = (await signUpResult.json().catch(() => null)) as { message?: string } | null;
    console.error(`Failed to create account: ${body?.message ?? signUpResult.statusText}`);
    process.exitCode = 1;
    return;
  }

  console.log("\n" + "=".repeat(64));
  console.log("Platform-admin account is ready.");
  console.log("=".repeat(64));
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log("=".repeat(64));
}

main().catch((error: unknown) => {
  console.error("seed-admin failed:", error);
  process.exitCode = 1;
});
