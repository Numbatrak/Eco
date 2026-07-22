import { and, asc, desc, eq, gte, ilike, inArray, lte, type SQL } from "drizzle-orm";
import { numbatrakAbandonedCarts, numbatrakFollowUps, user, type Database } from "@platform/db";
import type {
  CreateNumbatrakFollowUpRequest,
  ListNumbatrakFollowUpsQuery,
  NumbatrakFollowUp,
  UpdateNumbatrakFollowUpRequest,
} from "@platform/shared-types";
import { calculateWorkHoursMinutes } from "./work-hours.js";
import { pickLeastBusyCsr } from "./csr-assignment.js";

export type FollowUpRow = typeof numbatrakFollowUps.$inferSelect;

/** Legacy DB values normalized to canonical spec statuses (read path) -
 * mirrors src/utils/followUpStatus.ts's normalizeFollowUpStatus. The CHECK
 * constraint on this table only allows the canonical four, so the legacy
 * branches are dead code today but kept for parity with any migrated data. */
function normalizeStatus(status: string): NumbatrakFollowUp["status"] {
  switch (status) {
    case "pending":
      return "awaiting";
    case "in_progress":
      return "followed_up";
    case "completed":
      return "resolved";
    case "awaiting":
    case "followed_up":
    case "resolved":
    case "cancelled":
      return status;
    default:
      return "awaiting";
  }
}

async function attachRelations(db: Database, rows: FollowUpRow[]): Promise<NumbatrakFollowUp[]> {
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.map((r) => r.assignedTo).filter((id): id is string => id != null))];
  const userMap = new Map<string, { name: string | null; email: string | null }>();
  if (userIds.length > 0) {
    const users = await db.select({ id: user.id, name: user.name, email: user.email }).from(user).where(inArray(user.id, userIds));
    for (const u of users) userMap.set(u.id, { name: u.name, email: u.email });
  }

  const cartIds = [...new Set(rows.map((r) => r.abandonedCartId).filter((id): id is string => id != null))];
  const cartMap = new Map<string, typeof numbatrakAbandonedCarts.$inferSelect>();
  if (cartIds.length > 0) {
    const carts = await db.select().from(numbatrakAbandonedCarts).where(inArray(numbatrakAbandonedCarts.id, cartIds));
    for (const c of carts) cartMap.set(c.id, c);
  }

  return rows.map((row) => {
    const assignee = row.assignedTo ? userMap.get(row.assignedTo) : null;
    const cart = row.abandonedCartId ? cartMap.get(row.abandonedCartId) : null;
    return {
      id: row.id,
      orderId: row.orderId,
      abandonedCartId: row.abandonedCartId,
      assignedTo: row.assignedTo,
      assignedUserName: assignee?.name ?? null,
      assignedUserEmail: assignee?.email ?? null,
      status: normalizeStatus(row.status),
      priority: row.priority as NumbatrakFollowUp["priority"],
      startedAt: row.startedAt?.toISOString() ?? null,
      firstContactAt: row.firstContactAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      responseTimeMinutes: row.responseTimeMinutes,
      resolutionTimeMinutes: row.resolutionTimeMinutes,
      outcome: row.outcome as NumbatrakFollowUp["outcome"],
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      // order:orders(...) embed dropped - the source `orders` table is out of
      // scope for this migration (never repointed to customer_orders) and
      // the order-linked creation path is unreachable in the live app
      // (only reachable from dead legacy components) - see follow-ups port notes.
      cartCustomerName: cart?.customerName ?? null,
      cartCustomerPhone: cart?.phoneNumber ?? null,
      cartCustomerWhatsapp: cart?.whatsappNumber ?? null,
      cartCustomerLocation: cart?.location ?? null,
      cartCustomerAddress: cart?.deliveryAddress ?? null,
      cartCustomerState: cart?.state ?? null,
    };
  });
}

function buildFilterConditions(organizationId: string, filters: Partial<ListNumbatrakFollowUpsQuery>): SQL[] {
  const conditions = [eq(numbatrakFollowUps.organizationId, organizationId)];
  if (filters.assignedTo) conditions.push(eq(numbatrakFollowUps.assignedTo, filters.assignedTo));
  if (filters.status) conditions.push(eq(numbatrakFollowUps.status, filters.status));
  if (filters.priority) conditions.push(eq(numbatrakFollowUps.priority, filters.priority));
  if (filters.orderId) conditions.push(eq(numbatrakFollowUps.orderId, filters.orderId));
  if (filters.abandonedCartId) conditions.push(eq(numbatrakFollowUps.abandonedCartId, filters.abandonedCartId));
  if (filters.dateFrom) conditions.push(gte(numbatrakFollowUps.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(numbatrakFollowUps.createdAt, new Date(filters.dateTo)));
  if (filters.search) conditions.push(ilike(numbatrakFollowUps.notes, `%${filters.search}%`));
  return conditions;
}

export async function listFollowUpsForOrg(
  db: Database,
  organizationId: string,
  query: ListNumbatrakFollowUpsQuery,
): Promise<NumbatrakFollowUp[]> {
  const conditions = buildFilterConditions(organizationId, query);
  const order = query.sortOrder === "asc" ? asc(numbatrakFollowUps.createdAt) : desc(numbatrakFollowUps.createdAt);
  const rows = await db
    .select()
    .from(numbatrakFollowUps)
    .where(and(...conditions))
    .orderBy(order)
    .limit(query.limit)
    .offset(query.offset);
  return attachRelations(db, rows);
}

export async function countFollowUpsForOrg(
  db: Database,
  organizationId: string,
  filters: Partial<ListNumbatrakFollowUpsQuery>,
): Promise<number> {
  const conditions = buildFilterConditions(organizationId, filters);
  const rows = await db.select({ id: numbatrakFollowUps.id }).from(numbatrakFollowUps).where(and(...conditions));
  return rows.length;
}

export async function createFollowUp(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakFollowUpRequest,
): Promise<NumbatrakFollowUp> {
  const assignedTo = input.assignedTo ?? (await pickLeastBusyCsr(db, organizationId));
  if (!assignedTo) {
    throw new Error("No Customer Relations users available for assignment");
  }

  const [row] = await db
    .insert(numbatrakFollowUps)
    .values({
      organizationId,
      orderId: input.orderId ?? null,
      abandonedCartId: input.abandonedCartId ?? null,
      assignedTo,
      status: "awaiting",
      priority: input.priority ?? "medium",
      notes: input.notes ?? null,
    })
    .returning();
  if (!row) throw new Error("Failed to create follow-up");
  const [full] = await attachRelations(db, [row]);
  return full!;
}

/** Order-linked anchor is unreachable in the live app (see attachRelations'
 * comment) - only the abandoned-cart anchor is implemented. */
async function getSourceAnchor(db: Database, followUp: FollowUpRow): Promise<Date | null> {
  if (!followUp.abandonedCartId) return null;
  const [cart] = await db
    .select({ abandonedAt: numbatrakAbandonedCarts.abandonedAt, createdAt: numbatrakAbandonedCarts.createdAt })
    .from(numbatrakAbandonedCarts)
    .where(eq(numbatrakAbandonedCarts.id, followUp.abandonedCartId))
    .limit(1);
  return cart?.abandonedAt ?? cart?.createdAt ?? null;
}

export async function findFollowUpForOrg(db: Database, organizationId: string, id: number): Promise<FollowUpRow | null> {
  const [row] = await db
    .select()
    .from(numbatrakFollowUps)
    .where(and(eq(numbatrakFollowUps.organizationId, organizationId), eq(numbatrakFollowUps.id, id)))
    .limit(1);
  return row ?? null;
}

export async function updateFollowUp(
  db: Database,
  organizationId: string,
  id: number,
  updates: UpdateNumbatrakFollowUpRequest,
): Promise<NumbatrakFollowUp | null> {
  const current = await findFollowUpForOrg(db, organizationId, id);
  if (!current) return null;

  let responseTimeMinutes = current.responseTimeMinutes;
  const movingToFollowedUp =
    updates.status === "followed_up" || (updates.firstContactAt != null && !current.firstContactAt);

  if (movingToFollowedUp || updates.firstContactAt) {
    const firstContactAt = updates.firstContactAt
      ? new Date(updates.firstContactAt)
      : updates.status === "followed_up"
        ? new Date()
        : current.firstContactAt;

    if (firstContactAt) {
      const anchor = await getSourceAnchor(db, current);
      if (anchor) {
        responseTimeMinutes = calculateWorkHoursMinutes(anchor, firstContactAt);
      }
    }
  }

  let resolutionTimeMinutes = current.resolutionTimeMinutes;
  const movingToResolved = updates.status === "resolved" || (updates.completedAt != null && !current.completedAt);
  if (movingToResolved) {
    const completedAt = updates.completedAt ? new Date(updates.completedAt) : new Date();
    const startedAt = current.startedAt ?? current.firstContactAt ?? current.createdAt;
    if (startedAt) {
      resolutionTimeMinutes = calculateWorkHoursMinutes(startedAt, completedAt);
    }
  }

  let firstContactAt = updates.firstContactAt !== undefined ? (updates.firstContactAt ? new Date(updates.firstContactAt) : null) : current.firstContactAt;
  if (updates.status === "followed_up" && !firstContactAt) {
    firstContactAt = new Date();
  }

  let startedAt = current.startedAt;
  if (updates.status === "followed_up" && !startedAt) {
    startedAt = firstContactAt ?? new Date();
  }

  let completedAt =
    updates.completedAt !== undefined ? (updates.completedAt ? new Date(updates.completedAt) : null) : current.completedAt;
  if (updates.status === "resolved" && !completedAt) {
    completedAt = new Date();
  }

  if (updates.status === "resolved" && updates.outcome === undefined && current.outcome == null) {
    throw new Error("Resolved follow-ups require an outcome (converted or not converted).");
  }

  const values: Partial<typeof numbatrakFollowUps.$inferInsert> = {
    responseTimeMinutes,
    resolutionTimeMinutes,
    firstContactAt,
    startedAt,
    completedAt,
    updatedAt: new Date(),
  };
  if (updates.status !== undefined) values.status = updates.status;
  if (updates.priority !== undefined) values.priority = updates.priority;
  if (updates.outcome !== undefined) values.outcome = updates.outcome;
  if (updates.notes !== undefined) values.notes = updates.notes;
  if (updates.assignedTo !== undefined) values.assignedTo = updates.assignedTo;

  const [row] = await db
    .update(numbatrakFollowUps)
    .set(values)
    .where(and(eq(numbatrakFollowUps.organizationId, organizationId), eq(numbatrakFollowUps.id, id)))
    .returning();
  if (!row) return null;
  const [full] = await attachRelations(db, [row]);
  return full!;
}

export async function removeFollowUp(db: Database, organizationId: string, id: number): Promise<boolean> {
  const result = await db
    .delete(numbatrakFollowUps)
    .where(and(eq(numbatrakFollowUps.organizationId, organizationId), eq(numbatrakFollowUps.id, id)))
    .returning({ id: numbatrakFollowUps.id });
  return result.length > 0;
}

/** Close open follow-ups when an abandoned cart converts to an order.
 * Resolves ALL follow-ups tied to that cart currently awaiting/followed_up
 * (plural), each appending (not overwriting) a conversion note. */
export async function resolveFollowUpsForConvertedCart(
  db: Database,
  organizationId: string,
  cartId: string,
  customerOrderId?: string,
): Promise<void> {
  const rows = await db
    .select()
    .from(numbatrakFollowUps)
    .where(and(eq(numbatrakFollowUps.organizationId, organizationId), eq(numbatrakFollowUps.abandonedCartId, cartId)));

  const active = rows.filter((r) => r.status === "awaiting" || r.status === "followed_up");

  await Promise.all(
    active.map((fu) =>
      updateFollowUp(db, organizationId, fu.id, {
        status: "resolved",
        completedAt: new Date().toISOString(),
        outcome: "converted",
        notes: [fu.notes, customerOrderId ? `Cart converted to order ${customerOrderId}.` : "Cart converted to order."]
          .filter(Boolean)
          .join(" "),
      }),
    ),
  );
}
