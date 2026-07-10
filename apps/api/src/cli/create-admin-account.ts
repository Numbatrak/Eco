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

function extractCookieHeader(setCookies: string[]): Headers {
  return new Headers({ cookie: setCookies.map((c) => c.split(";")[0]).join("; ") });
}

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
    const sessionHeaders = extractCookieHeader(signUpResult.headers.getSetCookie());
    console.log("Account created. Enrolling TOTP two-factor authentication (mandatory)...\n");

    const { totpURI, backupCodes } = await platformAdminAuth.api.enableTwoFactor({
      body: { password },
      headers: sessionHeaders,
    });

    const secret = new URL(totpURI).searchParams.get("secret") ?? "(unable to parse secret)";
    console.log("Scan this URI with your authenticator app, or enter the secret manually:\n");
    console.log(`  otpauth URI: ${totpURI}`);
    console.log(`  Manual-entry secret: ${secret}\n`);

    let confirmed = false;
    while (!confirmed) {
      const code = (await rl.question("Enter the 6-digit code from your authenticator app: ")).trim();
      try {
        await platformAdminAuth.api.verifyTOTP({ body: { code }, headers: sessionHeaders });
        confirmed = true;
      } catch {
        console.error("Invalid code, please try again.\n");
      }
    }

    console.log("\nTwo-factor authentication enabled. This account is now fully usable.\n");
    console.log("=".repeat(60));
    console.log("BACKUP CODES - store these somewhere safe now.");
    console.log("They will NOT be shown again after this script exits.");
    console.log("=".repeat(60));
    for (const code of backupCodes) {
      console.log(`  ${code}`);
    }
    console.log("=".repeat(60));
  } finally {
    rl.close();
  }
}

main().catch((error: unknown) => {
  console.error("create-admin-account failed:", error);
  process.exitCode = 1;
});
