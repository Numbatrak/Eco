import { and, eq, gte, lte } from "drizzle-orm";
import { platformTransactions, type Database } from "@platform/db";

// Revenue split always keeps the two streams separate (LOCKED RULE) and, for
// each, reports gross collected · VAT portion · net after VAT. VAT is charged
// on subscriptions only; credit purchases are not VAT-liable.

export interface StreamTotals {
  grossCents: number;
  vatCents: number;
  netCents: number;
}

export interface RevenueSplit {
  subscription: StreamTotals & {
    byTier: Record<string, number>; // gross per plan tier
    monthlyGrossCents: number;
    annualGrossCents: number;
  };
  credit: StreamTotals & {
    emailGrossCents: number;
    whatsappGrossCents: number;
  };
  combined: StreamTotals;
}

interface TxnMetadata {
  planName?: string;
  billingInterval?: string;
  creditType?: string;
}

export async function computeRevenueSplit(
  db: Database,
  from: Date,
  to: Date,
): Promise<RevenueSplit> {
  const rows = await db
    .select({
      type: platformTransactions.type,
      amountCents: platformTransactions.amountCents,
      vatCents: platformTransactions.vatCents,
      metadata: platformTransactions.metadata,
    })
    .from(platformTransactions)
    .where(
      and(
        eq(platformTransactions.status, "success"),
        gte(platformTransactions.createdAt, from),
        lte(platformTransactions.createdAt, to),
      ),
    );

  const subscription = {
    grossCents: 0,
    vatCents: 0,
    netCents: 0,
    byTier: {} as Record<string, number>,
    monthlyGrossCents: 0,
    annualGrossCents: 0,
  };
  const credit = {
    grossCents: 0,
    vatCents: 0,
    netCents: 0,
    emailGrossCents: 0,
    whatsappGrossCents: 0,
  };

  for (const row of rows) {
    const meta = (row.metadata ?? {}) as TxnMetadata;
    if (row.type === "subscription") {
      subscription.grossCents += row.amountCents;
      subscription.vatCents += row.vatCents;
      const tier = meta.planName ?? "unknown";
      subscription.byTier[tier] = (subscription.byTier[tier] ?? 0) + row.amountCents;
      if (meta.billingInterval === "annual") {
        subscription.annualGrossCents += row.amountCents;
      } else {
        subscription.monthlyGrossCents += row.amountCents;
      }
    } else if (row.type === "credit_purchase") {
      credit.grossCents += row.amountCents;
      credit.vatCents += row.vatCents; // expected 0 — credits aren't VAT-liable
      if (meta.creditType === "whatsapp") {
        credit.whatsappGrossCents += row.amountCents;
      } else if (meta.creditType === "email") {
        credit.emailGrossCents += row.amountCents;
      }
    }
  }

  subscription.netCents = subscription.grossCents - subscription.vatCents;
  credit.netCents = credit.grossCents - credit.vatCents;

  return {
    subscription,
    credit,
    combined: {
      grossCents: subscription.grossCents + credit.grossCents,
      vatCents: subscription.vatCents + credit.vatCents,
      netCents: subscription.netCents + credit.netCents,
    },
  };
}
