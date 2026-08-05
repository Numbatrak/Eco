import { and, eq } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { orders, orderItems, type Database } from "@platform/db";
import { sendEmail } from "../../auth/lib/email.js";
import { orderConfirmationEmail } from "../../../lib/email-templates.js";
import { generateOrderNumber } from "./order-number.js";
import { isUniqueViolation } from "../../../lib/db-errors.js";
import { incrementCustomerStats } from "../../customers/lib/customers.js";
import { findAnalyticsSettings } from "../../analytics/lib/analytics-settings-store.js";
import { sendPurchaseCapiEvent } from "../../../lib/analytics/meta-capi.js";

export type OrderRow = typeof orders.$inferSelect;

export interface OrderItemInput {
  productId: string;
  nameSnapshot: string;
  unitPriceSnapshotCents: number;
  quantity: number;
}

export interface CreateOrderParams {
  tenantId: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  currency: string;
  subtotalCents: number;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryFeeCents: number;
  vatRateBps: number | null;
  vatAmountCents: number;
  totalCents: number;
  paymentProvider: "paystack" | "flutterwave";
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  landingPath?: string;
  fbclid?: string;
  ttclid?: string;
  gclid?: string;
  items: OrderItemInput[];
}

const MAX_ORDER_NUMBER_ATTEMPTS = 5;

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
            customerId: params.customerId,
            orderNumber: generateOrderNumber(),
            customerName: params.customerName,
            customerEmail: params.customerEmail,
            customerPhone: params.customerPhone,
            currency: params.currency,
            subtotalCents: params.subtotalCents,
            deliveryAddress: params.deliveryAddress,
            deliveryCity: params.deliveryCity,
            deliveryState: params.deliveryState,
            deliveryFeeCents: params.deliveryFeeCents,
            vatRateBps: params.vatRateBps,
            vatAmountCents: params.vatAmountCents,
            totalCents: params.totalCents,
            paymentProvider: params.paymentProvider,
            utmSource: params.utmSource,
            utmMedium: params.utmMedium,
            utmCampaign: params.utmCampaign,
            utmTerm: params.utmTerm,
            utmContent: params.utmContent,
            referrer: params.referrer,
            landingPath: params.landingPath,
            fbclid: params.fbclid,
            ttclid: params.ttclid,
            gclid: params.gclid,
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
  if (order.customerId) {
    await incrementCustomerStats(db, order.customerId, order.totalCents);
  }
  const amount = (order.totalCents / 100).toFixed(2);
  await sendEmail(logger, {
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} confirmed`,
    body: orderConfirmationEmail({
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      amount,
      currency: order.currency,
    }),
  });
  // TODO(whatsapp): send an order-confirmation WhatsApp notification here once
  // that integration is built - explicitly out of scope for this task, this
  // comment marks the intended call site.

  // Best-effort, same as the email above - a failed Conversions API call
  // must never block the payment from settling.
  try {
    const analyticsSettings = await findAnalyticsSettings(db, order.tenantId);
    if (analyticsSettings?.enabled && analyticsSettings.metaPixelId && analyticsSettings.metaCapiTokenEncrypted) {
      await sendPurchaseCapiEvent(
        {
          id: order.id,
          totalCents: order.totalCents,
          currency: order.currency,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
        },
        {
          metaPixelId: analyticsSettings.metaPixelId,
          metaCapiTokenEncrypted: analyticsSettings.metaCapiTokenEncrypted,
        },
      );
    }
  } catch (err) {
    logger.warn({ err, orderId: order.id }, "Meta CAPI Purchase event failed");
  }

  return true;
}

export async function markOrderFailed(db: Database, order: OrderRow): Promise<boolean> {
  return transitionPendingOrder(db, order.id, "failed");
}
