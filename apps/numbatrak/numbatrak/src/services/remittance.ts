"use client";

import { apiRequest } from "../lib/apiClient";
import { emptyWithoutOrg } from "./orgQuery";
import {
  RemittanceSourceOrder,
  RemittanceLine,
  RemittanceSummary,
  RemittanceLineStatus,
} from "../types/remittance";
import { resolveDateRange, withinDateRange, DateFilter } from "../utils/dateRange";

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
  moneyReceivedBy: RemittanceSourceOrder["money_received_by"];
  remittanceStatus: RemittanceSourceOrder["remittance_status"];
  completedAt: string | null;
}

function sourceOrderFromDto(dto: SourceOrderDto): RemittanceSourceOrder {
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
    remittance_status: dto.remittanceStatus,
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

function lineFromDto(dto: RemittanceLineDto): RemittanceLine {
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

export async function fetchRemittanceLines(
  organizationId: string | null
): Promise<RemittanceLine[]> {
  const empty = emptyWithoutOrg<RemittanceLine>(organizationId);
  if (empty) return empty;

  const { lines } = await apiRequest<{ lines: RemittanceLineDto[] }>("/org/numbatrak/remittance/lines");
  return lines.map((l) => ({ ...lineFromDto(l), organization_id: organizationId! }));
}

export function computeRemittanceSummary(
  lines: RemittanceLine[],
  dateFilter?: DateFilter
): RemittanceSummary {
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
  lines: RemittanceLine[],
  options: {
    dateFilter?: DateFilter;
    statusFilter?: "all" | RemittanceLineStatus;
    agentId?: number | null;
    subBrand?: string | null;
    search?: string;
  }
): RemittanceLine[] {
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
  line: RemittanceLine,
  actualAmount: number,
  _userId: string
): Promise<RemittanceLine> {
  const dto = await apiRequest<RemittanceLineDto>("/org/numbatrak/remittance/lines/record", {
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
  line: RemittanceLine,
  amount: number,
  _userId: string,
  note?: string,
  subcategory?: string
): Promise<RemittanceLine> {
  const dto = await apiRequest<RemittanceLineDto>("/org/numbatrak/remittance/lines/net-off", {
    method: "POST",
    body: {
      agentId: line.agent_id,
      remittanceDate: line.remittance_date,
      amount,
      note: note ?? null,
      subcategory: subcategory ?? undefined,
    },
  });
  return { ...lineFromDto(dto), organization_id: line.organization_id };
}

export function collectRemittanceSubBrands(
  lines: RemittanceLine[]
): string[] {
  const set = new Set<string>();
  for (const line of lines) {
    for (const b of line.sub_brands) set.add(b);
  }
  return [...set].sort();
}
