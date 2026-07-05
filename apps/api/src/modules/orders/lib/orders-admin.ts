import { and, desc, eq } from "drizzle-orm";
import { orders, orderItems, type Database } from "@platform/db";
import type { OrderDetail, OrderItem, OrderSummary } from "@platform/shared-types";

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

export async function listOrdersForTenant(db: Database, tenantId: string): Promise<OrderSummary[]> {
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.tenantId, tenantId))
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
    paymentProvider: order.paymentProvider,
    paymentReference: order.paymentReference,
    items: serializedItems,
  };
}
