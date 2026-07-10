import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { getDb } from "@platform/db";

/**
 * Third, fully isolated Better Auth instance for platform admins - the
 * platform owner (and later, possibly a small trusted staff), a distinct
 * actor type from tenant members and storefront shoppers. No `organization`
 * plugin (no multi-tenancy concept for platform staff), `twoFactor` only.
 *
 * Isolation from the tenant-member instance (../lib/auth.ts), on the same
 * Postgres database and Fastify server:
 *  - separate tables (platform_admin_user/session/account/verification/
 *    two_factor in packages/db/src/platform-admin-auth-schema.ts), never
 *    shared rows with user/session/account/verification/twoFactor
 *  - separate session cookie name via `advanced.cookiePrefix`
 *  - separate HTTP mount path via `basePath`, bridged by
 *    ../plugins/platform-admin-better-auth.ts (which also blocks the public
 *    sign-up endpoint - accounts are CLI-only, see ../cli/create-admin-account.ts)
 */
export const platformAdminAuth = betterAuth({
  basePath: "/platform-admin/auth",
  database: drizzleAdapter(getDb(), { provider: "pg" }),
  baseURL: process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3001}`,
  trustedOrigins: [process.env.PUBLIC_APP_URL ?? "http://localhost:3002"],
  advanced: {
    cookiePrefix: "platform_admin",
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: { modelName: "platformAdminUser" },
  session: { modelName: "platformAdminSession" },
  account: { modelName: "platformAdminAccount" },
  verification: { modelName: "platformAdminVerification" },
  plugins: [
    twoFactor({
      issuer: process.env.PUBLIC_APP_URL ?? "Platform Admin",
      totpOptions: { digits: 6, period: 30 },
      backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: "encrypted" },
      schema: { twoFactor: { modelName: "platformAdminTwoFactor" } },
    }),
  ],
});
