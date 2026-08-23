import type { FastifyBaseLogger } from "fastify";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, twoFactor } from "better-auth/plugins";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { sql } from "drizzle-orm";
import { getDb } from "@platform/db";
import { ac, orgRoles } from "./access-control.js";
import { isReservedSubdomain, isValidSubdomainFormat } from "../modules/sites/lib/subdomain.js";
import { sendEmail } from "../modules/auth/lib/email.js";
import { passwordResetEmail, otpEmail } from "./email-templates.js";
import { logSecurityEvent, type SecurityEventType } from "../modules/auth/lib/security-events.js";

/**
 * Minimal console-backed logger so this module (and the `@better-auth/cli
 * generate` step, which imports it standalone) doesn't need a running
 * Fastify instance just to construct the auth config. `sendEmail` only ever
 * calls `.info`.
 */
const authLogger = {
  info: (obj: unknown, msg?: string) => console.log(msg ?? "", obj),
} as unknown as FastifyBaseLogger;

/**
 * Raw SQL rather than the generated `member` table import: this file has to
 * exist (and be importable standalone) before `@better-auth/cli generate`
 * has produced that table, so it can't depend on it.
 */
// db.execute() on the postgres-js driver returns the row array directly
// (not wrapped in { rows: [...] } the way the node-postgres driver does).
type RawRows<T> = T[];

async function countOwners(organizationId: string): Promise<number> {
  const db = getDb();
  const result = (await db.execute(
    sql`select count(*)::int as count from "member" where "organization_id" = ${organizationId} and "role" = 'owner'`,
  )) as unknown as RawRows<{ count: number }>;
  return Number(result[0]?.count ?? 0);
}

async function findMemberById(
  memberId: string,
): Promise<{ organizationId: string; role: string } | null> {
  const db = getDb();
  const result = (await db.execute(
    sql`select "organization_id", "role" from "member" where "id" = ${memberId} limit 1`,
  )) as unknown as RawRows<{ organization_id: string; role: string }>;
  const row = result[0];
  return row ? { organizationId: row.organization_id, role: row.role } : null;
}

/** /organization/remove-member accepts either a member id or the member's email. */
async function findMemberByIdOrEmail(
  memberIdOrEmail: string,
  organizationId: string | undefined,
): Promise<{ organizationId: string; role: string } | null> {
  if (!memberIdOrEmail.includes("@")) {
    return findMemberById(memberIdOrEmail);
  }
  if (!organizationId) return null;
  const db = getDb();
  const result = (await db.execute(
    sql`select m."organization_id", m."role" from "member" m
        join "user" u on u."id" = m."user_id"
        where u."email" = ${memberIdOrEmail} and m."organization_id" = ${organizationId} limit 1`,
  )) as unknown as RawRows<{ organization_id: string; role: string }>;
  const row = result[0];
  return row ? { organizationId: row.organization_id, role: row.role } : null;
}

async function findMemberRole(organizationId: string, userId: string): Promise<string | null> {
  const db = getDb();
  const result = (await db.execute(
    sql`select "role" from "member" where "organization_id" = ${organizationId} and "user_id" = ${userId} limit 1`,
  )) as unknown as RawRows<{ role: string }>;
  return result[0]?.role ?? null;
}

const betterAuthUrl =
  process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: "pg" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: betterAuthUrl,
  // TODO: temporary - deployed env vars aren't picking up domain changes yet,
  // so trust any origin instead of checking against PUBLIC_APP_URL/
  // STOREFRONT_APP_URL/NUMBATRAK_APP_URL. Revert once that's sorted out.
  trustedOrigins: ["*"],
  // Numbatrak (apps/numbatrak) is a standalone SPA that calls this API
  // genuinely cross-site (different registrable domain, e.g. localhost
  // during local frontend dev against a deployed API, or numbatrak.io vs
  // numbatrak.com in production) - the default SameSite=Lax session cookie
  // is never attached to those fetch()/XHR calls, so /auth/me always 401s
  // even right after a successful login. SameSite=None requires Secure,
  // which requires HTTPS, so only opt in when the API itself is served over
  // HTTPS - local http://localhost-to-http://localhost dev is same-site
  // already (SameSite only compares scheme+host, not port) and keeps
  // working under the Lax default. `partitioned` (CHIPS) is required
  // alongside SameSite=None because Chrome now blocks unpartitioned
  // cross-site cookies by default - without it the browser silently drops
  // the cookie (visible as `sec-fetch-storage-access: none` on requests)
  // and /auth/me 401s even though CORS and the cookie itself are correct.
  advanced: betterAuthUrl.startsWith("https://")
    ? { defaultCookieAttributes: { sameSite: "none", secure: true, partitioned: true } }
    : undefined,
  emailAndPassword: {
    enabled: true,
    // Matches today's actual behavior - the old login.ts never checked
    // emailVerifiedAt, verification was presentational-only.
    requireEmailVerification: false,
    async sendResetPassword({ user, token }: { user: { email: string }; token: string }) {
      // Link straight to the SPA's own /reset-password?token=... route rather
      // than Better Auth's generated `url` (which points at the backend's
      // GET /api/auth/reset-password/:token redirect-callback endpoint,
      // useful when a callbackURL is configured but not otherwise).
      // Store-owner reset flow lives under the storefront's /dashboard, not
      // the platform-admin console.
      const appUrl = process.env.STOREFRONT_APP_URL ?? "http://localhost:3000";
      const resetUrl = `${appUrl}/dashboard/reset-password?token=${encodeURIComponent(token)}`;
      await sendEmail(authLogger, {
        to: user.email,
        subject: "Reset your password",
        body: passwordResetEmail(resetUrl),
      });
    },
  },
  plugins: [
    organization({
      ac,
      roles: orgRoles,
      organizationHooks: {
        async beforeCreateOrganization({ organization: org }) {
          const slug = org.slug;
          if (typeof slug !== "string" || !isValidSubdomainFormat(slug)) {
            throw new APIError("BAD_REQUEST", { message: "Invalid subdomain format" });
          }
          if (await isReservedSubdomain(getDb(), slug)) {
            throw new APIError("CONFLICT", { message: "This subdomain is reserved" });
          }
          // organization.slug only has a case-sensitive unique constraint at
          // the DB level (unlike the old tenants_subdomain_unique_idx on
          // lower(subdomain)) - normalize here so uniqueness is effectively
          // case-insensitive too.
          return { data: { ...org, slug: slug.toLowerCase() } };
        },
        async beforeUpdateOrganization({ organization: data }) {
          if (data.slug === undefined) return;
          const slug = data.slug;
          if (typeof slug !== "string" || !isValidSubdomainFormat(slug)) {
            throw new APIError("BAD_REQUEST", { message: "Invalid subdomain format" });
          }
          if (await isReservedSubdomain(getDb(), slug)) {
            throw new APIError("CONFLICT", { message: "This subdomain is reserved" });
          }
          return { data: { ...data, slug: slug.toLowerCase() } };
        },
        async beforeRemoveMember({ member }) {
          if (member.role !== "owner") return;
          const ownerCount = await countOwners(member.organizationId);
          if (ownerCount <= 1) {
            throw new APIError("FORBIDDEN", {
              message: "An organization must retain at least one owner",
            });
          }
        },
        async beforeUpdateMemberRole({ member, newRole }) {
          if (member.role !== "owner" || newRole === "owner") return;
          const ownerCount = await countOwners(member.organizationId);
          if (ownerCount <= 1) {
            throw new APIError("FORBIDDEN", {
              message: "An organization must retain at least one owner",
            });
          }
        },
      },
    }),
    twoFactor({
      issuer: process.env.PUBLIC_APP_URL ?? "Platform",
      totpOptions: { digits: 6, period: 30 },
      otpOptions: {
        period: 5,
        allowedAttempts: 5,
        storeOTP: "encrypted",
        async sendOTP({ user, otp }) {
          await sendEmail(authLogger, {
            to: user.email,
            subject: "Your verification code",
            body: otpEmail(otp),
          });
        },
      },
      backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: "encrypted" },
    }),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Actor-aware guard: the organization plugin's beforeRemoveMember /
      // beforeUpdateMemberRole hooks receive the *target* member/user, not
      // the caller, so "only an owner can remove/demote another owner" has
      // to be enforced here instead, where the session (the caller) is
      // still available on ctx.
      if (ctx.path !== "/organization/remove-member" && ctx.path !== "/organization/update-member-role") {
        return;
      }
      const session = await getSessionFromCtx(ctx);
      if (!session) return;
      const body = ctx.body as
        | { memberId?: string; memberIdOrEmail?: string; organizationId?: string }
        | undefined;
      const target = body?.memberId
        ? await findMemberById(body.memberId)
        : body?.memberIdOrEmail
          ? await findMemberByIdOrEmail(body.memberIdOrEmail, body.organizationId)
          : null;
      if (!target || target.role !== "owner") return;
      const actorRole = await findMemberRole(target.organizationId, session.user.id);
      if (actorRole !== "owner") {
        throw new APIError("FORBIDDEN", {
          message: "Only an owner can remove or change the role of another owner",
        });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const twoFactorEvents: Record<string, SecurityEventType> = {
        "/two-factor/enable": "2fa_enabled",
        "/two-factor/disable": "2fa_disabled",
        "/two-factor/verify-totp": "2fa_verified",
        "/two-factor/verify-otp": "2fa_verified",
        "/two-factor/verify-backup-code": "backup_code_used",
        "/two-factor/generate-backup-codes": "backup_codes_regenerated",
      };
      const eventType = twoFactorEvents[ctx.path];
      if (!eventType) return;

      const db = getDb();
      const headers = ctx.headers as Headers | undefined;
      const ip = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
      const userAgent = headers?.get("user-agent") ?? undefined;

      let userId: string | undefined;
      const session = await getSessionFromCtx(ctx).catch(() => null);
      if (session) {
        userId = session.user.id;
      } else {
        const body = ctx.context?.returned as { user?: { id?: string } } | undefined;
        userId = body?.user?.id;
      }

      await logSecurityEvent(db, { userId, eventType, ip, userAgent }).catch(() => {});
    }),
  },
});
