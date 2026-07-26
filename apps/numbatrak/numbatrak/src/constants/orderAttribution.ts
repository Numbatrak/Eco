/**
 * Cross-cutting order attribution (spec §Orders, §Wallet, §Dashboard).
 * Funnel = how the customer arrived (typically the order form / funnel page).
 * Offer = the sellable package selected on that funnel.
 */

export type MoneyReceivedBy = "agent_collected" | "company_account" | "prepaid";

export const MONEY_RECEIVED_BY_OPTIONS: {
  value: MoneyReceivedBy;
  label: string;
  description: string;
}[] = [
  {
    value: "agent_collected",
    label: "Agent collected (COD)",
    description: "Delivery agent collected cash on your behalf — creates a Wallet remittance line when delivered.",
  },
  {
    value: "company_account",
    label: "Company account",
    description: "Customer paid your business directly — no agent remittance.",
  },
  {
    value: "prepaid",
    label: "Prepaid",
    description: "Paid before delivery (e.g. online) — cash already in hand, no remittance.",
  },
];

/** Whether a delivered order should appear in Wallet remittance flow. */
export function entersWalletRemittance(moneyReceivedBy: MoneyReceivedBy | null | undefined): boolean {
  return moneyReceivedBy === "agent_collected";
}

/** Legacy payment_method column mapping for rows that pre-date money_received_by. */
export function inferMoneyReceivedBy(
  moneyReceivedBy: MoneyReceivedBy | null | undefined,
  paymentMethod: "cod" | "online" | null | undefined
): MoneyReceivedBy {
  if (moneyReceivedBy) return moneyReceivedBy;
  if (paymentMethod === "online") return "prepaid";
  return "agent_collected";
}

/** Map spec money flag → legacy payment_method for existing wallet summaries. */
export function moneyReceivedByToPaymentMethod(
  moneyReceivedBy: MoneyReceivedBy
): "cod" | "online" {
  return moneyReceivedBy === "prepaid" ? "online" : "cod";
}

export function resolveFunnelName(form: {
  funnel_name?: string | null;
  name: string;
}): string {
  const trimmed = form.funnel_name?.trim();
  return trimmed || form.name;
}
