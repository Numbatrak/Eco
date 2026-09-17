import { and, eq, desc, sql } from "drizzle-orm";
import {
  numbatrakCustomers,
  numbatrakCustomerOrders,
  numbatrakCustomerOrderItems,
  numbatrakUnifiedExpenses,
  numbatrakExpenseSubcategories,
  numbatrakFeedbackSettings,
  numbatrakFeedbackCalls,
  numbatrakComplaints,
  numbatrakMorePurchases,
  numbatrakCampaigns,
  numbatrakCrmCredits,
  numbatrakProducts,
  user,
  type Database,
  type Queryable,
} from "@platform/db";
import type {
  NumbatrakCustomer,
  NumbatrakFeedbackSettings,
  NumbatrakFeedbackCall,
  NumbatrakComplaint,
  NumbatrakMorePurchase,
  NumbatrakCampaign,
  NumbatrakCrmCredit,
  NumbatrakFeedbackDashboard,
  NumbatrakComplaintDashboard,
} from "@platform/shared-types";
import type { FastifyBaseLogger } from "fastify";
import { normalizePhoneInput } from "../../numbatrak-forms/lib/validation.js";
import { createReplacementMovement, createMorePurchaseMovement } from "../../numbatrak-orders/lib/stock.js";
import { sendEmail } from "../../auth/lib/email.js";
import { sendWhatsAppTemplate } from "../../../lib/whatsapp.js";

type CustomerRow = typeof numbatrakCustomers.$inferSelect;
type FeedbackSettingsRow = typeof numbatrakFeedbackSettings.$inferSelect;
type FeedbackCallRow = typeof numbatrakFeedbackCalls.$inferSelect;
type ComplaintRow = typeof numbatrakComplaints.$inferSelect;
type MorePurchaseRow = typeof numbatrakMorePurchases.$inferSelect;
type CampaignRow = typeof numbatrakCampaigns.$inferSelect;
type CreditRow = typeof numbatrakCrmCredits.$inferSelect;

function serializeCustomer(
  row: CustomerRow,
  orderRevenue: number,
  morePurchaseRevenue: number,
  orderCount: number,
  morePurchaseCount: number,
  latestOrderStatus: string | null = null,
): NumbatrakCustomer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    whatsapp: row.whatsapp,
    location: row.location,
    firstClickSource: row.firstClickSource,
    lastClickSource: row.lastClickSource,
    notes: row.notes,
    ltv: orderRevenue + morePurchaseRevenue,
    orderRevenue,
    morePurchaseRevenue,
    orderCount,
    morePurchaseCount,
    latestOrderStatus,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeFeedbackSettings(row: FeedbackSettingsRow): NumbatrakFeedbackSettings {
  return {
    id: row.id,
    callWindowDays: row.callWindowDays,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeFeedbackCall(
  row: FeedbackCallRow & { customerName?: string | null; customerPhone?: string | null; assignedToName?: string | null },
): NumbatrakFeedbackCall {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: (row as any).customerName ?? null,
    customerPhone: (row as any).customerPhone ?? null,
    orderId: row.orderId,
    assignedTo: row.assignedTo,
    assignedToName: (row as any).assignedToName ?? null,
    scheduledAt: row.scheduledAt.toISOString(),
    disposition: row.disposition as NumbatrakFeedbackCall["disposition"],
    satisfactionScore: row.satisfactionScore,
    reorderLikelihood: row.reorderLikelihood as NumbatrakFeedbackCall["reorderLikelihood"],
    callbackAt: row.callbackAt?.toISOString() ?? null,
    attempts: row.attempts,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeComplaint(
  row: ComplaintRow & { customerName?: string | null },
): NumbatrakComplaint {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: (row as any).customerName ?? null,
    orderId: row.orderId,
    complaintType: row.complaintType as NumbatrakComplaint["complaintType"],
    description: row.description,
    attachments: row.attachments,
    status: row.status as NumbatrakComplaint["status"],
    resolution: row.resolution,
    resolutionType: row.resolutionType as NumbatrakComplaint["resolutionType"],
    escalatedAt: row.escalatedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedBy: row.resolvedBy,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeMorePurchase(
  row: MorePurchaseRow & { customerName?: string | null },
): NumbatrakMorePurchase {
  const amount = Number(row.amount);
  const cogs = Number(row.cogs);
  const deliveryCost = Number(row.deliveryCost);
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: (row as any).customerName ?? null,
    feedbackCallId: row.feedbackCallId,
    productId: row.productId,
    productName: row.productName,
    quantity: row.quantity,
    amount,
    cogs,
    deliveryCost,
    profit: amount - cogs - deliveryCost,
    agentId: row.agentId,
    status: row.status,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeCampaign(row: CampaignRow): NumbatrakCampaign {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel as NumbatrakCampaign["channel"],
    segmentFilter: row.segmentFilter,
    subject: row.subject,
    body: row.body,
    recipientCount: row.recipientCount,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    status: row.status as NumbatrakCampaign["status"],
    sentAt: row.sentAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeCredit(row: CreditRow): NumbatrakCrmCredit {
  return {
    channel: row.channel as NumbatrakCrmCredit["channel"],
    balance: row.balance,
  };
}

// --- Feedback Settings ---

export async function getOrCreateFeedbackSettings(
  db: Database,
  organizationId: string,
): Promise<NumbatrakFeedbackSettings> {
  const existing = await db
    .select()
    .from(numbatrakFeedbackSettings)
    .where(eq(numbatrakFeedbackSettings.organizationId, organizationId))
    .limit(1);
  if (existing.length > 0) return serializeFeedbackSettings(existing[0]!);
  const [created] = await db
    .insert(numbatrakFeedbackSettings)
    .values({ organizationId })
    .onConflictDoNothing()
    .returning();
  if (created) return serializeFeedbackSettings(created);
  const [fallback] = await db
    .select()
    .from(numbatrakFeedbackSettings)
    .where(eq(numbatrakFeedbackSettings.organizationId, organizationId))
    .limit(1);
  return serializeFeedbackSettings(fallback!);
}

export async function updateFeedbackSettings(
  db: Database,
  organizationId: string,
  body: Record<string, unknown>,
): Promise<NumbatrakFeedbackSettings> {
  await getOrCreateFeedbackSettings(db, organizationId);
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.callWindowDays === "number") values.callWindowDays = body.callWindowDays;
  const [updated] = await db
    .update(numbatrakFeedbackSettings)
    .set(values)
    .where(eq(numbatrakFeedbackSettings.organizationId, organizationId))
    .returning();
  return serializeFeedbackSettings(updated!);
}

// --- Customers ---

interface OrderStats {
  revenue: number;
  count: number;
  latestStatus: string | null;
}

/** Real order revenue/count/latest-status per customer, replacing the hardcoded 0s this used to ship with (no customerId FK existed to join through). */
async function getOrderStatsMap(db: Database, organizationId: string): Promise<Map<string, OrderStats>> {
  const rows = await db
    .select({
      customerId: numbatrakCustomerOrders.customerId,
      totalRevenue: sql<string>`COALESCE(SUM(${numbatrakCustomerOrders.orderRevenue}), 0)`,
      totalCount: sql<number>`COUNT(*)::int`,
      latestStatus: sql<string | null>`(array_agg(${numbatrakCustomerOrders.status} ORDER BY ${numbatrakCustomerOrders.createdAt} DESC))[1]`,
    })
    .from(numbatrakCustomerOrders)
    .where(and(eq(numbatrakCustomerOrders.organizationId, organizationId), sql`${numbatrakCustomerOrders.customerId} IS NOT NULL`))
    .groupBy(numbatrakCustomerOrders.customerId);

  return new Map(
    rows
      .filter((r): r is typeof r & { customerId: string } => r.customerId != null)
      .map((r) => [r.customerId, { revenue: Number(r.totalRevenue), count: r.totalCount, latestStatus: r.latestStatus }]),
  );
}

export async function listCustomers(
  db: Database,
  organizationId: string,
  filters: { status?: string } = {},
): Promise<NumbatrakCustomer[]> {
  const rows = await db
    .select()
    .from(numbatrakCustomers)
    .where(eq(numbatrakCustomers.organizationId, organizationId))
    .orderBy(desc(numbatrakCustomers.createdAt));

  if (rows.length === 0) return [];

  const [morePurchaseStats, orderStats] = await Promise.all([
    db
      .select({
        customerId: numbatrakMorePurchases.customerId,
        totalRevenue: sql<string>`COALESCE(SUM(${numbatrakMorePurchases.amount}), 0)`,
        totalCount: sql<number>`COUNT(*)::int`,
      })
      .from(numbatrakMorePurchases)
      .where(eq(numbatrakMorePurchases.organizationId, organizationId))
      .groupBy(numbatrakMorePurchases.customerId),
    getOrderStatsMap(db, organizationId),
  ]);

  const mpMap = new Map(morePurchaseStats.map((s) => [s.customerId, { revenue: Number(s.totalRevenue), count: s.totalCount }]));

  const customers = rows.map((row) => {
    const mp = mpMap.get(row.id) ?? { revenue: 0, count: 0 };
    const order = orderStats.get(row.id) ?? { revenue: 0, count: 0, latestStatus: null };
    return serializeCustomer(row, order.revenue, mp.revenue, order.count, mp.count, order.latestStatus);
  });

  return filters.status ? customers.filter((c) => c.latestOrderStatus === filters.status) : customers;
}

export async function getCustomer(
  db: Database,
  organizationId: string,
  customerId: string,
): Promise<NumbatrakCustomer | null> {
  const [row] = await db
    .select()
    .from(numbatrakCustomers)
    .where(and(eq(numbatrakCustomers.organizationId, organizationId), eq(numbatrakCustomers.id, customerId)))
    .limit(1);
  if (!row) return null;

  const [mpStats] = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(${numbatrakMorePurchases.amount}), 0)`,
      totalCount: sql<number>`COUNT(*)::int`,
    })
    .from(numbatrakMorePurchases)
    .where(and(eq(numbatrakMorePurchases.organizationId, organizationId), eq(numbatrakMorePurchases.customerId, customerId)));

  const [orderStats] = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(${numbatrakCustomerOrders.orderRevenue}), 0)`,
      totalCount: sql<number>`COUNT(*)::int`,
      latestStatus: sql<string | null>`(array_agg(${numbatrakCustomerOrders.status} ORDER BY ${numbatrakCustomerOrders.createdAt} DESC))[1]`,
    })
    .from(numbatrakCustomerOrders)
    .where(and(eq(numbatrakCustomerOrders.organizationId, organizationId), eq(numbatrakCustomerOrders.customerId, customerId)));

  return serializeCustomer(
    row,
    Number(orderStats?.totalRevenue ?? 0),
    Number(mpStats?.totalRevenue ?? 0),
    orderStats?.totalCount ?? 0,
    mpStats?.totalCount ?? 0,
    orderStats?.latestStatus ?? null,
  );
}

export async function createCustomer(
  db: Database,
  organizationId: string,
  body: { name: string; phone: string; email?: string | null; whatsapp?: string | null; location?: string | null; firstClickSource?: string | null; lastClickSource?: string | null; notes?: string | null },
): Promise<NumbatrakCustomer> {
  const [created] = await db
    .insert(numbatrakCustomers)
    .values({
      organizationId,
      name: body.name,
      phone: normalizePhoneInput(body.phone),
      email: body.email ?? null,
      whatsapp: body.whatsapp ?? null,
      location: body.location ?? null,
      firstClickSource: body.firstClickSource ?? null,
      lastClickSource: body.lastClickSource ?? null,
      notes: body.notes ?? null,
    })
    .returning();
  return serializeCustomer(created!, 0, 0, 0, 0);
}

export async function updateCustomer(
  db: Database,
  organizationId: string,
  customerId: string,
  body: Record<string, unknown>,
): Promise<NumbatrakCustomer | null> {
  const existing = await getCustomer(db, organizationId, customerId);
  if (!existing) return null;
  const values: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["name", "phone", "email", "whatsapp", "location", "firstClickSource", "lastClickSource", "notes"] as const) {
    if (body[key] !== undefined) values[key] = key === "phone" && typeof body[key] === "string" ? normalizePhoneInput(body[key] as string) : body[key];
  }
  const [updated] = await db
    .update(numbatrakCustomers)
    .set(values)
    .where(and(eq(numbatrakCustomers.organizationId, organizationId), eq(numbatrakCustomers.id, customerId)))
    .returning();
  return serializeCustomer(
    updated!,
    existing.orderRevenue,
    existing.morePurchaseRevenue,
    existing.orderCount,
    existing.morePurchaseCount,
    existing.latestOrderStatus,
  );
}

export interface FindOrCreateCustomerInput {
  name: string;
  phone: string;
  email?: string | null;
  whatsapp?: string | null;
  location?: string | null;
  /** Null for order-creation paths with no click context (e.g. a manual dashboard order) - leaves both click-source columns untouched. */
  clickSource: string | null;
}

/**
 * Find-or-create a customer by (organizationId, phone) - the link point for
 * "every order creates/updates a customer" (PHASE-NEXT-FEATURES.md's locked
 * CRM rule). Single atomic upsert on the existing unique index, modeled on
 * the storefront's own upsertCustomer (customers/lib/customers.ts). Click
 * source is sticky on first-touch (COALESCE keeps whatever was already
 * there) and always refreshed on last-touch (new value wins when present).
 */
export async function findOrCreateCustomer(
  db: Queryable,
  organizationId: string,
  input: FindOrCreateCustomerInput,
): Promise<CustomerRow> {
  const phone = normalizePhoneInput(input.phone);
  const [row] = await db
    .insert(numbatrakCustomers)
    .values({
      organizationId,
      name: input.name,
      phone,
      email: input.email ?? null,
      whatsapp: input.whatsapp ?? null,
      location: input.location ?? null,
      firstClickSource: input.clickSource,
      lastClickSource: input.clickSource,
    })
    .onConflictDoUpdate({
      target: [numbatrakCustomers.organizationId, numbatrakCustomers.phone],
      set: {
        name: input.name,
        email: sql`COALESCE(${input.email ?? null}, ${numbatrakCustomers.email})`,
        whatsapp: sql`COALESCE(${input.whatsapp ?? null}, ${numbatrakCustomers.whatsapp})`,
        location: sql`COALESCE(${input.location ?? null}, ${numbatrakCustomers.location})`,
        firstClickSource: sql`COALESCE(${numbatrakCustomers.firstClickSource}, ${input.clickSource})`,
        lastClickSource: sql`COALESCE(${input.clickSource}, ${numbatrakCustomers.lastClickSource})`,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) throw new Error("Failed to find-or-create customer");
  return row;
}

// --- Feedback Calls ---

export async function listFeedbackCalls(
  db: Database,
  organizationId: string,
): Promise<NumbatrakFeedbackCall[]> {
  const rows = await db
    .select({
      call: numbatrakFeedbackCalls,
      customerName: numbatrakCustomers.name,
      customerPhone: numbatrakCustomers.phone,
      assignedToName: user.name,
    })
    .from(numbatrakFeedbackCalls)
    .leftJoin(numbatrakCustomers, eq(numbatrakFeedbackCalls.customerId, numbatrakCustomers.id))
    .leftJoin(user, eq(numbatrakFeedbackCalls.assignedTo, user.id))
    .where(eq(numbatrakFeedbackCalls.organizationId, organizationId))
    .orderBy(desc(numbatrakFeedbackCalls.scheduledAt));

  return rows.map((r) =>
    serializeFeedbackCall({ ...r.call, customerName: r.customerName, customerPhone: r.customerPhone, assignedToName: r.assignedToName }),
  );
}

export async function createFeedbackCall(
  db: Database,
  organizationId: string,
  body: { customerId: string; orderId?: string | null; assignedTo?: string | null; scheduledAt: string },
): Promise<NumbatrakFeedbackCall> {
  const [created] = await db
    .insert(numbatrakFeedbackCalls)
    .values({
      organizationId,
      customerId: body.customerId,
      orderId: body.orderId ?? null,
      assignedTo: body.assignedTo ?? null,
      scheduledAt: new Date(body.scheduledAt),
    })
    .returning();
  return serializeFeedbackCall(created!);
}

export async function dispositionFeedbackCall(
  db: Database,
  organizationId: string,
  callId: string,
  body: { disposition: string; satisfactionScore?: number | null; reorderLikelihood?: string | null; callbackAt?: string | null },
): Promise<NumbatrakFeedbackCall | null> {
  const values: Record<string, unknown> = {
    disposition: body.disposition,
    attempts: sql`${numbatrakFeedbackCalls.attempts} + 1`,
    updatedAt: new Date(),
  };
  if (body.satisfactionScore !== undefined) values.satisfactionScore = body.satisfactionScore;
  if (body.reorderLikelihood !== undefined) values.reorderLikelihood = body.reorderLikelihood;
  if (body.callbackAt !== undefined) values.callbackAt = body.callbackAt ? new Date(body.callbackAt) : null;
  if (body.disposition === "answered") values.completedAt = new Date();
  const [updated] = await db
    .update(numbatrakFeedbackCalls)
    .set(values)
    .where(and(eq(numbatrakFeedbackCalls.organizationId, organizationId), eq(numbatrakFeedbackCalls.id, callId)))
    .returning();
  if (!updated) return null;
  return serializeFeedbackCall(updated);
}

// --- Complaints ---

export async function listComplaints(
  db: Database,
  organizationId: string,
): Promise<NumbatrakComplaint[]> {
  const rows = await db
    .select({
      complaint: numbatrakComplaints,
      customerName: numbatrakCustomers.name,
    })
    .from(numbatrakComplaints)
    .leftJoin(numbatrakCustomers, eq(numbatrakComplaints.customerId, numbatrakCustomers.id))
    .where(eq(numbatrakComplaints.organizationId, organizationId))
    .orderBy(desc(numbatrakComplaints.createdAt));

  return rows.map((r) => serializeComplaint({ ...r.complaint, customerName: r.customerName }));
}

export async function createComplaint(
  db: Database,
  organizationId: string,
  body: { customerId: string; orderId?: string | null; complaintType?: string | null; description: string; attachments?: string | null },
): Promise<NumbatrakComplaint> {
  const [created] = await db
    .insert(numbatrakComplaints)
    .values({
      organizationId,
      customerId: body.customerId,
      orderId: body.orderId ?? null,
      complaintType: body.complaintType ?? null,
      description: body.description,
      attachments: body.attachments ?? null,
    })
    .returning();
  return serializeComplaint(created!);
}

export async function escalateComplaint(
  db: Database,
  organizationId: string,
  complaintId: string,
): Promise<NumbatrakComplaint | null> {
  const [updated] = await db
    .update(numbatrakComplaints)
    .set({ status: "escalated", escalatedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(numbatrakComplaints.organizationId, organizationId), eq(numbatrakComplaints.id, complaintId)))
    .returning();
  if (!updated) return null;
  return serializeComplaint(updated);
}

/**
 * Refund reverses the sale - flip the order to "refunded" and stop there.
 * Its profit disappears from accounting for free (getAccountingReport and
 * every isDeliveredStatus check only match 'delivered'/'completed'), so no
 * expense is booked - booking one here would double-count the loss.
 *
 * Replacement leaves the original sale alone (the customer keeps it) but the
 * free replacement unit is a real cost: one unit's cost plus the order's
 * delivery fee, booked into a "chargeback" operational expense, and the unit
 * itself comes out of inventory exactly like a normal delivery.
 */
async function applyComplaintResolutionSideEffects(
  db: Database,
  organizationId: string,
  complaintId: string,
  complaint: { orderId: string | null },
  body: { resolutionType: string; productId?: string | null },
): Promise<void> {
  if (body.resolutionType !== "refund" && body.resolutionType !== "replacement") return;

  if (!complaint.orderId) {
    throw new Error(`Resolving as ${body.resolutionType} requires the complaint to be linked to an order.`);
  }
  const [order] = await db
    .select()
    .from(numbatrakCustomerOrders)
    .where(and(eq(numbatrakCustomerOrders.organizationId, organizationId), eq(numbatrakCustomerOrders.id, complaint.orderId)))
    .limit(1);
  if (!order) throw new Error("The order linked to this complaint was not found.");

  if (body.resolutionType === "refund") {
    await db
      .update(numbatrakCustomerOrders)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(eq(numbatrakCustomerOrders.id, order.id));
    return;
  }

  // replacement
  if (!body.productId) {
    throw new Error("Resolving as a replacement requires selecting which product is being replaced.");
  }
  const [item] = await db
    .select({ unitCostAtSubmission: numbatrakCustomerOrderItems.unitCostAtSubmission })
    .from(numbatrakCustomerOrderItems)
    .where(
      and(
        eq(numbatrakCustomerOrderItems.orderId, order.id),
        eq(numbatrakCustomerOrderItems.productId, body.productId),
      ),
    )
    .limit(1);
  if (!item) throw new Error("That product is not part of the linked order.");

  const unitCost = Number(item.unitCostAtSubmission);
  const deliveryFee = Number(order.deliveryFee ?? 0);
  const lossAmount = unitCost + deliveryFee;

  if (order.agentId != null) {
    await createReplacementMovement(db, {
      organizationId,
      fromAgentId: order.agentId,
      productId: body.productId,
      quantity: 1,
      orderId: order.id,
      cost: unitCost,
    });
  }

  // Registers "chargeback" as a real, listable subcategory the first time an
  // org books one, rather than leaving it as a string only ever visible on
  // the expense row itself.
  await db
    .insert(numbatrakExpenseSubcategories)
    .values({ organizationId, parentCategory: "operational", slug: "chargeback", label: "Chargeback" })
    .onConflictDoNothing();

  await db
    .insert(numbatrakUnifiedExpenses)
    .values({
      organizationId,
      scope: "org",
      category: "operational",
      subcategory: "chargeback",
      amount: String(lossAmount),
      orderId: order.id,
      productId: body.productId,
      note: `Replacement for complaint #${complaintId} — order #${order.id}`,
      sourceType: "complaint_replacement",
      sourceId: complaintId,
    })
    .onConflictDoNothing();
}

export async function resolveComplaint(
  db: Database,
  organizationId: string,
  complaintId: string,
  userId: string,
  body: { resolution: string; resolutionType: string; productId?: string | null },
): Promise<NumbatrakComplaint | null> {
  const [complaint] = await db
    .select()
    .from(numbatrakComplaints)
    .where(and(eq(numbatrakComplaints.organizationId, organizationId), eq(numbatrakComplaints.id, complaintId)))
    .limit(1);
  if (!complaint) return null;

  await applyComplaintResolutionSideEffects(db, organizationId, complaintId, complaint, body);

  const [updated] = await db
    .update(numbatrakComplaints)
    .set({
      status: "resolved",
      resolution: body.resolution,
      resolutionType: body.resolutionType,
      resolvedAt: new Date(),
      resolvedBy: userId,
      updatedAt: new Date(),
    })
    .where(and(eq(numbatrakComplaints.organizationId, organizationId), eq(numbatrakComplaints.id, complaintId)))
    .returning();
  if (!updated) return null;
  return serializeComplaint(updated);
}

// --- More Purchases ---

export async function listMorePurchases(
  db: Database,
  organizationId: string,
): Promise<NumbatrakMorePurchase[]> {
  const rows = await db
    .select({
      purchase: numbatrakMorePurchases,
      customerName: numbatrakCustomers.name,
    })
    .from(numbatrakMorePurchases)
    .leftJoin(numbatrakCustomers, eq(numbatrakMorePurchases.customerId, numbatrakCustomers.id))
    .where(eq(numbatrakMorePurchases.organizationId, organizationId))
    .orderBy(desc(numbatrakMorePurchases.createdAt));

  return rows.map((r) => serializeMorePurchase({ ...r.purchase, customerName: r.customerName }));
}

/**
 * An existing customer buying again, outside the standard orders pipeline.
 * When linked to a real product, the cost of goods sold is computed from the
 * product's cost price (not client-supplied) and the unit is deducted from
 * the fulfilling agent's on-hand stock exactly like a normal delivery.
 */
export async function createMorePurchase(
  db: Database,
  organizationId: string,
  body: {
    customerId: string;
    feedbackCallId?: string | null;
    productId?: string | null;
    productName?: string | null;
    agentId?: number | null;
    quantity: number;
    amount: number;
    deliveryCost?: number;
  },
): Promise<NumbatrakMorePurchase> {
  let cogs = 0;
  let productName = body.productName ?? null;

  if (body.productId) {
    const [product] = await db
      .select({ name: numbatrakProducts.name, costPrice: numbatrakProducts.costPrice })
      .from(numbatrakProducts)
      .where(and(eq(numbatrakProducts.organizationId, organizationId), eq(numbatrakProducts.id, body.productId)))
      .limit(1);
    if (!product) throw new Error("That product was not found for this organization.");
    cogs = Number(product.costPrice) * body.quantity;
    productName = productName ?? product.name;

    if (body.agentId != null) {
      await createMorePurchaseMovement(db, {
        organizationId,
        fromAgentId: body.agentId,
        productId: body.productId,
        quantity: body.quantity,
        cost: Number(product.costPrice),
      });
    }
  }

  const [created] = await db
    .insert(numbatrakMorePurchases)
    .values({
      organizationId,
      customerId: body.customerId,
      feedbackCallId: body.feedbackCallId ?? null,
      productId: body.productId ?? null,
      productName,
      quantity: body.quantity,
      amount: String(body.amount),
      cogs: String(cogs),
      deliveryCost: String(body.deliveryCost ?? 0),
      agentId: body.agentId ?? null,
    })
    .returning();
  return serializeMorePurchase(created!);
}

export async function updateMorePurchaseStatus(
  db: Database,
  organizationId: string,
  purchaseId: string,
  status: string,
): Promise<NumbatrakMorePurchase | null> {
  const [updated] = await db
    .update(numbatrakMorePurchases)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(numbatrakMorePurchases.organizationId, organizationId), eq(numbatrakMorePurchases.id, purchaseId)))
    .returning();
  if (!updated) return null;
  return serializeMorePurchase(updated);
}

// --- Campaigns ---

export async function listCampaigns(
  db: Database,
  organizationId: string,
): Promise<NumbatrakCampaign[]> {
  const rows = await db
    .select()
    .from(numbatrakCampaigns)
    .where(eq(numbatrakCampaigns.organizationId, organizationId))
    .orderBy(desc(numbatrakCampaigns.createdAt));
  return rows.map(serializeCampaign);
}

export async function createCampaign(
  db: Database,
  organizationId: string,
  userId: string,
  body: { name: string; channel: string; segmentFilter?: string | null; subject?: string | null; body: string },
): Promise<NumbatrakCampaign> {
  const [created] = await db
    .insert(numbatrakCampaigns)
    .values({
      organizationId,
      name: body.name,
      channel: body.channel,
      segmentFilter: body.segmentFilter ?? null,
      subject: body.subject ?? null,
      body: body.body,
      createdBy: userId,
    })
    .returning();
  return serializeCampaign(created!);
}

/**
 * Segments customers by their latest order status (campaign.segmentFilter),
 * then actually dispatches through the shared email/WhatsApp senders -
 * this used to be a stub that faked sentCount/recipientCount without
 * sending anything. Sending stops the moment the channel's credit balance
 * hits zero, per spec ("blocks sending when balances are depleted"), so a
 * campaign can finish partially sent if it runs out mid-way.
 */
export async function sendCampaign(
  db: Database,
  organizationId: string,
  campaignId: string,
  logger: FastifyBaseLogger,
): Promise<NumbatrakCampaign | null> {
  const [campaign] = await db
    .select()
    .from(numbatrakCampaigns)
    .where(and(eq(numbatrakCampaigns.organizationId, organizationId), eq(numbatrakCampaigns.id, campaignId)))
    .limit(1);
  if (!campaign || campaign.status !== "draft") return null;

  const [credit] = await db
    .select()
    .from(numbatrakCrmCredits)
    .where(and(eq(numbatrakCrmCredits.organizationId, organizationId), eq(numbatrakCrmCredits.channel, campaign.channel)))
    .limit(1);
  if (!credit || credit.balance <= 0) return null;

  const [orderStats, allCustomers] = await Promise.all([
    getOrderStatsMap(db, organizationId),
    db.select().from(numbatrakCustomers).where(eq(numbatrakCustomers.organizationId, organizationId)),
  ]);

  const segmented = campaign.segmentFilter
    ? allCustomers.filter((c) => orderStats.get(c.id)?.latestStatus === campaign.segmentFilter)
    : allCustomers;
  const recipients = segmented.filter((c) => (campaign.channel === "email" ? !!c.email : !!c.whatsapp));

  let balance = credit.balance;
  let sentCount = 0;
  let failedCount = 0;

  for (const customer of recipients) {
    if (balance <= 0) break;
    try {
      if (campaign.channel === "email") {
        await sendEmail(logger, { to: customer.email!, subject: campaign.subject ?? campaign.name, body: campaign.body });
      } else {
        await sendWhatsAppTemplate(db, organizationId, logger, {
          to: customer.whatsapp!,
          templateName: "marketing_campaign",
          bodyParameters: [campaign.body],
        });
      }
      sentCount += 1;
      balance -= 1;
    } catch (err) {
      logger.error({ err, customerId: customer.id, campaignId }, "Campaign send failed for recipient");
      failedCount += 1;
    }
  }

  const [updated] = await db
    .update(numbatrakCampaigns)
    .set({
      status: sentCount > 0 ? "sent" : "failed",
      sentAt: new Date(),
      sentCount,
      failedCount,
      recipientCount: recipients.length,
      updatedAt: new Date(),
    })
    .where(eq(numbatrakCampaigns.id, campaignId))
    .returning();

  if (sentCount > 0) {
    await db
      .update(numbatrakCrmCredits)
      .set({ balance: sql`${numbatrakCrmCredits.balance} - ${sentCount}`, updatedAt: new Date() })
      .where(and(eq(numbatrakCrmCredits.organizationId, organizationId), eq(numbatrakCrmCredits.channel, campaign.channel)));
  }

  return updated ? serializeCampaign(updated) : null;
}

// --- Credits ---

export async function listCredits(
  db: Database,
  organizationId: string,
): Promise<NumbatrakCrmCredit[]> {
  const rows = await db
    .select()
    .from(numbatrakCrmCredits)
    .where(eq(numbatrakCrmCredits.organizationId, organizationId));

  const result: NumbatrakCrmCredit[] = [];
  const found = new Set(rows.map((r) => r.channel));
  for (const ch of ["email", "whatsapp"] as const) {
    const row = rows.find((r) => r.channel === ch);
    if (row) {
      result.push(serializeCredit(row));
    } else {
      result.push({ channel: ch, balance: 0 });
    }
  }
  return result;
}

export async function addCredits(
  db: Database,
  organizationId: string,
  channel: string,
  amount: number,
): Promise<NumbatrakCrmCredit> {
  const [upserted] = await db
    .insert(numbatrakCrmCredits)
    .values({ organizationId, channel, balance: amount })
    .onConflictDoUpdate({
      target: [numbatrakCrmCredits.organizationId, numbatrakCrmCredits.channel],
      set: { balance: sql`${numbatrakCrmCredits.balance} + ${amount}`, updatedAt: new Date() },
    })
    .returning();
  return serializeCredit(upserted!);
}

// --- Dashboards ---

export async function getFeedbackDashboard(
  db: Database,
  organizationId: string,
): Promise<NumbatrakFeedbackDashboard> {
  const [callStats] = await db
    .select({
      totalCalls: sql<number>`COUNT(*)::int`,
      attempted: sql<number>`COUNT(*) FILTER (WHERE ${numbatrakFeedbackCalls.attempts} > 0)::int`,
      answered: sql<number>`COUNT(*) FILTER (WHERE ${numbatrakFeedbackCalls.disposition} = 'answered')::int`,
      totalAttempts: sql<number>`COALESCE(SUM(${numbatrakFeedbackCalls.attempts}), 0)::int`,
      totalWithAttempts: sql<number>`COUNT(*) FILTER (WHERE ${numbatrakFeedbackCalls.attempts} > 0)::int`,
      avgSatisfaction: sql<string>`COALESCE(AVG(${numbatrakFeedbackCalls.satisfactionScore}) FILTER (WHERE ${numbatrakFeedbackCalls.satisfactionScore} IS NOT NULL), 0)`,
      happyCount: sql<number>`COUNT(*) FILTER (WHERE ${numbatrakFeedbackCalls.satisfactionScore} >= 4)::int`,
      unhappyCount: sql<number>`COUNT(*) FILTER (WHERE ${numbatrakFeedbackCalls.satisfactionScore} IS NOT NULL AND ${numbatrakFeedbackCalls.satisfactionScore} <= 2)::int`,
      scoredCount: sql<number>`COUNT(*) FILTER (WHERE ${numbatrakFeedbackCalls.satisfactionScore} IS NOT NULL)::int`,
    })
    .from(numbatrakFeedbackCalls)
    .where(eq(numbatrakFeedbackCalls.organizationId, organizationId));

  const [mpStats] = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(${numbatrakMorePurchases.amount}), 0)`,
      totalProfit: sql<string>`COALESCE(SUM(${numbatrakMorePurchases.amount} - ${numbatrakMorePurchases.cogs} - ${numbatrakMorePurchases.deliveryCost}), 0)`,
    })
    .from(numbatrakMorePurchases)
    .where(eq(numbatrakMorePurchases.organizationId, organizationId));

  const totalCalls = callStats?.totalCalls ?? 0;
  const attempted = callStats?.attempted ?? 0;
  const answered = callStats?.answered ?? 0;
  const scoredCount = callStats?.scoredCount ?? 0;
  const morePurchaseRevenue = Number(mpStats?.totalRevenue ?? 0);
  const morePurchaseProfit = Number(mpStats?.totalProfit ?? 0);

  return {
    totalCalls,
    attempted,
    answerRate: attempted > 0 ? answered / attempted : 0,
    avgAttemptsToReach: (callStats?.totalWithAttempts ?? 0) > 0 ? (callStats?.totalAttempts ?? 0) / (callStats?.totalWithAttempts ?? 1) : 0,
    avgSatisfaction: Number(callStats?.avgSatisfaction ?? 0),
    happyRate: scoredCount > 0 ? (callStats?.happyCount ?? 0) / scoredCount : 0,
    unhappyRate: scoredCount > 0 ? (callStats?.unhappyCount ?? 0) / scoredCount : 0,
    morePurchaseRevenue,
    morePurchaseProfit,
    profitPerCall: attempted > 0 ? morePurchaseProfit / attempted : 0,
  };
}

export async function getComplaintDashboard(
  db: Database,
  organizationId: string,
): Promise<NumbatrakComplaintDashboard> {
  const [stats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      open: sql<number>`COUNT(*) FILTER (WHERE ${numbatrakComplaints.status} = 'open')::int`,
      escalated: sql<number>`COUNT(*) FILTER (WHERE ${numbatrakComplaints.status} = 'escalated')::int`,
      resolved: sql<number>`COUNT(*) FILTER (WHERE ${numbatrakComplaints.status} = 'resolved')::int`,
      refundCount: sql<number>`COUNT(*) FILTER (WHERE ${numbatrakComplaints.resolutionType} = 'refund')::int`,
      replacementCount: sql<number>`COUNT(*) FILTER (WHERE ${numbatrakComplaints.resolutionType} = 'replacement')::int`,
    })
    .from(numbatrakComplaints)
    .where(eq(numbatrakComplaints.organizationId, organizationId));

  const byType = await db
    .select({
      type: numbatrakComplaints.complaintType,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(numbatrakComplaints)
    .where(and(eq(numbatrakComplaints.organizationId, organizationId), sql`${numbatrakComplaints.complaintType} IS NOT NULL`))
    .groupBy(numbatrakComplaints.complaintType);

  // Replacement losses are booked under the "chargeback" subcategory
  // (see applyComplaintResolutionSideEffects); refunds book no expense at
  // all, so this total only ever reflects replacement cost - by design.
  const [chargeback] = await db
    .select({ total: sql<string>`COALESCE(SUM(${numbatrakUnifiedExpenses.amount}), 0)` })
    .from(numbatrakUnifiedExpenses)
    .where(
      and(
        eq(numbatrakUnifiedExpenses.organizationId, organizationId),
        eq(numbatrakUnifiedExpenses.subcategory, "chargeback"),
        eq(numbatrakUnifiedExpenses.sourceType, "complaint_replacement"),
      ),
    );

  const total = stats?.total ?? 0;
  const open = stats?.open ?? 0;
  const escalated = stats?.escalated ?? 0;
  const resolved = stats?.resolved ?? 0;
  const refundCount = stats?.refundCount ?? 0;
  const replacementCount = stats?.replacementCount ?? 0;

  return {
    total,
    open,
    escalated,
    resolved,
    resolutionRate: total > 0 ? resolved / total : 0,
    refundCount,
    replacementCount,
    chargebackCost: Number(chargeback?.total ?? 0),
    byType: byType.map((r) => ({ type: r.type ?? "unknown", count: r.count })),
  };
}
