// Interactive CLI for creating a platform-admin account - the only way to
// create one (no public signup endpoint, see plugins/platform-admin-better-auth.ts).
// Run: pnpm --filter @platform/api create-admin-account
//
// Plain-text password entry (no masking) - node:readline has no built-in
// hidden-input mode without raw-mode terminal hacks, and this is a
// trusted-operator-only, local-machine tool, not a network-facing form.
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { platformAdminAuth } from "../lib/platform-admin-auth.js";

function deriveName(email: string): string {
  return email.split("@")[0] || "Platform Admin";
}

async function main(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const email = (await rl.question("Admin email: ")).trim();
    const password = await rl.question("Admin password (min 12 characters): ");
    if (password.length < 12) {
      console.error("Password must be at least 12 characters.");
      process.exitCode = 1;
      return;
    }

    console.log("\nCreating account...");
    const signUpResult = await platformAdminAuth.api.signUpEmail({
      body: { email, password, name: deriveName(email) },
      asResponse: true,
    });
    if (!signUpResult.ok) {
      const body: unknown = await signUpResult.json().catch(() => null);
      const message =
        body && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? body.message
          : signUpResult.statusText;
      console.error(`Failed to create account: ${message}`);
      process.exitCode = 1;
      return;
    }

    console.log("\n" + "=".repeat(60));
    console.log("Platform-admin account created successfully.");
    console.log("=".repeat(60));
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    console.log("=".repeat(60));
  } finally {
    rl.close();
  }
}

main().catch((error: unknown) => {
  console.error("create-admin-account failed:", error);
  process.exitCode = 1;
});
