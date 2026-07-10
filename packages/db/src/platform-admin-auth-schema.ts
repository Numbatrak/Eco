// Hand-written to mirror auth-schema.ts's shape exactly, but for the
// isolated platform-admin Better Auth instance (apps/api/src/lib/
// platform-admin-auth.ts) - twoFactor only, no organization plugin, no
// activeOrganizationId. Table names are prefixed platform_admin_* and never
// share rows with the tenant-member user/session/account/verification/
// twoFactor tables in auth-schema.ts.
import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";

export const platformAdminUser = pgTable("platform_admin_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
});

export const platformAdminSession = pgTable(
  "platform_admin_session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => platformAdminUser.id, { onDelete: "cascade" }),
  },
  (table) => [index("platform_admin_session_userId_idx").on(table.userId)],
);

export const platformAdminAccount = pgTable(
  "platform_admin_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => platformAdminUser.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("platform_admin_account_userId_idx").on(table.userId)],
);

export const platformAdminVerification = pgTable(
  "platform_admin_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("platform_admin_verification_identifier_idx").on(table.identifier)],
);

export const platformAdminTwoFactor = pgTable(
  "platform_admin_two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => platformAdminUser.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until"),
  },
  (table) => [
    index("platform_admin_two_factor_secret_idx").on(table.secret),
    index("platform_admin_two_factor_userId_idx").on(table.userId),
  ],
);

export const platformAdminUserRelations = relations(platformAdminUser, ({ many }) => ({
  sessions: many(platformAdminSession),
  accounts: many(platformAdminAccount),
  twoFactors: many(platformAdminTwoFactor),
}));

export const platformAdminSessionRelations = relations(platformAdminSession, ({ one }) => ({
  user: one(platformAdminUser, {
    fields: [platformAdminSession.userId],
    references: [platformAdminUser.id],
  }),
}));

export const platformAdminAccountRelations = relations(platformAdminAccount, ({ one }) => ({
  user: one(platformAdminUser, {
    fields: [platformAdminAccount.userId],
    references: [platformAdminUser.id],
  }),
}));

export const platformAdminTwoFactorRelations = relations(platformAdminTwoFactor, ({ one }) => ({
  user: one(platformAdminUser, {
    fields: [platformAdminTwoFactor.userId],
    references: [platformAdminUser.id],
  }),
}));
