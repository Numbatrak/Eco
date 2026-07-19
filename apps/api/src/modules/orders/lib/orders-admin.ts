import { and, desc, eq } from "drizzle-orm";
import { orders, orderItems, type Database } from "@platform/db";
import {
  ORDER_STATUS_TRANSITIONS,
  type OrderDetail,
  type OrderItem,
  type OrderStatusValue,
  type OrderSummary,
} from "@platform/shared-types";

type OrderRow = typeof orders.$inferSelect;

function serializeOrderSummary(row: OrderRow): OrderSummary {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    customerName: row.customerName,
    status: row.status,
    totalCents: row.totalCents,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listOrdersForTenant(
  db: Database,
  tenantId: string,
  customerId?: string,
): Promise<OrderSummary[]> {
  const rows = await db
    .select()
    .from(orders)
    .where(
      customerId
        ? and(eq(orders.tenantId, tenantId), eq(orders.customerId, customerId))
        : eq(orders.tenantId, tenantId),
    )
    .orderBy(desc(orders.createdAt));
  return rows.map(serializeOrderSummary);
}

export async function findOrderDetailForTenant(
  db: Database,
  tenantId: string,
  orderId: string,
): Promise<OrderDetail | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId)))
    .limit(1);
  if (!order) {
    return null;
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const serializedItems: OrderItem[] = items.map((item) => ({
    id: item.id,
    productId: item.productId,
    nameSnapshot: item.nameSnapshot,
    unitPriceSnapshotCents: item.unitPriceSnapshotCents,
    quantity: item.quantity,
    lineTotalCents: item.unitPriceSnapshotCents * item.quantity,
  }));

  return {
    ...serializeOrderSummary(order),
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    subtotalCents: order.subtotalCents,
    deliveryAddress: order.deliveryAddress,
    deliveryCity: order.deliveryCity,
    deliveryState: order.deliveryState,
    deliveryFeeCents: order.deliveryFeeCents,
    vatAmountCents: order.vatAmountCents,
    paymentProvider: order.paymentProvider,
    paymentReference: order.paymentReference,
    items: serializedItems,
  };
}

export type UpdateOrderStatusResult = "updated" | "not_found" | "invalid_transition";

export async function updateOrderStatus(
  db: Database,
  tenantId: string,
  orderId: string,
  status: OrderStatusValue,
): Promise<UpdateOrderStatusResult> {
  const [order] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId)))
    .limit(1);
  if (!order) {
    return "not_found";
  }
  if (!ORDER_STATUS_TRANSITIONS[order.status].includes(status)) {
    return "invalid_transition";
  }

  await db
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId)));
  return "updated";
}
