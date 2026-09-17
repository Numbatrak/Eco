import { eq } from "drizzle-orm";
import { numbatrakCustomers, numbatrakCustomerOrders, type Database } from "@platform/db";

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const body = rows.map((row) => columns.map((col) => csvCell(row[col])).join(","));
  return [header, ...body].join("\n");
}

const CUSTOMER_COLUMNS = [
  "id",
  "name",
  "phone",
  "email",
  "whatsapp",
  "location",
  "firstClickSource",
  "lastClickSource",
  "notes",
  "createdAt",
] as const;

export async function exportCustomersCsv(db: Database, organizationId: string): Promise<string> {
  const rows = await db
    .select()
    .from(numbatrakCustomers)
    .where(eq(numbatrakCustomers.organizationId, organizationId));
  const formatted = rows.map((r) => ({ ...r, createdAt: r.createdAt?.toISOString() ?? "" }));
  return toCsv(formatted, [...CUSTOMER_COLUMNS]);
}

const ORDER_COLUMNS = [
  "id",
  "customerId",
  "customerName",
  "phoneNumber",
  "status",
  "state",
  "deliveryAddress",
  "orderRevenue",
  "orderCost",
  "profit",
  "amountPaid",
  "deliveryFee",
  "paymentMethod",
  "moneyReceivedBy",
  "createdAt",
  "completedAt",
] as const;

export async function exportOrdersCsv(db: Database, organizationId: string): Promise<string> {
  const rows = await db
    .select()
    .from(numbatrakCustomerOrders)
    .where(eq(numbatrakCustomerOrders.organizationId, organizationId));
  const formatted = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt?.toISOString() ?? "",
    completedAt: r.completedAt?.toISOString() ?? "",
  }));
  return toCsv(formatted, [...ORDER_COLUMNS]);
}
