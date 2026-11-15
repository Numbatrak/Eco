import { and, asc, count, eq, desc, inArray } from "drizzle-orm";
import {
  numbatrakTrackingLinks,
  numbatrakMediaBuyers,
  numbatrakForms,
  numbatrakCustomerOrders,
  type Database,
  type Queryable,
} from "@platform/db";
import type {
  NumbatrakTrackingLink,
  NumbatrakMediaBuyer,
  CreateNumbatrakTrackingLinkRequest,
  UpdateNumbatrakTrackingLinkRequest,
  ListNumbatrakTrackingLinksQuery,
  CreateNumbatrakMediaBuyerRequest,
  UpdateNumbatrakMediaBuyerRequest,
} from "@platform/shared-types";
import { slugify, slugJoin } from "../../../lib/slug.js";
import { isUniqueViolation } from "../../../lib/db-errors.js";

type TrackingLinkRow = typeof numbatrakTrackingLinks.$inferSelect;
type MediaBuyerRow = typeof numbatrakMediaBuyers.$inferSelect;
type FormInfo = { name: string; siteUrl: string | null };

const MAX_CODE_LENGTH = 60;
const MAX_SUFFIX_ATTEMPTS = 50;

function httpError(statusCode: number, message: string): Error {
  return Object.assign(new Error(message), { statusCode });
}

/**
 * Readable base code from who drove the traffic - "AdGuys" + "TikTok" ->
 * "adguys-tiktok", plus the label when given so one buyer can run several
 * links on the same platform ("adguys-tiktok-bf-test"). Only ever a lookup
 * key: attribution is read off the row, never parsed out of this string.
 */
function baseCode(mediaBuyerName: string, input: CreateNumbatrakTrackingLinkRequest): string {
  return slugJoin([mediaBuyerName, input.platform, input.label], {
    maxLength: MAX_CODE_LENGTH - 3, // leave room for a "-NN" collision suffix
    fallback: "link",
  });
}

/** `base`, then `base-2`, `base-3`, ... */
function candidateCode(base: string, attempt: number): string {
  return attempt === 0 ? base : `${base}-${attempt + 1}`;
}

export type TrackingUrlParts = Pick<TrackingLinkRow, "code" | "platform" | "mediaBuyerName" | "offerLabel">;

/**
 * The ready-to-paste ad link: the landing page plus `tl=<code>` and standard
 * UTM tags. NumbaTrak attributes orders from `tl` alone; the UTMs are for
 * people reading the link and for analytics tools (GA, Meta, TikTok) that
 * group traffic by them. Existing query params and the #fragment on the page
 * are kept; our own tags overwrite any stale copies.
 */
export function buildTrackingUrl(
  pageUrl: string | null,
  link: TrackingUrlParts,
  formName: string | null,
): string | null {
  if (!pageUrl) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(pageUrl) ? pageUrl : `https://${pageUrl}`);
  } catch {
    return null;
  }
  const campaign = link.offerLabel ?? formName;
  url.searchParams.set("tl", link.code);
  url.searchParams.set("utm_source", slugify(link.platform, { fallback: "ads" }));
  url.searchParams.set("utm_medium", "paid");
  if (campaign) url.searchParams.set("utm_campaign", slugify(campaign, { fallback: "offer" }));
  else url.searchParams.delete("utm_campaign");
  url.searchParams.set("utm_content", slugify(link.mediaBuyerName, { fallback: "buyer" }));
  return url.toString();
}

function serialize(row: TrackingLinkRow, form: FormInfo | null, orderCount: number): NumbatrakTrackingLink {
  return {
    id: row.id,
    formId: row.formId,
    formName: form?.name ?? null,
    offerId: row.offerId,
    offerLabel: row.offerLabel,
    mediaBuyerId: row.mediaBuyerId,
    mediaBuyerName: row.mediaBuyerName,
    platform: row.platform,
    label: row.label,
    code: row.code,
    pageUrl: row.pageUrl,
    // Null when neither the link nor its form has a page URL - the UI then
    // shows the bare `?tl=<code>` param to append to the landing page.
    url: buildTrackingUrl(row.pageUrl ?? form?.siteUrl ?? null, row, form?.name ?? null),
    active: row.active,
    orderCount,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

async function loadForm(db: Queryable, organizationId: string, formId: string): Promise<FormInfo | null> {
  const [form] = await db
    .select({ name: numbatrakForms.name, siteUrl: numbatrakForms.siteUrl })
    .from(numbatrakForms)
    .where(and(eq(numbatrakForms.organizationId, organizationId), eq(numbatrakForms.id, formId)))
    .limit(1);
  return form ?? null;
}

export async function listTrackingLinks(
  db: Database,
  organizationId: string,
  query: ListNumbatrakTrackingLinksQuery,
): Promise<NumbatrakTrackingLink[]> {
  const conditions = [eq(numbatrakTrackingLinks.organizationId, organizationId)];
  if (query.formId) conditions.push(eq(numbatrakTrackingLinks.formId, query.formId));
  if (query.active !== undefined) conditions.push(eq(numbatrakTrackingLinks.active, query.active));

  const rows = await db
    .select()
    .from(numbatrakTrackingLinks)
    .where(and(...conditions))
    .orderBy(desc(numbatrakTrackingLinks.createdAt));

  if (rows.length === 0) return [];

  // Batched instead of one form-lookup + one order-count query per row (was
  // 1 + 2N round trips) - each round trip to the DB costs a fixed network
  // latency regardless of query complexity, so N+1 here scaled linearly with
  // the number of tracking links in an org.
  const formIds = [...new Set(rows.map((r) => r.formId))];
  const trackingLinkIds = rows.map((r) => r.id);

  const [forms, orderCounts] = await Promise.all([
    db
      .select({ id: numbatrakForms.id, name: numbatrakForms.name, siteUrl: numbatrakForms.siteUrl })
      .from(numbatrakForms)
      .where(inArray(numbatrakForms.id, formIds)),
    db
      .select({ trackingLinkId: numbatrakCustomerOrders.trackingLinkId, total: count() })
      .from(numbatrakCustomerOrders)
      .where(inArray(numbatrakCustomerOrders.trackingLinkId, trackingLinkIds))
      .groupBy(numbatrakCustomerOrders.trackingLinkId),
  ]);

  const formById = new Map(forms.map((f) => [f.id, f]));
  const orderCountByLinkId = new Map(orderCounts.map((o) => [o.trackingLinkId, o.total]));

  return rows.map((row) =>
    serialize(row, formById.get(row.formId) ?? null, orderCountByLinkId.get(row.id) ?? 0),
  );
}

export async function createTrackingLink(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakTrackingLinkRequest,
): Promise<NumbatrakTrackingLink> {
  // The FKs alone would accept another org's form or buyer.
  const [form, buyer] = await Promise.all([
    loadForm(db, organizationId, input.formId),
    findMediaBuyer(db, organizationId, input.mediaBuyerId),
  ]);
  if (!form) throw httpError(400, "Form not found");
  if (!buyer) throw httpError(400, "Media buyer not found");
  if (!buyer.active) throw httpError(400, `${buyer.name} is no longer an active media buyer`);

  const values = {
    organizationId,
    formId: input.formId,
    offerId: input.offerId ?? null,
    offerLabel: input.offerId ? (input.offerLabel ?? null) : null,
    mediaBuyerId: buyer.id,
    mediaBuyerName: buyer.name,
    platform: input.platform,
    label: input.label ?? null,
    pageUrl: input.pageUrl ?? null,
  };

  // A caller-chosen code is taken literally: a clash is the caller's to
  // resolve, not something to paper over with a suffix they didn't ask for.
  if (input.code) {
    try {
      const [row] = await db.insert(numbatrakTrackingLinks).values({ ...values, code: input.code }).returning();
      return serialize(row!, form, 0);
    } catch (err) {
      if (isUniqueViolation(err)) throw httpError(409, `The code "${input.code}" is already used by another link`);
      throw err;
    }
  }

  // Derived code: try "adguys-tiktok", then "-2", "-3"... against the
  // (organization_id, code) unique index rather than pre-checking, so two
  // concurrent creates can't both claim the same code.
  const base = baseCode(buyer.name, input);
  for (let attempt = 0; attempt < MAX_SUFFIX_ATTEMPTS; attempt++) {
    try {
      const [row] = await db
        .insert(numbatrakTrackingLinks)
        .values({ ...values, code: candidateCode(base, attempt) })
        .returning();
      return serialize(row!, form, 0);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw httpError(409, "Could not find a free code for this link - add a label to tell it apart");
}

export async function updateTrackingLink(
  db: Database,
  organizationId: string,
  trackingLinkId: string,
  input: UpdateNumbatrakTrackingLinkRequest,
): Promise<NumbatrakTrackingLink | null> {
  const values: Partial<typeof numbatrakTrackingLinks.$inferInsert> = { updatedAt: new Date() };
  if (input.mediaBuyerId !== undefined) {
    const buyer = await findMediaBuyer(db, organizationId, input.mediaBuyerId);
    if (!buyer) throw httpError(400, "Media buyer not found");
    if (!buyer.active) throw httpError(400, `${buyer.name} is no longer an active media buyer`);
    values.mediaBuyerId = buyer.id;
    values.mediaBuyerName = buyer.name;
  }
  if (input.offerId !== undefined) {
    values.offerId = input.offerId || null;
    values.offerLabel = values.offerId ? (input.offerLabel ?? null) : null;
  }
  if (input.platform !== undefined) values.platform = input.platform;
  if (input.label !== undefined) values.label = input.label;
  if (input.pageUrl !== undefined) values.pageUrl = input.pageUrl;
  if (input.active !== undefined) values.active = input.active;

  const [row] = await db
    .update(numbatrakTrackingLinks)
    .set(values)
    .where(and(eq(numbatrakTrackingLinks.organizationId, organizationId), eq(numbatrakTrackingLinks.id, trackingLinkId)))
    .returning();
  if (!row) return null;

  const [form, [orderCountResult]] = await Promise.all([
    loadForm(db, organizationId, row.formId),
    db
      .select({ total: count() })
      .from(numbatrakCustomerOrders)
      .where(eq(numbatrakCustomerOrders.trackingLinkId, row.id)),
  ]);
  return serialize(row, form, orderCountResult?.total ?? 0);
}

/**
 * Look up a tracking link by id (org-scoped) - used when an order is
 * created/edited with an explicitly picked trackingLinkId (Manual Order /
 * Edit Order), as opposed to the automatic `?tl=<code>` URL resolution
 * below. Deliberately returns null rather than throwing on a not-found id -
 * callers treat it the same as "no tracking link" rather than failing the
 * whole order write.
 */
export async function findTrackingLinkById(
  db: Queryable,
  organizationId: string,
  trackingLinkId: string,
): Promise<TrackingLinkRow | null> {
  const [row] = await db
    .select()
    .from(numbatrakTrackingLinks)
    .where(and(eq(numbatrakTrackingLinks.organizationId, organizationId), eq(numbatrakTrackingLinks.id, trackingLinkId)))
    .limit(1);
  return row ?? null;
}

/**
 * Whether a link may attribute a submission made through `formId`: only its
 * own form. A link's code is org-scoped, so a URL copy-pasted from another
 * funnel's link would otherwise still resolve and mis-tag the order.
 */
export function trackingLinkAppliesToForm(link: Pick<TrackingLinkRow, "formId">, formId: string): boolean {
  return link.formId === formId;
}

/**
 * Resolve a `?tl=<code>` URL param back to an active tracking link for this
 * org - used by submitFormOrder to stamp attribution onto a new order. Not
 * an authenticated lookup (called from the public form-intake path), so it
 * deliberately doesn't throw on a missing/inactive code - callers should
 * just skip attribution when this returns null.
 */
export async function findActiveTrackingLinkByCode(
  db: Queryable,
  organizationId: string,
  code: string,
): Promise<TrackingLinkRow | null> {
  // Codes are stored lowercase; ad platforms and hand-typed URLs don't
  // always preserve case.
  code = code.trim().toLowerCase();
  if (!code) return null;
  const [row] = await db
    .select()
    .from(numbatrakTrackingLinks)
    .where(
      and(
        eq(numbatrakTrackingLinks.organizationId, organizationId),
        eq(numbatrakTrackingLinks.code, code),
        eq(numbatrakTrackingLinks.active, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ---------- media buyer list ----------

function serializeBuyer(row: MediaBuyerRow): NumbatrakMediaBuyer {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

async function findMediaBuyer(db: Queryable, organizationId: string, mediaBuyerId: string): Promise<MediaBuyerRow | null> {
  const [row] = await db
    .select()
    .from(numbatrakMediaBuyers)
    .where(and(eq(numbatrakMediaBuyers.organizationId, organizationId), eq(numbatrakMediaBuyers.id, mediaBuyerId)))
    .limit(1);
  return row ?? null;
}

export async function listMediaBuyers(db: Database, organizationId: string): Promise<NumbatrakMediaBuyer[]> {
  const rows = await db
    .select()
    .from(numbatrakMediaBuyers)
    .where(eq(numbatrakMediaBuyers.organizationId, organizationId))
    .orderBy(asc(numbatrakMediaBuyers.name));
  return rows.map(serializeBuyer);
}

export async function createMediaBuyer(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakMediaBuyerRequest,
): Promise<NumbatrakMediaBuyer> {
  try {
    const [row] = await db.insert(numbatrakMediaBuyers).values({ organizationId, name: input.name }).returning();
    return serializeBuyer(row!);
  } catch (err) {
    if (isUniqueViolation(err)) throw httpError(409, `${input.name} is already on the media buyer list`);
    throw err;
  }
}

/**
 * Rename or retire a buyer. A rename is copied onto that buyer's links so new
 * orders carry the new name; orders already placed keep the name they were
 * stamped with.
 */
export async function updateMediaBuyer(
  db: Database,
  organizationId: string,
  mediaBuyerId: string,
  input: UpdateNumbatrakMediaBuyerRequest,
): Promise<NumbatrakMediaBuyer | null> {
  const now = new Date();
  const values: Partial<typeof numbatrakMediaBuyers.$inferInsert> = { updatedAt: now };
  if (input.name !== undefined) values.name = input.name;
  if (input.active !== undefined) values.active = input.active;
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .update(numbatrakMediaBuyers)
        .set(values)
        .where(and(eq(numbatrakMediaBuyers.organizationId, organizationId), eq(numbatrakMediaBuyers.id, mediaBuyerId)))
        .returning();
      if (!row) return null;
      if (input.name !== undefined) {
        await tx
          .update(numbatrakTrackingLinks)
          .set({ mediaBuyerName: row.name, updatedAt: now })
          .where(
            and(eq(numbatrakTrackingLinks.organizationId, organizationId), eq(numbatrakTrackingLinks.mediaBuyerId, row.id)),
          );
      }
      return serializeBuyer(row);
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw httpError(409, `${input.name} is already on the media buyer list`);
    throw err;
  }
}
