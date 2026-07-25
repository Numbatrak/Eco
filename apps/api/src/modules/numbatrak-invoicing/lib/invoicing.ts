import { and, desc, eq, sql } from "drizzle-orm";
import { numbatrakInvoices, numbatrakCustomerOrders, numbatrakCustomerOrderItems, numbatrakProducts, type Database } from "@platform/db";

type InvoiceRow = typeof numbatrakInvoices.$inferSelect;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function serialize(row: InvoiceRow) {
  return {
    id: row.id,
    orderId: row.orderId,
    invoiceNumber: row.invoiceNumber,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerAddress: row.customerAddress,
    subtotal: num(row.subtotal),
    deliveryFee: num(row.deliveryFee),
    total: num(row.total),
    lineItems: JSON.parse(row.lineItems || "[]"),
    notes: row.notes,
    status: row.status,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

async function generateInvoiceNumber(db: Database, organizationId: string): Promise<string> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(numbatrakInvoices)
    .where(eq(numbatrakInvoices.organizationId, organizationId));
  const seq = (Number(result?.count) || 0) + 1;
  return `INV-${String(seq).padStart(5, "0")}`;
}

export async function listInvoices(db: Database, organizationId: string) {
  const rows = await db
    .select()
    .from(numbatrakInvoices)
    .where(eq(numbatrakInvoices.organizationId, organizationId))
    .orderBy(desc(numbatrakInvoices.createdAt));
  return rows.map(serialize);
}

export async function getInvoice(db: Database, organizationId: string, invoiceId: string) {
  const [row] = await db
    .select()
    .from(numbatrakInvoices)
    .where(and(eq(numbatrakInvoices.id, invoiceId), eq(numbatrakInvoices.organizationId, organizationId)));
  return row ? serialize(row) : null;
}

export async function createInvoice(
  db: Database,
  organizationId: string,
  input: {
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    lineItems?: { name: string; quantity: number; unitPrice: number }[];
    deliveryFee?: number;
    notes?: string;
    createdBy?: string;
  },
) {
  const invoiceNumber = await generateInvoiceNumber(db, organizationId);
  const items = input.lineItems ?? [];
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const deliveryFee = input.deliveryFee ?? 0;
  const total = subtotal + deliveryFee;

  const [row] = await db
    .insert(numbatrakInvoices)
    .values({
      organizationId,
      invoiceNumber,
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      customerAddress: input.customerAddress ?? null,
      subtotal: String(subtotal),
      deliveryFee: String(deliveryFee),
      total: String(total),
      lineItems: JSON.stringify(items),
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning();
  return serialize(row!);
}

export async function createInvoiceFromOrder(
  db: Database,
  organizationId: string,
  orderId: string,
  createdBy?: string,
) {
  const [order] = await db
    .select()
    .from(numbatrakCustomerOrders)
    .where(and(eq(numbatrakCustomerOrders.id, orderId), eq(numbatrakCustomerOrders.organizationId, organizationId)));
  if (!order) throw new Error("Order not found");

  const orderItems = await db
    .select({
      quantity: numbatrakCustomerOrderItems.quantity,
      unitPrice: numbatrakCustomerOrderItems.unitPriceAtSubmission,
      totalPrice: numbatrakCustomerOrderItems.totalPrice,
      productId: numbatrakCustomerOrderItems.productId,
    })
    .from(numbatrakCustomerOrderItems)
    .where(eq(numbatrakCustomerOrderItems.orderId, orderId));

  let lineItems: { name: string; quantity: number; unitPrice: number }[] = [];

  if (orderItems.length > 0) {
    const productIds = orderItems.map((i) => i.productId);
    const products = await db
      .select({ id: numbatrakProducts.id, name: numbatrakProducts.name })
      .from(numbatrakProducts)
      .where(sql`${numbatrakProducts.id} IN ${productIds}`);
    const productMap = new Map(products.map((p) => [p.id, p.name]));

    lineItems = orderItems.map((item) => ({
      name: productMap.get(item.productId) ?? "Product",
      quantity: item.quantity,
      unitPrice: num(item.unitPrice),
    }));
  } else {
    const subtotal = num(order.orderRevenue) - num(order.deliveryFee);
    lineItems = [{ name: "Order Total", quantity: 1, unitPrice: Math.max(subtotal, 0) }];
  }

  const invoiceNumber = await generateInvoiceNumber(db, organizationId);
  const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const deliveryFee = num(order.deliveryFee);
  const total = subtotal + deliveryFee;

  const [row] = await db
    .insert(numbatrakInvoices)
    .values({
      organizationId,
      orderId,
      invoiceNumber,
      customerName: order.customerName,
      customerPhone: order.phoneNumber,
      customerAddress: order.deliveryAddress,
      subtotal: String(subtotal),
      deliveryFee: String(deliveryFee),
      total: String(total),
      lineItems: JSON.stringify(lineItems),
      createdBy: createdBy ?? null,
    })
    .returning();
  return serialize(row!);
}

export async function markInvoiceSent(db: Database, organizationId: string, invoiceId: string) {
  const [row] = await db
    .update(numbatrakInvoices)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(and(eq(numbatrakInvoices.id, invoiceId), eq(numbatrakInvoices.organizationId, organizationId)))
    .returning();
  if (!row) throw new Error("Invoice not found");
  return serialize(row);
}

export async function markInvoicePaid(db: Database, organizationId: string, invoiceId: string) {
  const [row] = await db
    .update(numbatrakInvoices)
    .set({ status: "paid", updatedAt: new Date() })
    .where(and(eq(numbatrakInvoices.id, invoiceId), eq(numbatrakInvoices.organizationId, organizationId)))
    .returning();
  if (!row) throw new Error("Invoice not found");
  return serialize(row);
}

export async function voidInvoice(db: Database, organizationId: string, invoiceId: string) {
  const [row] = await db
    .update(numbatrakInvoices)
    .set({ status: "void", updatedAt: new Date() })
    .where(and(eq(numbatrakInvoices.id, invoiceId), eq(numbatrakInvoices.organizationId, organizationId)))
    .returning();
  if (!row) throw new Error("Invoice not found");
  return serialize(row);
}
