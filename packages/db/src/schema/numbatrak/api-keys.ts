// Org-scoped developer API keys - grants read access to the org's own data
// via the external API, independent of the caller having a browser session.
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization, user } from "../../auth-schema.js";

export const numbatrakApiKeys = pgTable(
  "numbatrak_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // First few characters of the plaintext key, shown in the UI so an org
    // can tell keys apart without ever re-displaying the full secret.
    keyPrefix: text("key_prefix").notNull(),
    // SHA-256 hex digest of the full plaintext key - the plaintext itself is
    // never stored, only ever shown once at creation time.
    keyHash: text("key_hash").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_api_keys_org_idx").on(table.organizationId),
    uniqueIndex("numbatrak_api_keys_hash_unique_idx").on(table.keyHash),
  ],
);
