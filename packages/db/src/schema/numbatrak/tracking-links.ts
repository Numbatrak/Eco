// Numbatrak domain: tracking links - a merchant-generated link that answers
// "where did this sale come from?": which media buyer, on which platform, for
// which funnel/form and (optionally) which one offer/package on it.
//
// One link = one form, optionally narrowed to one offer/package. A visitor who
// arrives through a link can only buy what that link's landing page sells, so
// the link alone identifies the offer; when no offer is picked, the offer is
// the package the customer chose on that form.
//
// A `?tl=<code>` query param is appended to the landing page URL;
// submitFormOrder resolves that code back to this row and stamps
// trackingLinkId/platform/mediaBuyerName onto the order (and, for a visitor
// who leaves without ordering, onto the abandoned cart).
import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organization } from "../../auth-schema.js";
import { numbatrakForms } from "./forms.js";

// The business's fixed list of media buyers (people or agencies running its
// ads). Deliberately not tied to staff accounts - outside agencies never log
// in. Tracking links pick from this list so "John"/"john"/"Jon" can't split
// one buyer's results three ways.
export const numbatrakMediaBuyers = pgTable(
  "numbatrak_media_buyers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Retired buyers stay for history but can't be picked for new links.
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Case-insensitive: "John" and "john" are the same buyer.
    uniqueIndex("numbatrak_media_buyers_org_name_unique_idx").on(table.organizationId, sql`lower(${table.name})`),
  ],
);

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
    // Which listed buyer runs this link. Nullable in the database only so the
    // previous API version (which never set it) keeps working during a
    // deploy; the API requires it for every new link.
    mediaBuyerId: uuid("media_buyer_id").references(() => numbatrakMediaBuyers.id, { onDelete: "restrict" }),
    // Copy of the buyer's name, stamped onto orders. Kept in step with the
    // list when a buyer is renamed.
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
    // The landing page this link points at (where the form is embedded), as
    // entered by whoever made the link. Null falls back to the form's own
    // site URL. The copyable link is built from it - `?tl=<code>` plus UTM
    // tags - at read time, so it is never stored pre-built.
    pageUrl: text("page_url"),
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
