import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@platform/db";

/**
 * Fully isolated Better Auth instance for platform admins — the platform
 * owner (and later, possibly a small trusted staff). No `organization`
 * plugin (no multi-tenancy concept for platform staff).
 *
 * Isolation from the tenant-member instance (../lib/auth.ts), on the same
 * Postgres database and Fastify server:
 *  - separate tables (platform_admin_user/session/account/verification
 *    in packages/db/src/platform-admin-auth-schema.ts)
 *  - separate session cookie name via `advanced.cookiePrefix`
 *  - separate HTTP mount path via `basePath`, bridged by
 *    ../plugins/platform-admin-better-auth.ts (which also blocks the public
 *    sign-up endpoint — accounts are CLI-only)
 */
export const platformAdminAuth = betterAuth({
  basePath: "/platform-admin/auth",
  database: drizzleAdapter(getDb(), { provider: "pg" }),
  secret: process.env.PLATFORM_ADMIN_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET,
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
  plugins: [],
});
