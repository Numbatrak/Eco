import { and, eq, inArray } from "drizzle-orm";
import { numbatrakAgents, numbatrakCustomerOrders, numbatrakWalletRemittanceLines, type Database } from "@platform/db";
import type { NumbatrakRemittanceLineStatus, NumbatrakWalletRemittanceLine, NumbatrakWalletSourceOrder } from "@platform/shared-types";
import { DELIVERED_STATUSES } from "../../numbatrak-orders/lib/order-status.js";

/**
 * Server-side port of src/services/wallet.ts. Deliberately queries
 * numbatrak_customer_orders only - no form_responses fallback/merge, same
 * scope-narrowing precedent already accepted by the ported Orders module
 * (customerOrders.ts's own comment: "no form_responses merge this slice").
 */

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Whether a delivered order should appear in the Wallet remittance flow. */
function entersWalletRemittance(moneyReceivedBy: string | null | undefined): boolean {
  return moneyReceivedBy === "agent_collected";
}

/** Legacy payment_method fallback for rows that pre-date money_received_by. */
function inferMoneyReceivedBy(
  moneyReceivedBy: string | null | undefined,
  paymentMethod: string | null | undefined,
): string {
  if (moneyReceivedBy) return moneyReceivedBy;
  if (paymentMethod === "online") return "prepaid";
  return "agent_collected";
}

function deliveredValue(orderRevenue: number, amountPaid: number | null): number {
  if (amountPaid != null && amountPaid > 0) return amountPaid;
  return orderRevenue;
}

function toRemittanceCalendarDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function remittanceLineKey(agentId: number, date: string): string {
  return `${agentId}:${date}`;
}

export function computeExpectedRemittance(input: {
  totalDeliveredValue: number;
  totalDeliveryFees: number;
  netOffAmount: number;
}): number {
  return input.totalDeliveredValue - input.totalDeliveryFees - input.netOffAmount;
}

export function computeRemittanceLineStatus(input: {
  expectedRemittance: number;
  actualAmount: number | null;
}): NumbatrakRemittanceLineStatus {
  if (input.expectedRemittance < 0) return "net_owed";
  if (input.actualAmount == null) return "standing";
  if (input.actualAmount >= input.expectedRemittance) return "remitted";
  return "short";
}

async function fetchSourceOrders(db: Database, organizationId: string): Promise<NumbatrakWalletSourceOrder[]> {
  const rows = await db
    .select({
      id: numbatrakCustomerOrders.id,
      customerName: numbatrakCustomerOrders.customerName,
      phoneNumber: numbatrakCustomerOrders.phoneNumber,
      agentId: numbatrakCustomerOrders.agentId,
      orderRevenue: numbatrakCustomerOrders.orderRevenue,
      amountPaid: numbatrakCustomerOrders.amountPaid,
      deliveryFee: numbatrakCustomerOrders.deliveryFee,
      subBrand: numbatrakCustomerOrders.subBrand,
      paymentMethod: numbatrakCustomerOrders.paymentMethod,
      moneyReceivedBy: numbatrakCustomerOrders.moneyReceivedBy,
      walletStatus: numbatrakCustomerOrders.walletStatus,
      completedAt: numbatrakCustomerOrders.completedAt,
    })
    .from(numbatrakCustomerOrders)
    .where(
      and(
        eq(numbatrakCustomerOrders.organizationId, organizationId),
        inArray(numbatrakCustomerOrders.status, DELIVERED_STATUSES),
      ),
    );

  const agentIds = [...new Set(rows.map((r) => r.agentId).filter((id): id is number => id != null))];
  const agentNames = new Map<number, string>();
  if (agentIds.length > 0) {
    const agents = await db
      .select({ id: numbatrakAgents.id, name: numbatrakAgents.name })
      .from(numbatrakAgents)
      .where(inArray(numbatrakAgents.id, agentIds));
    for (const a of agents) agentNames.set(a.id, a.name);
  }

  const result: NumbatrakWalletSourceOrder[] = [];
  for (const row of rows) {
    if (row.agentId == null) continue;
    const moneyReceivedBy = inferMoneyReceivedBy(row.moneyReceivedBy, row.paymentMethod);
    if (!entersWalletRemittance(moneyReceivedBy)) continue;
    if (!row.completedAt) continue;

    const orderRevenue = num(row.orderRevenue);
    const amountPaid = row.amountPaid != null ? num(row.amountPaid) : null;
    result.push({
      id: row.id,
      customerName: row.customerName,
      phoneNumber: row.phoneNumber,
      agentId: row.agentId,
      agentName: agentNames.get(row.agentId) ?? null,
      orderRevenue,
      amountPaid,
      deliveryFee: num(row.deliveryFee),
      deliveredValue: deliveredValue(orderRevenue, amountPaid),
      subBrand: row.subBrand,
      paymentMethod: (row.paymentMethod as "cod" | "online") ?? "cod",
      moneyReceivedBy: moneyReceivedBy as NumbatrakWalletSourceOrder["moneyReceivedBy"],
      walletStatus: row.walletStatus as NumbatrakWalletSourceOrder["walletStatus"],
      completedAt: row.completedAt.toISOString(),
    });
  }
  return result;
}

type PersistedLine = typeof numbatrakWalletRemittanceLines.$inferSelect;

async function fetchPersistedLines(db: Database, organizationId: string): Promise<Map<string, PersistedLine>> {
  const rows = await db
    .select()
    .from(numbatrakWalletRemittanceLines)
    .where(eq(numbatrakWalletRemittanceLines.organizationId, organizationId));
  const map = new Map<string, PersistedLine>();
  for (const row of rows) {
    map.set(remittanceLineKey(row.agentId, row.remittanceDate), row);
  }
  return map;
}

function aggregateLines(
  organizationId: string,
  orders: NumbatrakWalletSourceOrder[],
  persisted: Map<string, PersistedLine>,
): NumbatrakWalletRemittanceLine[] {
  const groups = new Map<string, NumbatrakWalletSourceOrder[]>();
  for (const order of orders) {
    const date = toRemittanceCalendarDate(order.completedAt);
    if (!date) continue;
    const key = remittanceLineKey(order.agentId, date);
    const list = groups.get(key) ?? [];
    list.push(order);
    groups.set(key, list);
  }

  const lines: NumbatrakWalletRemittanceLine[] = [];
  for (const [key, lineOrders] of groups) {
    const agentId = lineOrders[0]!.agentId;
    const date = toRemittanceCalendarDate(lineOrders[0]!.completedAt)!;
    const totalDeliveredValue = lineOrders.reduce((s, o) => s + o.deliveredValue, 0);
    const totalDeliveryFees = lineOrders.reduce((s, o) => s + o.deliveryFee, 0);
    const subBrands = [...new Set(lineOrders.map((o) => o.subBrand?.trim()).filter(Boolean) as string[])].sort();

    const saved = persisted.get(key);
    const netOffAmount = saved ? Number(saved.netOffAmount) : 0;
    const expectedRemittance = computeExpectedRemittance({ totalDeliveredValue, totalDeliveryFees, netOffAmount });
    const actualAmount = saved?.actualAmount != null ? Number(saved.actualAmount) : null;
    const status = computeRemittanceLineStatus({ expectedRemittance, actualAmount });
    const shortfall = actualAmount != null && status === "short" ? Math.max(0, expectedRemittance - actualAmount) : 0;

    lines.push({
      lineKey: key,
      id: saved?.id ?? null,
      agentId,
      agentName: lineOrders[0]!.agentName ?? `Agent #${agentId}`,
      remittanceDate: date,
      orderCount: lineOrders.length,
      orders: lineOrders,
      subBrands,
      totalDeliveredValue,
      totalDeliveryFees,
      netOffAmount,
      expectedRemittance,
      actualAmount,
      status,
      shortfall,
      netOffExpenseId: saved?.netOffExpenseId ?? null,
      notes: saved?.notes ?? null,
      remittedAt: saved?.remittedAt?.toISOString() ?? null,
    });
  }

  return lines.sort((a, b) => {
    const dateCmp = b.remittanceDate.localeCompare(a.remittanceDate);
    if (dateCmp !== 0) return dateCmp;
    return a.agentName.localeCompare(b.agentName);
  });
}

export async function fetchRemittanceLines(db: Database, organizationId: string): Promise<NumbatrakWalletRemittanceLine[]> {
  const [orders, persisted] = await Promise.all([
    fetchSourceOrders(db, organizationId),
    fetchPersistedLines(db, organizationId),
  ]);
  return aggregateLines(organizationId, orders, persisted);
}

async function findLine(
  db: Database,
  organizationId: string,
  agentId: number,
  remittanceDate: string,
): Promise<NumbatrakWalletRemittanceLine | null> {
  const lines = await fetchRemittanceLines(db, organizationId);
  return lines.find((l) => l.agentId === agentId && l.remittanceDate === remittanceDate) ?? null;
}

/** Sync per-order wallet status once a line is fully remitted. */
async function syncOrdersRemittanceStatus(
  db: Database,
  organizationId: string,
  orderIds: string[],
  userId: string,
): Promise<void> {
  if (orderIds.length === 0) return;
  await db
    .update(numbatrakCustomerOrders)
    .set({
      walletStatus: "collected",
      remittanceConfirmedAt: new Date(),
      remittanceConfirmedBy: userId,
    })
    .where(and(eq(numbatrakCustomerOrders.organizationId, organizationId), inArray(numbatrakCustomerOrders.id, orderIds)));
}

export async function recordRemittance(
  db: Database,
  organizationId: string,
  agentId: number,
  remittanceDate: string,
  actualAmount: number,
  userId: string,
): Promise<NumbatrakWalletRemittanceLine> {
  if (actualAmount < 0) throw new Error("Actual amount cannot be negative.");

  const line = await findLine(db, organizationId, agentId, remittanceDate);
  if (!line) throw new Error("No remittance line found for that agent/date.");

  const status = computeRemittanceLineStatus({ expectedRemittance: line.expectedRemittance, actualAmount });
  const now = new Date();

  await db
    .insert(numbatrakWalletRemittanceLines)
    .values({
      organizationId,
      agentId,
      remittanceDate,
      totalDeliveredValue: String(line.totalDeliveredValue),
      totalDeliveryFees: String(line.totalDeliveryFees),
      netOffAmount: String(line.netOffAmount),
      expectedRemittance: String(line.expectedRemittance),
      actualAmount: String(actualAmount),
      status,
      remittedAt: now,
      remittedBy: userId,
    })
    .onConflictDoUpdate({
      target: [
        numbatrakWalletRemittanceLines.organizationId,
        numbatrakWalletRemittanceLines.agentId,
        numbatrakWalletRemittanceLines.remittanceDate,
      ],
      set: {
        totalDeliveredValue: String(line.totalDeliveredValue),
        totalDeliveryFees: String(line.totalDeliveryFees),
        actualAmount: String(actualAmount),
        status,
        remittedAt: now,
        remittedBy: userId,
        updatedAt: now,
      },
    });

  if (status === "remitted") {
    await syncOrdersRemittanceStatus(db, organizationId, line.orders.map((o) => o.id), userId);
  }

  const shortfall = status === "short" ? Math.max(0, line.expectedRemittance - actualAmount) : 0;
  return { ...line, actualAmount, status, shortfall, remittedAt: now.toISOString() };
}
