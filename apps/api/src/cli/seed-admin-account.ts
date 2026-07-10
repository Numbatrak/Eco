/**
 * Non-interactive platform-admin account creator. Reads email/password from
 * argv (or env), creates the account, enables mandatory TOTP 2FA, and prints
 * the otpauth URI + backup codes. Use ONE backup code to log in for the
 * first time, then scan the otpauth URI into an authenticator app for future
 * logins.
 *
 * Run: pnpm --filter @platform/api seed-admin -- <email> <password>
 * Or:  ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @platform/api seed-admin
 */
import { authenticator } from "otplib";
import { platformAdminAuth } from "../lib/platform-admin-auth.js";

function extractCookieHeader(setCookies: string[]): Headers {
  return new Headers({ cookie: setCookies.map((c) => c.split(";")[0]).join("; ") });
}

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
  const sessionHeaders = extractCookieHeader(signUpResult.headers.getSetCookie());
  console.log("Account created. Enrolling TOTP 2FA (mandatory)...");

  const { totpURI, backupCodes } = await platformAdminAuth.api.enableTwoFactor({
    body: { password },
    headers: sessionHeaders,
  });
  const secret = new URL(totpURI).searchParams.get("secret") ?? "(unable to parse secret)";

  // Confirm TOTP by generating the current code ourselves — otplib uses the
  // same algorithm/period/digits as Better Auth's default TOTP config, so the
  // code we produce here matches what an authenticator app would show at this
  // instant. This finishes enrollment without needing an interactive tty.
  const code = authenticator.generate(secret);
  await platformAdminAuth.api.verifyTOTP({ body: { code }, headers: sessionHeaders });

  console.log("\n" + "=".repeat(64));
  console.log("Platform-admin account is ready. SAVE THESE — shown only once.");
  console.log("=".repeat(64));
  console.log(`  Email:            ${email}`);
  console.log(`  Password:         ${password}`);
  console.log(`  TOTP secret:      ${secret}`);
  console.log(`  otpauth URI:      ${totpURI}`);
  console.log("");
  console.log("  Backup codes (each usable once — use one to log in the first time):");
  for (const c of backupCodes) console.log(`    ${c}`);
  console.log("=".repeat(64));
}

main().catch((error: unknown) => {
  console.error("seed-admin failed:", error);
  process.exitCode = 1;
});
