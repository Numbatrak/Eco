"use client";

import { apiRequest } from "../lib/apiClient";
import { Delivery } from "../types/delivery";
import { createDelivery } from "./deliveries";

export type WaybillIntakeLine = {
  agent_id: number;
  product_id: string;
  quantity: number;
  cost: number;
  waybilling_fee?: number;
  csr?: string | null;
  sub_brand?: string | null;
};

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

function deliveryFromDto(dto: DeliveryDto): Delivery {
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
  };
}

/**
 * Post a waybill: delivery row (Waybilled) + stock-in to agent + fee-only
 * expense, all atomic server-side (POST /deliveries/waybill-batch with a
 * single line). Product cost is inventory value, not booked as an
 * operational expense.
 */
export async function intakeWaybill(input: {
  organization_id: string;
  date: string;
  agent_id: number;
  product_id: string;
  quantity: number;
  cost: number;
  waybilling_fee?: number;
  csr?: string | null;
  sub_brand?: string | null;
  waybill_batch_id?: string | null;
  recorded_by_user_id?: string | null;
}): Promise<Delivery> {
  if (!input.agent_id) {
    throw new Error("Agent is required to post a waybill.");
  }
  if (input.quantity <= 0) {
    throw new Error("Quantity must be positive.");
  }

  const { deliveries } = await apiRequest<{ deliveries: DeliveryDto[] }>("/org/numbatrak/deliveries/waybill-batch", {
    method: "POST",
    body: {
      date: input.date,
      csr: input.csr ?? null,
      subBrand: input.sub_brand ?? null,
      lines: [
        {
          agentId: input.agent_id,
          productId: input.product_id,
          quantity: input.quantity,
          cost: input.cost,
          waybillingFee: input.waybilling_fee ?? 0,
        },
      ],
    },
  });
  return deliveryFromDto(deliveries[0]!);
}

/**
 * Bulk waybill: one delivery row per line, linked stock movements, fee
 * expenses only - all atomic server-side, one shared batch id.
 */
export async function intakeWaybillBatch(input: {
  organization_id: string;
  occurred_at: string;
  csr?: string | null;
  lines: WaybillIntakeLine[];
  recorded_by_user_id?: string | null;
}): Promise<{ batchId: string; deliveries: Delivery[] }> {
  if (!input.lines.length) {
    throw new Error("Add at least one waybill line.");
  }

  const date = input.occurred_at.slice(0, 10);
  const subBrand = input.lines[0]!.sub_brand ?? null;

  const { deliveries } = await apiRequest<{ deliveries: DeliveryDto[] }>("/org/numbatrak/deliveries/waybill-batch", {
    method: "POST",
    body: {
      date,
      csr: input.csr ?? input.lines[0]!.csr ?? null,
      subBrand,
      lines: input.lines.map((line) => ({
        agentId: line.agent_id,
        productId: line.product_id,
        quantity: line.quantity,
        cost: line.cost,
        waybillingFee: line.waybilling_fee ?? 0,
      })),
    },
  });

  const mapped = deliveries.map(deliveryFromDto);
  return { batchId: mapped[0]?.waybill_batch_id ?? "", deliveries: mapped };
}

/**
 * Historical / balance-only delivery row (e.g. import as Delivered).
 * Does not touch stock ledger or expenses.
 */
export async function intakeDeliveryRecord(input: {
  organization_id: string;
  date: string;
  csr?: string | null;
  agent_id?: number | null;
  status: "Waybilled" | "Delivered";
  product_id: string;
  quantity: number;
  cost: number;
  waybilling_fee?: number;
  sub_brand?: string | null;
}): Promise<Delivery> {
  if (input.status === "Waybilled") {
    if (!input.agent_id) {
      throw new Error("Agent is required for Waybilled entries.");
    }
    return intakeWaybill({
      organization_id: input.organization_id,
      date: input.date,
      agent_id: input.agent_id,
      product_id: input.product_id,
      quantity: input.quantity,
      cost: input.cost,
      waybilling_fee: input.waybilling_fee,
      csr: input.csr,
      sub_brand: input.sub_brand,
    });
  }

  return createDelivery({
    organization_id: input.organization_id,
    date: input.date,
    csr: input.csr ?? null,
    agent_id: input.agent_id ?? null,
    status: input.status,
    product_id: input.product_id,
    quantity: input.quantity,
    cost: input.cost,
    waybilling_fee: input.waybilling_fee ?? 0,
    sub_brand: input.sub_brand ?? null,
  });
}
