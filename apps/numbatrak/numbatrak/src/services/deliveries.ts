"use client";

import { apiRequest } from "../lib/apiClient";
import { Delivery, DeliveryWithRelations } from "../types/delivery";
import { emptyWithoutOrg } from "./orgQuery";

interface DeliveryDto {
  id: number;
  date: string;
  csr: string | null;
  agentId: number | null;
  agentName: string | null;
  status: "Waybilled" | "Delivered";
  productId: string | null;
  productName: string | null;
  quantity: number;
  cost: string;
  waybillingFee: string;
  subBrand: string | null;
  waybillBatchId: string | null;
  createdAt: string | null;
}

function deliveryFromDto(dto: DeliveryDto): DeliveryWithRelations {
  return {
    id: dto.id,
    date: dto.date,
    csr: dto.csr,
    agent_id: dto.agentId,
    status: dto.status,
    product_id: dto.productId ?? "",
    quantity: dto.quantity,
    cost: Number(dto.cost),
    waybilling_fee: Number(dto.waybillingFee ?? 0),
    sub_brand: dto.subBrand,
    waybill_batch_id: dto.waybillBatchId,
    created_at: dto.createdAt,
    agent: dto.agentId != null ? { id: dto.agentId, name: dto.agentName ?? "" } : null,
    product: dto.productId != null ? { id: dto.productId, name: dto.productName ?? "" } : null,
  };
}

/**
 * Read all deliveries from the database with relations (filtered by organization)
 */
export async function fetchDeliveries(
  organizationId: string | null = null
): Promise<DeliveryWithRelations[]> {
  const empty = emptyWithoutOrg<DeliveryWithRelations>(organizationId);
  if (empty) return empty;

  const { deliveries } = await apiRequest<{ deliveries: DeliveryDto[] }>("/org/numbatrak/deliveries");
  return deliveries.map(deliveryFromDto);
}

/**
 * Insert a new delivery into the database. Plain metadata insert - no stock
 * movement, no expense (see services/waybillIntake.ts for the flow that
 * does touch the stock ledger).
 */
export async function createDelivery(input: {
  date: string;
  csr?: string | null;
  agent_id?: number | null;
  status: "Waybilled" | "Delivered";
  /** `products.id` (UUID) */
  product_id: string;
  quantity: number;
  cost: number;
  waybilling_fee?: number;
  sub_brand?: string | null;
  waybill_batch_id?: string | null;
  organization_id: string;
}): Promise<Delivery> {
  const dto = await apiRequest<DeliveryDto>("/org/numbatrak/deliveries", {
    method: "POST",
    body: {
      date: input.date,
      csr: input.csr ?? null,
      agentId: input.agent_id ?? null,
      status: input.status,
      productId: input.product_id,
      quantity: input.quantity,
      cost: input.cost,
      waybillingFee: input.waybilling_fee ?? 0,
      subBrand: input.sub_brand ?? null,
    },
  });
  return deliveryFromDto(dto);
}

/**
 * Update an existing delivery. Metadata-only - editing never adjusts the
 * stock ledger, matching the source app exactly.
 */
export async function updateDelivery(
  deliveryId: number,
  input: {
    date?: string;
    csr?: string | null;
    agent_id?: number | null;
    status?: "Waybilled" | "Delivered";
    product_id?: string;
    quantity?: number;
    cost?: number;
    waybilling_fee?: number;
    sub_brand?: string | null;
  }
): Promise<Delivery> {
  const dto = await apiRequest<DeliveryDto>(`/org/numbatrak/deliveries/${deliveryId}`, {
    method: "PATCH",
    body: {
      date: input.date,
      csr: input.csr,
      agentId: input.agent_id,
      status: input.status,
      productId: input.product_id,
      quantity: input.quantity,
      cost: input.cost,
      waybillingFee: input.waybilling_fee,
      subBrand: input.sub_brand,
    },
  });
  return deliveryFromDto(dto);
}

/**
 * Delete a delivery from the database
 */
export async function removeDelivery(deliveryId: number): Promise<void> {
  await apiRequest<void>(`/org/numbatrak/deliveries/${deliveryId}`, { method: "DELETE" });
}

/**
 * Get month name from date
 */
export function getMonthName(date: string): string {
  const d = new Date(date);
  return d.toLocaleString("default", { month: "long" });
}

/**
 * Monthly summary data structure
 */
export interface MonthlySummary {
  month: string;
  monthNumber: number;
  waybilled: number;
  delivered: number;
  balance: number;
  waybill_fee: number;
}

export interface MonthlySummaryQueryOptions {
  /** Limit to Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec */
  quarter?: "all" | "Q1" | "Q2" | "Q3" | "Q4";
  agentId?: number;
  /** `deliveries.product_id` (UUID) */
  productId?: number | string;
  /** Free-text CSR as stored on `deliveries.csr` */
  csrText?: string;
  status?: "Waybilled" | "Delivered";
  subBrand?: string;
  location?: "all" | "lagos" | "outside_lagos";
}

/**
 * Get monthly summary of deliveries for a specific year (filtered by organization)
 */
export async function fetchMonthlySummary(
  organizationId: string | null,
  year: number = new Date().getFullYear(),
  options?: MonthlySummaryQueryOptions
): Promise<MonthlySummary[]> {
  const empty = emptyWithoutOrg<MonthlySummary>(organizationId);
  if (empty) return empty;

  const params = new URLSearchParams();
  params.set("year", String(year));
  if (options?.quarter) params.set("quarter", options.quarter);
  if (options?.agentId != null) params.set("agentId", String(options.agentId));
  if (options?.productId != null) params.set("productId", String(options.productId));
  if (options?.csrText) params.set("csrText", options.csrText);
  if (options?.status) params.set("status", options.status);
  if (options?.subBrand) params.set("subBrand", options.subBrand);
  if (options?.location) params.set("location", options.location);

  const { summary } = await apiRequest<{
    summary: Array<{
      month: string;
      monthNumber: number;
      waybilled: number;
      delivered: number;
      balance: number;
      waybillFee: number;
    }>;
  }>(`/org/numbatrak/deliveries/monthly-summary?${params.toString()}`);

  return summary.map((s) => ({
    month: s.month,
    monthNumber: s.monthNumber,
    waybilled: s.waybilled,
    delivered: s.delivered,
    balance: s.balance,
    waybill_fee: s.waybillFee,
  }));
}
