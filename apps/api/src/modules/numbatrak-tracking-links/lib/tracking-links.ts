import { randomBytes } from "node:crypto";
import { and, count, eq, desc } from "drizzle-orm";
import { numbatrakTrackingLinks, numbatrakForms, numbatrakCustomerOrders, type Database, type Queryable } from "@platform/db";
import type {
  NumbatrakTrackingLink,
  CreateNumbatrakTrackingLinkRequest,
  UpdateNumbatrakTrackingLinkRequest,
  ListNumbatrakTrackingLinksQuery,
} from "@platform/shared-types";

type TrackingLinkRow = typeof numbatrakTrackingLinks.$inferSelect;

// Short, URL-safe, human-typeable code - base36, 8 chars (~41 bits, plenty
// for the per-org volume this feature will ever see; collisions are handled
// by retrying against the (organizationId, code) unique index anyway).
function generateCode(): string {
  return randomBytes(6).toString("hex").slice(0, 8);
}

function buildUrl(siteUrl: string | null, code: string): string | null {
  if (!siteUrl) return null;
  const separator = siteUrl.includes("?") ? "&" : "?";
  return `${siteUrl}${separator}tl=${code}`;
}

function serialize(
  row: TrackingLinkRow,
  formName: string | null,
  siteUrl: string | null,
  orderCount: number,
): NumbatrakTrackingLink {
  return {
    id: row.id,
    formId: row.formId,
    formName,
    offerId: row.offerId,
    offerLabel: row.offerLabel,
    mediaBuyerName: row.mediaBuyerName,
    platform: row.platform,
    label: row.label,
    code: row.code,
    url: buildUrl(siteUrl, row.code),
    active: row.active,
    orderCount,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
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

  const result: NumbatrakTrackingLink[] = [];
  for (const row of rows) {
    const [form] = await db
      .select({ name: numbatrakForms.name, siteUrl: numbatrakForms.siteUrl })
      .from(numbatrakForms)
      .where(eq(numbatrakForms.id, row.formId))
      .limit(1);
    const [orderCountResult] = await db
      .select({ total: count() })
      .from(numbatrakCustomerOrders)
      .where(eq(numbatrakCustomerOrders.trackingLinkId, row.id));
    result.push(serialize(row, form?.name ?? null, form?.siteUrl ?? null, orderCountResult?.total ?? 0));
  }
  return result;
}

export async function createTrackingLink(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakTrackingLinkRequest,
): Promise<NumbatrakTrackingLink> {
  let row: TrackingLinkRow | undefined;
  // Retry on the rare code collision within this org (unique index on
  // (organization_id, code)) rather than pre-checking - simpler and race-free.
  for (let attempt = 0; attempt < 5 && !row; attempt++) {
    try {
      const [inserted] = await db
        .insert(numbatrakTrackingLinks)
        .values({
          organizationId,
          formId: input.formId,
          offerId: input.offerId ?? null,
          offerLabel: input.offerLabel ?? null,
          mediaBuyerName: input.mediaBuyerName,
          platform: input.platform,
          label: input.label ?? null,
          code: generateCode(),
        })
        .returning();
      row = inserted;
    } catch (err) {
      const isUniqueViolation = err instanceof Error && "code" in err && (err as { code?: string }).code === "23505";
      if (!isUniqueViolation || attempt === 4) throw err;
    }
  }

  const [form] = await db
    .select({ name: numbatrakForms.name, siteUrl: numbatrakForms.siteUrl })
    .from(numbatrakForms)
    .where(eq(numbatrakForms.id, row!.formId))
    .limit(1);
  return serialize(row!, form?.name ?? null, form?.siteUrl ?? null, 0);
}

export async function updateTrackingLink(
  db: Database,
  organizationId: string,
  trackingLinkId: string,
  input: UpdateNumbatrakTrackingLinkRequest,
): Promise<NumbatrakTrackingLink | null> {
  const values: Partial<typeof numbatrakTrackingLinks.$inferInsert> = { updatedAt: new Date() };
  if (input.mediaBuyerName !== undefined) values.mediaBuyerName = input.mediaBuyerName;
  if (input.platform !== undefined) values.platform = input.platform;
  if (input.label !== undefined) values.label = input.label;
  if (input.active !== undefined) values.active = input.active;

  const [row] = await db
    .update(numbatrakTrackingLinks)
    .set(values)
    .where(and(eq(numbatrakTrackingLinks.organizationId, organizationId), eq(numbatrakTrackingLinks.id, trackingLinkId)))
    .returning();
  if (!row) return null;

  const [form] = await db
    .select({ name: numbatrakForms.name, siteUrl: numbatrakForms.siteUrl })
    .from(numbatrakForms)
    .where(eq(numbatrakForms.id, row.formId))
    .limit(1);
  const [orderCountResult] = await db
    .select({ total: count() })
    .from(numbatrakCustomerOrders)
    .where(eq(numbatrakCustomerOrders.trackingLinkId, row.id));
  return serialize(row, form?.name ?? null, form?.siteUrl ?? null, orderCountResult?.total ?? 0);
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
