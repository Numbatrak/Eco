"use client";

import { apiRequest } from "../lib/apiClient";
import { emptyWithoutOrg } from "./orgQuery";
import {
  WalletSourceOrder,
  WalletRemittanceLine,
  WalletSummary,
  RemittanceLineStatus,
} from "../types/wallet";
import { resolveDateRange, withinDateRange, DateFilter } from "../utils/dateRange";

export function remittanceLineKey(agentId: number, date: string): string {
  return `${agentId}:${date}`;
}

export function toRemittanceCalendarDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
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
}): RemittanceLineStatus {
  if (input.expectedRemittance < 0) return "net_owed";
  if (input.actualAmount == null) return "standing";
  if (input.actualAmount >= input.expectedRemittance) return "remitted";
  return "short";
}

interface SourceOrderDto {
  id: string;
  customerName: string | null;
  phoneNumber: string | null;
  agentId: number;
  agentName: string | null;
  orderRevenue: number;
  amountPaid: number | null;
  deliveryFee: number;
  deliveredValue: number;
  subBrand: string | null;
  paymentMethod: "cod" | "online";
  moneyReceivedBy: WalletSourceOrder["money_received_by"];
  walletStatus: WalletSourceOrder["wallet_status"];
  completedAt: string | null;
}

function sourceOrderFromDto(dto: SourceOrderDto): WalletSourceOrder {
  return {
    id: dto.id,
    source: "customer_orders",
    customer_name: dto.customerName,
    phone_number: dto.phoneNumber,
    agent_id: dto.agentId,
    agent_name: dto.agentName,
    order_revenue: dto.orderRevenue,
    amount_paid: dto.amountPaid,
    delivery_fee: dto.deliveryFee,
    delivered_value: dto.deliveredValue,
    sub_brand: dto.subBrand,
    payment_method: dto.paymentMethod,
    money_received_by: dto.moneyReceivedBy,
    wallet_status: dto.walletStatus,
    completed_at: dto.completedAt,
  };
}

interface RemittanceLineDto {
  lineKey: string;
  id: string | null;
  agentId: number;
  agentName: string;
  remittanceDate: string;
  orderCount: number;
  orders: SourceOrderDto[];
  subBrands: string[];
  totalDeliveredValue: number;
  totalDeliveryFees: number;
  netOffAmount: number;
  expectedRemittance: number;
  actualAmount: number | null;
  status: RemittanceLineStatus;
  shortfall: number;
  netOffExpenseId: string | null;
  notes: string | null;
  remittedAt: string | null;
}

function lineFromDto(dto: RemittanceLineDto): WalletRemittanceLine {
  return {
    lineKey: dto.lineKey,
    id: dto.id,
    organization_id: "",
    agent_id: dto.agentId,
    agent_name: dto.agentName,
    remittance_date: dto.remittanceDate,
    order_count: dto.orderCount,
    orders: dto.orders.map(sourceOrderFromDto),
    sub_brands: dto.subBrands,
    total_delivered_value: dto.totalDeliveredValue,
    total_delivery_fees: dto.totalDeliveryFees,
    net_off_amount: dto.netOffAmount,
    expected_remittance: dto.expectedRemittance,
    actual_amount: dto.actualAmount,
    status: dto.status,
    shortfall: dto.shortfall,
    net_off_expense_id: dto.netOffExpenseId,
    notes: dto.notes,
    remitted_at: dto.remittedAt,
  };
}

export async function fetchWalletRemittanceLines(
  organizationId: string | null
): Promise<WalletRemittanceLine[]> {
  const empty = emptyWithoutOrg<WalletRemittanceLine>(organizationId);
  if (empty) return empty;

  const { lines } = await apiRequest<{ lines: RemittanceLineDto[] }>("/org/numbatrak/wallet/remittance-lines");
  return lines.map((l) => ({ ...lineFromDto(l), organization_id: organizationId! }));
}

export function computeWalletSummary(
  lines: WalletRemittanceLine[],
  dateFilter?: DateFilter
): WalletSummary {
  const { startDate, endDate } = resolveDateRange(dateFilter);
  const inPeriod = lines.filter((line) =>
    withinDateRange(`${line.remittance_date}T12:00:00.000Z`, startDate, endDate)
  );

  let orderCount = 0;
  let totalDeliveredValue = 0;
  let totalDeliveryFees = 0;
  let totalExpectedRemittance = 0;
  let totalRemitted = 0;
  let cashGapOutstanding = 0;
  let standingCount = 0;
  let shortCount = 0;
  let remittedCount = 0;

  for (const line of inPeriod) {
    orderCount += line.order_count;
    totalDeliveredValue += line.total_delivered_value;
    totalDeliveryFees += line.total_delivery_fees;
    totalExpectedRemittance += Math.max(0, line.expected_remittance);

    switch (line.status) {
      case "standing":
        standingCount += 1;
        cashGapOutstanding += line.expected_remittance;
        break;
      case "short":
        shortCount += 1;
        totalRemitted += line.actual_amount ?? 0;
        cashGapOutstanding += line.shortfall;
        break;
      case "remitted":
        remittedCount += 1;
        totalRemitted += line.actual_amount ?? line.expected_remittance;
        break;
      case "net_owed":
        standingCount += 1;
        break;
    }
  }

  return {
    lineCount: inPeriod.length,
    orderCount,
    totalDeliveredValue,
    totalDeliveryFees,
    totalExpectedRemittance,
    totalRemitted,
    cashGapOutstanding: Math.max(0, cashGapOutstanding),
    standingCount,
    shortCount,
    remittedCount,
  };
}

export function filterRemittanceLines(
  lines: WalletRemittanceLine[],
  options: {
    dateFilter?: DateFilter;
    statusFilter?: "all" | RemittanceLineStatus;
    agentId?: number | null;
    subBrand?: string | null;
    search?: string;
  }
): WalletRemittanceLine[] {
  const { startDate, endDate } = resolveDateRange(options.dateFilter);
  const q = options.search?.trim().toLowerCase();

  return lines.filter((line) => {
    if (
      !withinDateRange(`${line.remittance_date}T12:00:00.000Z`, startDate, endDate)
    ) {
      return false;
    }
    if (
      options.statusFilter &&
      options.statusFilter !== "all" &&
      line.status !== options.statusFilter
    ) {
      return false;
    }
    if (options.agentId != null && line.agent_id !== options.agentId) {
      return false;
    }
    if (options.subBrand && !line.sub_brands.includes(options.subBrand)) {
      return false;
    }
    if (q) {
      const hay = [line.agent_name, line.remittance_date, ...line.sub_brands]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** `userId` param kept for signature compatibility - the server resolves the
 * acting user from the session itself rather than trusting a client value. */
export async function recordRemittance(
  line: WalletRemittanceLine,
  actualAmount: number,
  _userId: string
): Promise<WalletRemittanceLine> {
  const dto = await apiRequest<RemittanceLineDto>("/org/numbatrak/wallet/remittance-lines/record", {
    method: "POST",
    body: {
      agentId: line.agent_id,
      remittanceDate: line.remittance_date,
      actualAmount,
    },
  });
  return { ...lineFromDto(dto), organization_id: line.organization_id };
}

/** `userId` param kept for signature compatibility - see recordRemittance. */
export async function addNetOffToLine(
  line: WalletRemittanceLine,
  amount: number,
  _userId: string,
  note?: string
): Promise<WalletRemittanceLine> {
  const dto = await apiRequest<RemittanceLineDto>("/org/numbatrak/wallet/remittance-lines/net-off", {
    method: "POST",
    body: {
      agentId: line.agent_id,
      remittanceDate: line.remittance_date,
      amount,
      note: note ?? null,
    },
  });
  return { ...lineFromDto(dto), organization_id: line.organization_id };
}

export function collectWalletSubBrands(
  lines: WalletRemittanceLine[]
): string[] {
  const set = new Set<string>();
  for (const line of lines) {
    for (const b of line.sub_brands) set.add(b);
  }
  return [...set].sort();
}

/** @deprecated Use fetchWalletRemittanceLines. Dead: not wired into WalletPage.tsx (superseded by WalletRemittanceTable). Kept for signature compatibility. */
export async function fetchWalletOrders(organizationId: string | null) {
  const lines = await fetchWalletRemittanceLines(organizationId);
  return lines.flatMap((line) =>
    line.orders.map((o) => ({
      id: o.id,
      source: o.source,
      customer_name: o.customer_name,
      phone_number: o.phone_number,
      agent_id: o.agent_id,
      agent_name: o.agent_name,
      order_revenue: o.order_revenue,
      amount_paid: o.amount_paid,
      payment_method: o.payment_method,
      money_received_by: o.money_received_by,
      wallet_status: o.wallet_status,
      completed_at: o.completed_at,
      remittance_confirmed_at: null,
      released_at: null,
    }))
  );
}
