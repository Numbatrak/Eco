import { and, desc, eq, gte, ilike, inArray, lt, or } from "drizzle-orm";
import {
  numbatrakAgents,
  numbatrakCustomerOrderItems,
  numbatrakCustomerOrders,
  numbatrakProducts,
  numbatrakUnifiedExpenses,
  user,
  type Database,
} from "@platform/db";
import type {
  CreateNumbatrakOrderRequest,
  ListNumbatrakOrdersQuery,
  NumbatrakOrder,
  NumbatrakOrderItem,
  UpdateNumbatrakOrderRequest,
} from "@platform/shared-types";
import { getNextAssignedUser } from "./assignment.js";
import { getNextStatus, isDeliveredStatus, statusFilterToDbValues } from "./order-status.js";
import { mergeOrderNotesOnSave } from "./order-notes.js";
import { createDeliveryMovement, productsAlreadyDelivered } from "./stock.js";

export type OrderRow = typeof numbatrakCustomerOrders.$inferSelect;
export type OrderItemRow = typeof numbatrakCustomerOrderItems.$inferSelect;

function serializeItem(row: OrderItemRow): NumbatrakOrderItem {
  return {
    id: row.id,
    orderId: row.orderId,
    productId: row.productId,
    quantity: row.quantity,
    unitPriceAtSubmission: row.unitPriceAtSubmission,
    unitCostAtSubmission: row.unitCostAtSubmission,
    totalPrice: row.totalPrice,
    totalCost: row.totalCost,
    profit: row.profit,
    createdAt: row.createdAt?.toISOString() ?? null,
  };
}

export async function attachRelations(
  db: Database,
  rows: OrderRow[],
): Promise<NumbatrakOrder[]> {
  if (rows.length === 0) return [];
  const orderIds = rows.map((r) => r.id);

  const itemRows = await db
    .select()
    .from(numbatrakCustomerOrderItems)
    .where(inArray(numbatrakCustomerOrderItems.orderId, orderIds));

  const itemsByOrder = new Map<string, NumbatrakOrderItem[]>();
  for (const item of itemRows) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(serializeItem(item));
    itemsByOrder.set(item.orderId, list);
  }

  const productIds = [...new Set(itemRows.map((i) => i.productId))];
  const productNames: Record<string, string> = {};
  if (productIds.length > 0) {
    const products = await db
      .select({ id: numbatrakProducts.id, name: numbatrakProducts.name })
      .from(numbatrakProducts)
      .where(inArray(numbatrakProducts.id, productIds));
    for (const p of products) productNames[p.id] = p.name;
  }

  const csrIds = [...new Set(rows.map((r) => r.csrId).filter((id): id is string => id != null))];
  const csrMap = new Map<string, { id: string; fullName: string | null; email: string | null }>();
  if (csrIds.length > 0) {
    const users = await db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(inArray(user.id, csrIds));
    for (const u of users) csrMap.set(u.id, { id: u.id, fullName: u.name, email: u.email });
  }

  const agentIds = [...new Set(rows.map((r) => r.agentId).filter((id): id is number => id != null))];
  const agentMap = new Map<number, { id: number; name: string }>();
  if (agentIds.length > 0) {
    const agents = await db
      .select({ id: numbatrakAgents.id, name: numbatrakAgents.name })
      .from(numbatrakAgents)
      .where(inArray(numbatrakAgents.id, agentIds));
    for (const a of agents) agentMap.set(a.id, a);
  }

  return rows.map((row) => ({
    id: row.id,
    csrId: row.csrId,
    agentId: row.agentId,
    status: row.status as NumbatrakOrder["status"],
    source: row.source as NumbatrakOrder["source"],
    customerName: row.customerName,
    phoneNumber: row.phoneNumber,
    state: row.state,
    deliveryAddress: row.deliveryAddress,
    orderRevenue: row.orderRevenue,
    orderCost: row.orderCost,
    amountPaid: row.amountPaid,
    deliveryFee: row.deliveryFee,
    profit: row.profit,
    notes: row.notes,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    offerName: row.offerName,
    funnelName: row.funnelName,
    subBrand: row.subBrand,
    abandonedCartId: row.abandonedCartId,
    moneyReceivedBy: (row.moneyReceivedBy ?? "agent_collected") as NumbatrakOrder["moneyReceivedBy"],
    items: itemsByOrder.get(row.id) ?? [],
    csr: row.csrId ? (csrMap.get(row.csrId) ?? null) : null,
    agent: row.agentId != null ? (agentMap.get(row.agentId) ?? null) : null,
    productNames,
  }));
}

export async function listOrdersForOrg(
  db: Database,
  organizationId: string,
  filters: ListNumbatrakOrdersQuery,
  csrScopeUserId?: string,
): Promise<NumbatrakOrder[]> {
  const conditions = [eq(numbatrakCustomerOrders.organizationId, organizationId)];

  if (filters.status) {
    const statuses = statusFilterToDbValues(filters.status);
    conditions.push(inArray(numbatrakCustomerOrders.status, statuses));
  }
  if (filters.formId) conditions.push(eq(numbatrakCustomerOrders.formId, filters.formId));
  // csrScopeUserId (set when the caller's org role is csr) overrides any requested csrId filter.
  const effectiveCsrId = csrScopeUserId ?? filters.csrId;
  if (effectiveCsrId) conditions.push(eq(numbatrakCustomerOrders.csrId, effectiveCsrId));
  if (filters.agentId != null) conditions.push(eq(numbatrakCustomerOrders.agentId, filters.agentId));
  if (filters.dateFrom) conditions.push(gte(numbatrakCustomerOrders.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setDate(end.getDate() + 1);
    conditions.push(lt(numbatrakCustomerOrders.createdAt, end));
  }
  if (filters.subBrand) conditions.push(eq(numbatrakCustomerOrders.subBrand, filters.subBrand));
  if (filters.funnelName) conditions.push(eq(numbatrakCustomerOrders.funnelName, filters.funnelName));
  if (filters.offerName) conditions.push(eq(numbatrakCustomerOrders.offerName, filters.offerName));
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(numbatrakCustomerOrders.customerName, term),
        ilike(numbatrakCustomerOrders.phoneNumber, term),
        ilike(numbatrakCustomerOrders.notes, term),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(numbatrakCustomerOrders)
    .where(and(...conditions))
    .orderBy(desc(numbatrakCustomerOrders.createdAt));

  return attachRelations(db, rows);
}

async function refreshOrderTotals(db: Database, orderId: string): Promise<void> {
  const items = await db
    .select({ totalPrice: numbatrakCustomerOrderItems.totalPrice, totalCost: numbatrakCustomerOrderItems.totalCost })
    .from(numbatrakCustomerOrderItems)
    .where(eq(numbatrakCustomerOrderItems.orderId, orderId));

  const revenue = items.reduce((sum, i) => sum + Number(i.totalPrice), 0);
  const cost = items.reduce((sum, i) => sum + Number(i.totalCost), 0);

  const [order] = await db
    .select({ deliveryFee: numbatrakCustomerOrders.deliveryFee })
    .from(numbatrakCustomerOrders)
    .where(eq(numbatrakCustomerOrders.id, orderId))
    .limit(1);
  const deliveryFee = order?.deliveryFee != null ? Number(order.deliveryFee) : 0;
  const profit = revenue - cost - deliveryFee;

  await db
    .update(numbatrakCustomerOrders)
    .set({
      orderRevenue: String(revenue),
      orderCost: String(cost),
      profit: String(profit),
      updatedAt: new Date(),
    })
    .where(eq(numbatrakCustomerOrders.id, orderId));
}

export async function createManualOrder(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakOrderRequest,
): Promise<NumbatrakOrder> {
  const lineTotals = input.items.map((line) => {
    const totalPrice = line.unitPriceAtSubmission * line.quantity;
    const totalCost = line.unitCostAtSubmission * line.quantity;
    return { ...line, totalPrice, totalCost, profit: totalPrice - totalCost };
  });
  const orderRevenue = lineTotals.reduce((s, l) => s + l.totalPrice, 0);
  const orderCost = lineTotals.reduce((s, l) => s + l.totalCost, 0);
  const deliveryFee = input.deliveryFee ?? 0;
  const moneyReceivedBy = input.moneyReceivedBy ?? "agent_collected";
  // Fix vs. the source app: createManualCustomerOrder() there never recomputes
  // totals after inserting items, leaving profit stuck at a placeholder 0
  // until some later edit happens to trigger a recompute - an unintentional
  // bug, not a design choice. Computed correctly here from the start.
  const profit = orderRevenue - orderCost - deliveryFee;

  const csrId = input.csrId ?? (await getNextAssignedUser(db, organizationId));

  const [order] = await db
    .insert(numbatrakCustomerOrders)
    .values({
      organizationId,
      csrId,
      agentId: input.agentId ?? null,
      source: "manual",
      status: "new",
      customerName: input.customerName,
      phoneNumber: input.phoneNumber ?? null,
      state: input.state ?? null,
      deliveryAddress: input.deliveryAddress ?? null,
      orderRevenue: String(orderRevenue),
      orderCost: String(orderCost),
      amountPaid: String(input.amountPaid ?? orderRevenue),
      deliveryFee: String(deliveryFee),
      profit: String(profit),
      notes: input.notes ?? null,
      funnelName: input.funnelName ?? null,
      offerName: input.offerName ?? null,
      subBrand: input.subBrand ?? null,
      moneyReceivedBy,
    })
    .returning();
  if (!order) throw new Error("Failed to create order");

  await db.insert(numbatrakCustomerOrderItems).values(
    lineTotals.map((l) => ({
      orderId: order.id,
      productId: l.productId,
      quantity: l.quantity,
      unitPriceAtSubmission: String(l.unitPriceAtSubmission),
      unitCostAtSubmission: String(l.unitCostAtSubmission),
      totalPrice: String(l.totalPrice),
      totalCost: String(l.totalCost),
      profit: String(l.profit),
    })),
  );

  const [full] = await attachRelations(db, [order]);
  return full!;
}

export async function findOrderForOrg(
  db: Database,
  organizationId: string,
  orderId: string,
): Promise<OrderRow | null> {
  const [row] = await db
    .select()
    .from(numbatrakCustomerOrders)
    .where(and(eq(numbatrakCustomerOrders.organizationId, organizationId), eq(numbatrakCustomerOrders.id, orderId)))
    .limit(1);
  return row ?? null;
}

export async function updateOrder(
  db: Database,
  organizationId: string,
  orderId: string,
  patch: UpdateNumbatrakOrderRequest,
): Promise<NumbatrakOrder | null> {
  const current = await findOrderForOrg(db, organizationId, orderId);
  if (!current) return null;

  const stampedNotes = patch.notes !== undefined ? mergeOrderNotesOnSave(current.notes, patch.notes) : undefined;

  const becomingDelivered =
    patch.status != null && isDeliveredStatus(patch.status) && !isDeliveredStatus(current.status);

  if (becomingDelivered) {
    const agentId = patch.agentId ?? current.agentId;
    if (agentId == null) {
      throw new Error("Assign a delivering agent before marking delivered.");
    }
    const items = await db
      .select()
      .from(numbatrakCustomerOrderItems)
      .where(eq(numbatrakCustomerOrderItems.orderId, orderId));
    const alreadyDelivered = await productsAlreadyDelivered(db, orderId);
    for (const item of items) {
      if (item.quantity <= 0 || alreadyDelivered.has(item.productId)) continue;
      await createDeliveryMovement(db, {
        organizationId,
        fromAgentId: agentId,
        productId: item.productId,
        quantity: item.quantity,
        orderId,
        cost: Number(item.unitCostAtSubmission),
      });
    }
  }

  const values: Partial<typeof numbatrakCustomerOrders.$inferInsert> = { updatedAt: new Date() };
  if (patch.status !== undefined) values.status = patch.status;
  if (stampedNotes !== undefined) values.notes = stampedNotes;
  if (patch.deliveryFee !== undefined) values.deliveryFee = patch.deliveryFee == null ? null : String(patch.deliveryFee);
  if (patch.amountPaid !== undefined) values.amountPaid = patch.amountPaid == null ? null : String(patch.amountPaid);
  if (patch.agentId !== undefined) values.agentId = patch.agentId;
  if (patch.moneyReceivedBy !== undefined) values.moneyReceivedBy = patch.moneyReceivedBy;
  if (becomingDelivered) values.completedAt = new Date();

  const [updated] = await db
    .update(numbatrakCustomerOrders)
    .set(values)
    .where(and(eq(numbatrakCustomerOrders.organizationId, organizationId), eq(numbatrakCustomerOrders.id, orderId)))
    .returning();
  if (!updated) return null;

  const [full] = await attachRelations(db, [updated]);
  return full!;
}

export async function advanceOrderStatus(
  db: Database,
  organizationId: string,
  orderId: string,
): Promise<NumbatrakOrder | null> {
  const current = await findOrderForOrg(db, organizationId, orderId);
  if (!current) return null;
  const next = getNextStatus(current.status);
  if (!next) {
    throw new Error("No further status to advance.");
  }
  return updateOrder(db, organizationId, orderId, { status: next as UpdateNumbatrakOrderRequest["status"] });
}

export async function markOrderFailedDelivery(
  db: Database,
  organizationId: string,
  orderId: string,
  options: { expenseAmount?: number; createdBy?: string | null },
): Promise<NumbatrakOrder | null> {
  const current = await findOrderForOrg(db, organizationId, orderId);
  if (!current) return null;
  if (isDeliveredStatus(current.status)) {
    throw new Error("Cannot mark a delivered order as failed.");
  }

  const amount = options.expenseAmount ?? (current.deliveryFee != null ? Number(current.deliveryFee) : 0);
  const updated = await updateOrder(db, organizationId, orderId, { status: "failed" });

  if (amount > 0) {
    const [firstItem] = await db
      .select({ productId: numbatrakCustomerOrderItems.productId })
      .from(numbatrakCustomerOrderItems)
      .where(eq(numbatrakCustomerOrderItems.orderId, orderId))
      .limit(1);

    await db
      .insert(numbatrakUnifiedExpenses)
      .values({
        organizationId,
        scope: "agent",
        category: "operational",
        subcategory: "failed_delivery",
        amount: String(amount),
        agentId: current.agentId,
        orderId,
        productId: firstItem?.productId ?? null,
        note: `Failed delivery — ${current.customerName || "order"}`,
        createdBy: options.createdBy ?? null,
        sourceType: "failed_delivery",
        sourceId: orderId,
      })
      .onConflictDoNothing();
  }

  return updated;
}

export async function addOrderUpsellLine(
  db: Database,
  organizationId: string,
  orderId: string,
  line: { productId: string; quantity: number; unitPriceAtSubmission: number; unitCostAtSubmission: number },
  addedByUserId: string | null,
): Promise<NumbatrakOrder | null> {
  const current = await findOrderForOrg(db, organizationId, orderId);
  if (!current) return null;
  if (isDeliveredStatus(current.status)) {
    throw new Error("Cannot add upsell to a delivered order.");
  }
  if (line.quantity <= 0) {
    throw new Error("Quantity must be positive.");
  }

  const totalPrice = line.unitPriceAtSubmission * line.quantity;
  const totalCost = line.unitCostAtSubmission * line.quantity;

  await db.insert(numbatrakCustomerOrderItems).values({
    orderId,
    productId: line.productId,
    quantity: line.quantity,
    unitPriceAtSubmission: String(line.unitPriceAtSubmission),
    unitCostAtSubmission: String(line.unitCostAtSubmission),
    totalPrice: String(totalPrice),
    totalCost: String(totalCost),
    profit: String(totalPrice - totalCost),
    // Whoever adds the upsell earns the payroll upsell-bonus credit for it
    // (Orders module's own confirmed decision) - null only if called with
    // no resolvable session, which shouldn't happen for an authenticated route.
    addedByUserId,
  });
  await refreshOrderTotals(db, orderId);

  const [full] = await attachRelations(db, [(await findOrderForOrg(db, organizationId, orderId))!]);
  return full!;
}

export async function deleteOrder(db: Database, organizationId: string, orderId: string): Promise<boolean> {
  const result = await db
    .delete(numbatrakCustomerOrders)
    .where(and(eq(numbatrakCustomerOrders.organizationId, organizationId), eq(numbatrakCustomerOrders.id, orderId)))
    .returning({ id: numbatrakCustomerOrders.id });
  return result.length > 0;
}
