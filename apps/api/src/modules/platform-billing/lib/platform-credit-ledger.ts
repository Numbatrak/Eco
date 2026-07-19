import { eq, and, sum } from "drizzle-orm";
import { platformCreditLedger, type Database } from "@platform/db";

export type PlatformCreditLedgerRow = typeof platformCreditLedger.$inferSelect;
export type CreditType = "email" | "whatsapp";

export interface CreditAdjustmentParams {
  organizationId: string;
  creditType: CreditType;
  delta: number;
  reason: string;
  adminId?: string;
  transactionId?: string;
}

// Mirrors credit_adjustments: append-only, no stored balance.
export async function appendCreditLedgerEntry(
  db: Database,
  params: CreditAdjustmentParams,
): Promise<PlatformCreditLedgerRow> {
  const [row] = await db.insert(platformCreditLedger).values(params).returning();
  return row!;
}

// Balance is SUM(delta) computed on read, never stored.
export async function getCreditBalance(
  db: Database,
  organizationId: string,
  creditType: CreditType,
): Promise<number> {
  const [row] = await db
    .select({ balance: sum(platformCreditLedger.delta) })
    .from(platformCreditLedger)
    .where(
      and(
        eq(platformCreditLedger.organizationId, organizationId),
        eq(platformCreditLedger.creditType, creditType),
      ),
    );
  return Number(row?.balance ?? 0);
}

// Returns both pools in one round-trip.
export async function getCreditBalances(
  db: Database,
  organizationId: string,
): Promise<{ email: number; whatsapp: number }> {
  const rows = await db
    .select({
      creditType: platformCreditLedger.creditType,
      balance: sum(platformCreditLedger.delta),
    })
    .from(platformCreditLedger)
    .where(eq(platformCreditLedger.organizationId, organizationId))
    .groupBy(platformCreditLedger.creditType);

  let email = 0;
  let whatsapp = 0;
  for (const row of rows) {
    if (row.creditType === "email") email = Number(row.balance ?? 0);
    if (row.creditType === "whatsapp") whatsapp = Number(row.balance ?? 0);
  }
  return { email, whatsapp };
}

// Debit credits when consumed. Returns false if balance would go negative.
export async function debitCredit(
  db: Database,
  organizationId: string,
  creditType: CreditType,
  amount: number,
  reason: string,
): Promise<boolean> {
  const balance = await getCreditBalance(db, organizationId, creditType);
  if (balance < amount) return false;
  await appendCreditLedgerEntry(db, {
    organizationId,
    creditType,
    delta: -amount,
    reason,
  });
  return true;
}
