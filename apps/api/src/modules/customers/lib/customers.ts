import { and, desc, eq, sql } from "drizzle-orm";
import { customers, type Database } from "@platform/db";
import type { Customer } from "@platform/shared-types";

export type CustomerRow = typeof customers.$inferSelect;

export function serializeCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    state: row.state,
    orderCount: row.orderCount,
    totalSpentCents: row.totalSpentCents,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCustomersForTenant(db: Database, tenantId: string): Promise<CustomerRow[]> {
  return db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, tenantId))
    .orderBy(desc(customers.createdAt));
}

export async function findCustomerForTenant(
  db: Database,
  tenantId: string,
  customerId: string,
): Promise<CustomerRow | null> {
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .limit(1);
  return row ?? null;
}

export interface UpsertCustomerInput {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
}

/**
 * Called at order-creation time (before payment settles) so the contact
 * record exists even if the payment later fails. Order/spend stats are
 * NOT touched here - see incrementCustomerStats, called only on the actual
 * pending->paid transition so abandoned checkouts don't inflate them.
 */
export async function upsertCustomer(
  db: Database,
  tenantId: string,
  input: UpsertCustomerInput,
): Promise<CustomerRow> {
  const [row] = await db
    .insert(customers)
    .values({
      tenantId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      city: input.city,
      state: input.state,
    })
    .onConflictDoUpdate({
      target: [customers.tenantId, customers.email],
      set: {
        name: input.name,
        phone: input.phone,
        address: input.address,
        city: input.city,
        state: input.state,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) {
    throw new Error("Failed to upsert customer");
  }
  return row;
}

export async function incrementCustomerStats(
  db: Database,
  customerId: string,
  totalCents: number,
): Promise<void> {
  await db
    .update(customers)
    .set({
      orderCount: sql`${customers.orderCount} + 1`,
      totalSpentCents: sql`${customers.totalSpentCents} + ${totalCents}`,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));
}
