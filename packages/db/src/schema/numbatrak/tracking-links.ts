// Numbatrak domain: tracking links - a merchant-generated link
// (media buyer + platform + form, optionally scoped to one offer/package
// within that form) used to attribute orders back to the specific ad that
// drove them. The public form URL (numbatrak_forms.site_url) gets a `?tl=
// <code>` query param appended; submitFormOrder resolves that code back to
// this row and stamps trackingLinkId/platform/mediaBuyerName onto the order.
import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization } from "../../auth-schema.js";
import { numbatrakForms } from "./forms.js";

export const numbatrakTrackingLinks = pgTable(
  "numbatrak_tracking_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    formId: uuid("form_id")
      .notNull()
      .references(() => numbatrakForms.id, { onDelete: "cascade" }),
    // Loose reference (not a strict FK) into that form's own
    // schema.fields[].radioOptions - matches how numbatrak_ad_spend/
    // numbatrak_ad_catalog already treat offerId as free text rather than a
    // relational FK. Null when the link is for the whole form, not one
    // specific package.
    offerId: text("offer_id"),
    // Denormalized snapshot of the offer/package label at creation time, so
    // the link's own display doesn't break if the form's radioOptions are
    // later edited/removed.
    offerLabel: text("offer_label"),
    mediaBuyerName: text("media_buyer_name").notNull(),
    platform: text("platform").notNull(),
    label: text("label"),
    // Short random slug embedded in the public URL as `?tl=<code>`.
    code: text("code").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("numbatrak_tracking_links_org_idx").on(table.organizationId),
    index("numbatrak_tracking_links_form_idx").on(table.formId),
    uniqueIndex("numbatrak_tracking_links_org_code_unique_idx").on(table.organizationId, table.code),
    index("numbatrak_tracking_links_media_buyer_idx").on(table.organizationId, table.mediaBuyerName),
    index("numbatrak_tracking_links_platform_idx").on(table.organizationId, table.platform),
    index("numbatrak_tracking_links_active_idx")
      .on(table.organizationId)
      .where(sql`${table.active} = true`),
  ],
);
