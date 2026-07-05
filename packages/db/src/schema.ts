import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------- enums ----------

export const tenantMemberRoleEnum = pgEnum("tenant_member_role", ["owner", "admin", "member"]);

export const preferred2faMethodEnum = pgEnum("preferred_2fa_method", ["totp", "email_otp"]);

export const securityEventTypeEnum = pgEnum("security_event_type", [
  "login_success",
  "login_failed",
  "2fa_challenge_issued",
  "2fa_verified",
  "2fa_failed",
  "2fa_enabled",
  "2fa_disabled",
  "backup_code_used",
  "backup_codes_regenerated",
  "password_reset_requested",
  "password_reset_completed",
  "sessions_revoked",
]);

// ---------- tenants ----------

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- users ----------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    totpSecretEncrypted: text("totp_secret_encrypted"),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    emailOtpEnabledAt: timestamp("email_otp_enabled_at", { withTimezone: true }),
    preferred2faMethod: preferred2faMethodEnum("preferred_2fa_method"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique_idx").on(sql`lower(${table.email})`)],
);

// ---------- tenant_members ----------

export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: tenantMemberRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tenant_members_tenant_user_unique_idx").on(table.tenantId, table.userId),
    index("tenant_members_user_idx").on(table.userId),
  ],
);

// ---------- refresh_tokens ----------

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("refresh_tokens_user_idx").on(table.userId),
    uniqueIndex("refresh_tokens_token_hash_unique_idx").on(table.tokenHash),
  ],
);

// ---------- backup_codes ----------

export const backupCodes = pgTable(
  "backup_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("backup_codes_user_idx").on(table.userId)],
);

// ---------- security_events ----------

export const securityEvents = pgTable(
  "security_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    eventType: securityEventTypeEnum("event_type").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("security_events_user_idx").on(table.userId),
    index("security_events_event_type_idx").on(table.eventType),
  ],
);

// ---------- aggregate schema export ----------

export const schema = {
  tenants,
  users,
  tenantMembers,
  refreshTokens,
  backupCodes,
  securityEvents,
};
