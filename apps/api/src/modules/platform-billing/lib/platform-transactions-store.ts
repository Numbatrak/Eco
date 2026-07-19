import { eq, sum, and } from "drizzle-orm";
import { platformTransactions, type Database } from "@platform/db";

export type PlatformTransactionRow = typeof platformTransactions.$inferSelect;

export interface RecordTransactionParams {
  organizationId: string;
  type: "subscription" | "credit_purchase";
  amountCents: number;
  vatCents: number;
  paystackReference: string;
  status: "success" | "failed" | "refunded";
  metadata?: Record<string, unknown>;
}

export async function recordPlatformTransaction(
  db: Database,
  params: RecordTransactionParams,
): Promise<PlatformTransactionRow> {
  const [row] = await db.insert(platformTransactions).values(params).returning();
  return row!;
}

export async function findTransactionByReference(
  db: Database,
  paystackReference: string,
): Promise<PlatformTransactionRow | null> {
  const [row] = await db
    .select()
    .from(platformTransactions)
    .where(eq(platformTransactions.paystackReference, paystackReference));
  return row ?? null;
}

// MRR/ARR source-of-truth query — never computed any other way.
export async function sumSuccessfulTransactions(
  db: Database,
  organizationId: string,
): Promise<{ totalAmountCents: number; totalVatCents: number }> {
  const [row] = await db
    .select({
      totalAmountCents: sum(platformTransactions.amountCents),
      totalVatCents: sum(platformTransactions.vatCents),
    })
    .from(platformTransactions)
    .where(
      and(
        eq(platformTransactions.organizationId, organizationId),
        eq(platformTransactions.status, "success"),
      ),
    );
  return {
    totalAmountCents: Number(row?.totalAmountCents ?? 0),
    totalVatCents: Number(row?.totalVatCents ?? 0),
  };
}

export async function markTransactionRefunded(
  db: Database,
  paystackReference: string,
  refundReason: string,
  refundedAt: Date,
): Promise<void> {
  await db
    .update(platformTransactions)
    .set({ status: "refunded", refundReason, refundedAt })
    .where(eq(platformTransactions.paystackReference, paystackReference));
}
