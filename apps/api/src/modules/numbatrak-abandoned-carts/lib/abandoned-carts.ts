import { and, desc, asc, eq, gte, ilike, isNotNull, lte, or, sql } from "drizzle-orm";
import { numbatrakAbandonedCarts, numbatrakFollowUps, type Database } from "@platform/db";
import type {
  CreateNumbatrakAbandonedCartRequest,
  ListNumbatrakAbandonedCartsQuery,
  NumbatrakAbandonedCart,
  UpdateNumbatrakAbandonedCartRequest,
} from "@platform/shared-types";
import { pickLeastBusyCsr } from "../../numbatrak-follow-ups/lib/csr-assignment.js";

export type AbandonedCartRow = typeof numbatrakAbandonedCarts.$inferSelect;

export function serializeCart(row: AbandonedCartRow): NumbatrakAbandonedCart {
  return {
    id: row.id,
    organizationId: row.organizationId,
    formId: row.formId,
    customerName: row.customerName,
    phoneNumber: row.phoneNumber,
    whatsappNumber: row.whatsappNumber,
    deliveryAddress: row.deliveryAddress,
    state: row.state,
    location: row.location,
    selectedPackage: row.selectedPackage,
    selectedItems: row.selectedItems,
    productName: row.productName,
    mailQuan: row.mailQuan,
    agentQuan: row.agentQuan,
    quantity: row.quantity,
    product2: row.product2,
    mailQuan2: row.mailQuan2,
    agentQuan2: row.agentQuan2,
    quantity2: row.quantity2,
    salesPrice: row.salesPrice,
    costPrice: row.costPrice,
    deliveryFee: row.deliveryFee,
    profit: row.profit,
    pageUrl: row.pageUrl,
    filledFieldsCount: row.filledFieldsCount ?? 0,
    filledFields: (row.filledFields as string[] | null) ?? null,
    fieldValues: (row.fieldValues as Record<string, unknown> | null) ?? null,
    selectedProducts: (row.selectedProducts as unknown[] | null) ?? null,
    abandonedAt: row.abandonedAt.toISOString(),
    convertedToOrder: row.convertedToOrder ?? false,
    convertedOrderId: row.convertedOrderId,
    funnelName: row.funnelName,
    offerName: row.offerName,
    subBrand: row.subBrand,
    note: row.note,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function buildFilterConditions(organizationId: string, filters: Partial<ListNumbatrakAbandonedCartsQuery>) {
  const conditions = [eq(numbatrakAbandonedCarts.organizationId, organizationId)];
  if (filters.converted !== undefined) conditions.push(eq(numbatrakAbandonedCarts.convertedToOrder, filters.converted));
  if (filters.dateFrom) conditions.push(gte(numbatrakAbandonedCarts.abandonedAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(numbatrakAbandonedCarts.abandonedAt, new Date(filters.dateTo)));
  if (filters.formId) conditions.push(eq(numbatrakAbandonedCarts.formId, filters.formId));
  if (filters.funnelName) conditions.push(eq(numbatrakAbandonedCarts.funnelName, filters.funnelName));
  if (filters.productId) {
    conditions.push(sql`${numbatrakAbandonedCarts.selectedProducts} @> ${JSON.stringify([{ product_id: filters.productId }])}::jsonb`);
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(numbatrakAbandonedCarts.customerName, term),
        ilike(numbatrakAbandonedCarts.phoneNumber, term),
        ilike(numbatrakAbandonedCarts.location, term),
      )!,
    );
  }
  return conditions;
}

export async function listCartsForOrg(
  db: Database,
  organizationId: string,
  query: ListNumbatrakAbandonedCartsQuery,
): Promise<AbandonedCartRow[]> {
  const conditions = buildFilterConditions(organizationId, query);
  const order = query.sortOrder === "asc" ? asc(numbatrakAbandonedCarts.abandonedAt) : desc(numbatrakAbandonedCarts.abandonedAt);
  return db
    .select()
    .from(numbatrakAbandonedCarts)
    .where(and(...conditions))
    .orderBy(order)
    .limit(query.limit)
    .offset(query.offset);
}

export async function countCartsForOrg(
  db: Database,
  organizationId: string,
  filters: Partial<ListNumbatrakAbandonedCartsQuery>,
): Promise<number> {
  const conditions = buildFilterConditions(organizationId, filters);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(numbatrakAbandonedCarts)
    .where(and(...conditions));
  return row?.count ?? 0;
}

export async function listDistinctFunnels(db: Database, organizationId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ funnelName: numbatrakAbandonedCarts.funnelName })
    .from(numbatrakAbandonedCarts)
    .where(and(eq(numbatrakAbandonedCarts.organizationId, organizationId), isNotNull(numbatrakAbandonedCarts.funnelName)));
  return rows
    .map((r) => r.funnelName?.trim())
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b));
}

function monthName(date: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return months[date.getMonth()]!;
}

export async function createCart(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakAbandonedCartRequest,
): Promise<AbandonedCartRow> {
  const now = new Date();
  const abandonedAt = input.abandonedAt ? new Date(input.abandonedAt) : now;
  const [row] = await db
    .insert(numbatrakAbandonedCarts)
    .values({
      organizationId,
      formId: input.formId ?? null,
      customerName: input.customerName ?? null,
      phoneNumber: input.phoneNumber ?? null,
      whatsappNumber: input.whatsappNumber ?? null,
      deliveryAddress: input.deliveryAddress ?? null,
      state: input.state ?? null,
      location: input.location ?? null,
      selectedPackage: input.selectedPackage ?? null,
      selectedItems: input.selectedItems ?? null,
      productName: input.productName ?? null,
      mailQuan: input.mailQuan ?? null,
      agentQuan: input.agentQuan ?? null,
      quantity: input.quantity ?? null,
      product2: input.product2 ?? null,
      mailQuan2: input.mailQuan2 ?? null,
      agentQuan2: input.agentQuan2 ?? null,
      quantity2: input.quantity2 ?? null,
      salesPrice: input.salesPrice != null ? String(input.salesPrice) : null,
      pageUrl: input.pageUrl ?? null,
      filledFieldsCount: input.filledFieldsCount ?? 0,
      note: input.note ?? null,
      funnelName: input.funnelName ?? null,
      offerName: input.offerName ?? null,
      subBrand: input.subBrand ?? null,
      abandonedAt,
      orderDate: abandonedAt.toISOString().split("T")[0],
      orderMonth: monthName(abandonedAt),
      orderYear: String(abandonedAt.getFullYear()),
      orderStatus: "Pending",
      subject: "Abandoned Cart",
      convertedToOrder: false,
    })
    .returning();
  if (!row) throw new Error("Failed to create abandoned cart");
  await autoCreateFollowUp(db, organizationId, row);
  return row;
}

/**
 * Server-side retrofit of the source app's Postgres trigger
 * auto_create_follow_up_for_abandoned_cart() (AFTER INSERT ON abandoned_carts
 * -> supabase/migrations/20260720200000_follow_up_stabilization.sql) - never
 * ported as a Drizzle object, so plain application code here instead. Same
 * guard conditions: skip if no customer name, skip if no phone AND no
 * whatsapp. Picks the least-busy csr (numbatrak-follow-ups/lib/csr-assignment.js,
 * shared with that module's manual-create auto-assign) - a follow-up row is
 * still inserted (unassigned) if no csr members exist, matching the trigger.
 * Never throws - a follow-up write failure shouldn't block cart creation.
 */
async function autoCreateFollowUp(db: Database, organizationId: string, cart: AbandonedCartRow): Promise<void> {
  const hasName = !!cart.customerName?.trim();
  const hasContact = !!cart.phoneNumber?.trim() || !!cart.whatsappNumber?.trim();
  if (!hasName || !hasContact) return;

  try {
    const assignedTo = await pickLeastBusyCsr(db, organizationId);
    await db.insert(numbatrakFollowUps).values({
      organizationId,
      abandonedCartId: cart.id,
      assignedTo,
      status: "awaiting",
      priority: "medium",
      notes: "Auto-created from abandoned cart capture",
    });
  } catch (err) {
    console.error("autoCreateFollowUp failed:", err);
  }
}

export async function updateCart(
  db: Database,
  organizationId: string,
  cartId: string,
  input: UpdateNumbatrakAbandonedCartRequest,
): Promise<AbandonedCartRow | null> {
  const values: Partial<typeof numbatrakAbandonedCarts.$inferInsert> = { updatedAt: new Date() };
  if (input.customerName !== undefined) values.customerName = input.customerName;
  if (input.phoneNumber !== undefined) values.phoneNumber = input.phoneNumber;
  if (input.whatsappNumber !== undefined) values.whatsappNumber = input.whatsappNumber;
  if (input.deliveryAddress !== undefined) values.deliveryAddress = input.deliveryAddress;
  if (input.state !== undefined) values.state = input.state;
  if (input.location !== undefined) values.location = input.location;
  if (input.selectedPackage !== undefined) values.selectedPackage = input.selectedPackage;
  if (input.selectedItems !== undefined) values.selectedItems = input.selectedItems;
  if (input.productName !== undefined) values.productName = input.productName;
  if (input.mailQuan !== undefined) values.mailQuan = input.mailQuan;
  if (input.agentQuan !== undefined) values.agentQuan = input.agentQuan;
  if (input.quantity !== undefined) values.quantity = input.quantity;
  if (input.product2 !== undefined) values.product2 = input.product2;
  if (input.mailQuan2 !== undefined) values.mailQuan2 = input.mailQuan2;
  if (input.agentQuan2 !== undefined) values.agentQuan2 = input.agentQuan2;
  if (input.quantity2 !== undefined) values.quantity2 = input.quantity2;
  if (input.salesPrice !== undefined) values.salesPrice = input.salesPrice != null ? String(input.salesPrice) : null;
  if (input.pageUrl !== undefined) values.pageUrl = input.pageUrl;
  if (input.filledFieldsCount !== undefined) values.filledFieldsCount = input.filledFieldsCount;
  if (input.convertedToOrder !== undefined) values.convertedToOrder = input.convertedToOrder;
  if (input.convertedOrderId !== undefined) values.convertedOrderId = input.convertedOrderId;
  if (input.funnelName !== undefined) values.funnelName = input.funnelName;
  if (input.offerName !== undefined) values.offerName = input.offerName;
  if (input.subBrand !== undefined) values.subBrand = input.subBrand;
  if (input.note !== undefined) values.note = input.note;

  const [row] = await db
    .update(numbatrakAbandonedCarts)
    .set(values)
    .where(and(eq(numbatrakAbandonedCarts.organizationId, organizationId), eq(numbatrakAbandonedCarts.id, cartId)))
    .returning();
  return row ?? null;
}

export async function removeCart(db: Database, organizationId: string, cartId: string): Promise<boolean> {
  const result = await db
    .delete(numbatrakAbandonedCarts)
    .where(and(eq(numbatrakAbandonedCarts.organizationId, organizationId), eq(numbatrakAbandonedCarts.id, cartId)))
    .returning({ id: numbatrakAbandonedCarts.id });
  return result.length > 0;
}

export async function findCartForOrg(db: Database, organizationId: string, cartId: string): Promise<AbandonedCartRow | null> {
  const [row] = await db
    .select()
    .from(numbatrakAbandonedCarts)
    .where(and(eq(numbatrakAbandonedCarts.organizationId, organizationId), eq(numbatrakAbandonedCarts.id, cartId)))
    .limit(1);
  return row ?? null;
}

/**
 * markAsConverted's note-overwrite (destroys any prior note) is preserved
 * from the source app's own behavior - not a bug to "fix" without a product
 * decision.
 */
export async function markCartConverted(
  db: Database,
  organizationId: string,
  cartId: string,
  orderId: string,
): Promise<AbandonedCartRow | null> {
  const [row] = await db
    .update(numbatrakAbandonedCarts)
    .set({
      convertedToOrder: true,
      convertedOrderId: orderId,
      note: `Converted to customer order ${orderId}`,
      updatedAt: new Date(),
    })
    .where(and(eq(numbatrakAbandonedCarts.organizationId, organizationId), eq(numbatrakAbandonedCarts.id, cartId)))
    .returning();
  return row ?? null;
}
