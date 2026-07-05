import { and, eq } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { orders, orderItems, type Database } from "@platform/db";
import { sendEmail } from "../../auth/lib/email.js";
import { generateOrderNumber } from "./order-number.js";

export type OrderRow = typeof orders.$inferSelect;

export interface OrderItemInput {
  productId: string;
  nameSnapshot: string;
  unitPriceSnapshotCents: number;
  quantity: number;
}

export interface CreateOrderParams {
  tenantId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  currency: string;
  subtotalCents: number;
  totalCents: number;
  paymentProvider: "paystack" | "flutterwave";
  items: OrderItemInput[];
}

const MAX_ORDER_NUMBER_ATTEMPTS = 5;

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

/**
 * Creates the order + snapshot line items in one transaction. Retries on an
 * order_number collision only (astronomically unlikely at 31^8 combinations,
 * but cheap to guard) - any other error surfaces immediately.
 */
export async function createPendingOrder(
  db: Database,
  params: CreateOrderParams,
): Promise<OrderRow> {
  return db.transaction(async (tx) => {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ORDER_NUMBER_ATTEMPTS; attempt++) {
      try {
        const [order] = await tx
          .insert(orders)
          .values({
            tenantId: params.tenantId,
            orderNumber: generateOrderNumber(),
            customerName: params.customerName,
            customerEmail: params.customerEmail,
            customerPhone: params.customerPhone,
            currency: params.currency,
            subtotalCents: params.subtotalCents,
            totalCents: params.totalCents,
            paymentProvider: params.paymentProvider,
          })
          .returning();
        if (!order) {
          throw new Error("Failed to create order");
        }
        await tx.insert(orderItems).values(
          params.items.map((item) => ({
            orderId: order.id,
            productId: item.productId,
            nameSnapshot: item.nameSnapshot,
            unitPriceSnapshotCents: item.unitPriceSnapshotCents,
            quantity: item.quantity,
          })),
        );
        return order;
      } catch (err) {
        lastError = err;
        if (!isUniqueViolation(err)) {
          throw err;
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to create order after retries");
  });
}

export async function setOrderPaymentReference(
  db: Database,
  orderId: string,
  reference: string,
): Promise<void> {
  await db
    .update(orders)
    .set({ paymentReference: reference, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

export async function findOrderByReference(
  db: Database,
  paymentReference: string,
): Promise<OrderRow | null> {
  const [row] = await db
    .select()
    .from(orders)
    .where(eq(orders.paymentReference, paymentReference))
    .limit(1);
  return row ?? null;
}

export async function findOrderById(
  db: Database,
  tenantId: string,
  orderId: string,
): Promise<OrderRow | null> {
  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId)))
    .limit(1);
  return row ?? null;
}

/** Conditional update - only flips while still pending, so a webhook and a status-poll racing each other can't double-process. */
async function transitionPendingOrder(
  db: Database,
  orderId: string,
  to: "paid" | "failed",
): Promise<boolean> {
  const result = await db
    .update(orders)
    .set({ status: to, updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .returning({ id: orders.id });
  return result.length > 0;
}

/** Returns true only if this call performed the pending->paid transition (false if already settled). */
export async function markOrderPaid(
  db: Database,
  logger: FastifyBaseLogger,
  order: OrderRow,
): Promise<boolean> {
  const transitioned = await transitionPendingOrder(db, order.id, "paid");
  if (!transitioned) {
    return false;
  }
  const amount = (order.totalCents / 100).toFixed(2);
  await sendEmail(logger, {
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} confirmed`,
    body: `Thanks, ${order.customerName}! Your order ${order.orderNumber} (${amount} ${order.currency}) is confirmed.`,
  });
  // TODO(whatsapp): send an order-confirmation WhatsApp notification here once
  // that integration is built - explicitly out of scope for this task, this
  // comment marks the intended call site.
  return true;
}

export async function markOrderFailed(db: Database, order: OrderRow): Promise<boolean> {
  return transitionPendingOrder(db, order.id, "failed");
}
