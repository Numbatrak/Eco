// Numbatrak domain: tracking links - a merchant-generated link identifying
// WHO drove a visit, used to attribute orders back to the specific ad.
//
// Two shapes, distinguished by whether `formId` is set:
//   formId NULL - an org-wide (media buyer + platform) link. One code works
//     across every funnel; which funnel an order belongs to is already known
//     from the form it was submitted through (intake.ts stamps
//     `funnelName: form.funnelName ?? form.name`), so the link never needed
//     to carry it. This is the common case.
//   formId set - scoped to one form, optionally to one offer/package within
//     it. Use when a link must only ever attribute orders from one funnel.
//
// A `?tl=<code>` query param is appended to the landing page URL;
// submitFormOrder resolves that code back to this row and stamps
// trackingLinkId/platform/mediaBuyerName onto the order (and, for a visitor
// who leaves without ordering, onto the abandoned cart).
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
    // Null means "any funnel" - see the file header. Was NOT NULL until
    // org-wide links were introduced; existing rows keep their form.
    formId: uuid("form_id").references(() => numbatrakForms.id, { onDelete: "cascade" }),
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
    // Human-readable slug embedded in the public URL as `?tl=<code>`, derived
    // from media buyer + platform (+ label) at creation - e.g. "adguys-tiktok".
    // Restricted to [a-z0-9-] because buildUrl concatenates it into a query
    // string without encoding. It is a LOOKUP KEY, never parsed for meaning:
    // the buyer and platform are read off this row, not off the string, so a
    // typo in an ad URL can't invent a media buyer. Rows created before this
    // was readable still carry 8 random hex chars and keep resolving.
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
