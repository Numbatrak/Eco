"use client";

import { apiRequest } from "../lib/apiClient";
import {
  StockMovement,
  StockMovementType,
  ShrinkageMovementType,
  StockMovementListOptions,
} from "../types/stockMovement";

interface StockMovementDto {
  id: string;
  movementType: StockMovementType;
  productId: string;
  productName: string | null;
  quantity: number;
  fromAgentId: number | null;
  fromAgentName: string | null;
  toAgentId: number | null;
  toAgentName: string | null;
  orderId: string | null;
  waybillBatchId: string | null;
  occurredAt: string;
  cost: string;
  fee: string;
  notes: string | null;
  createdAt: string | null;
}

function dtoToMovement(dto: StockMovementDto, organizationId: string): StockMovement {
  return {
    id: dto.id,
    organization_id: organizationId,
    movement_type: dto.movementType,
    product_id: dto.productId,
    quantity: dto.quantity,
    from_agent_id: dto.fromAgentId,
    to_agent_id: dto.toAgentId,
    order_id: dto.orderId,
    waybill_batch_id: dto.waybillBatchId,
    legacy_delivery_id: null,
    occurred_at: dto.occurredAt,
    cost: Number(dto.cost),
    fee: Number(dto.fee),
    recorded_by_user_id: null,
    notes: dto.notes,
    created_at: dto.createdAt,
  };
}

export async function listStockMovements(
  organizationId: string,
  options?: StockMovementListOptions
): Promise<StockMovement[]> {
  const params = new URLSearchParams();
  if (options?.product_id) params.set("productId", options.product_id);
  if (options?.agent_id != null) params.set("agentId", String(options.agent_id));
  if (options?.movement_type) params.set("movementType", options.movement_type);
  if (options?.date_from) params.set("dateFrom", options.date_from);
  if (options?.date_to) params.set("dateTo", options.date_to);
  if (options?.limit) params.set("limit", String(options.limit));

  const qs = params.toString();
  const { movements } = await apiRequest<{ movements: StockMovementDto[] }>(
    `/org/numbatrak/inventory/movements${qs ? `?${qs}` : ""}`
  );
  return movements.map((dto) => dtoToMovement(dto, organizationId));
}

export async function createTransferMovement(input: {
  organization_id: string;
  from_agent_id: number;
  to_agent_id: number;
  product_id: string;
  quantity: number;
  notes: string;
  recorded_by_user_id?: string | null;
  occurred_at?: string;
}): Promise<{ id: string }> {
  const dto = await apiRequest<StockMovementDto>("/org/numbatrak/inventory/transfer", {
    method: "POST",
    body: {
      fromAgentId: input.from_agent_id,
      toAgentId: input.to_agent_id,
      productId: input.product_id,
      quantity: input.quantity,
      notes: input.notes.trim(),
    },
  });
  return { id: dto.id };
}

/**
 * @deprecated Delivery-movement creation (with its insufficient-stock check
 * and per-order idempotent dedup) now lives entirely server-side in
 * numbatrak-orders' mark-delivered flow (apps/api's lib/stock.ts,
 * lib/orders.ts::updateOrder). The only remaining caller,
 * services/orderDelivery.ts, is itself dead code (zero callers anywhere in
 * the ported UI) - kept only so that file still compiles. Throws if
 * actually invoked.
 */
export async function createDeliveryMovement(_input: {
  organization_id: string;
  from_agent_id: number;
  product_id: string;
  quantity: number;
  order_id?: string | null;
  cost?: number;
  fee?: number;
  occurred_at?: string;
}): Promise<{ id: string }> {
  throw new Error("createDeliveryMovement isn't ported to the new backend - order delivery already handles this server-side.");
}

export async function createShrinkageMovement(input: {
  organization_id: string;
  movement_type: ShrinkageMovementType;
  from_agent_id: number;
  product_id: string;
  quantity: number;
  notes: string;
  recorded_by_user_id?: string | null;
  occurred_at?: string;
}): Promise<{ id: string }> {
  const dto = await apiRequest<StockMovementDto>("/org/numbatrak/inventory/adjust", {
    method: "POST",
    body: {
      movementType: input.movement_type,
      fromAgentId: input.from_agent_id,
      productId: input.product_id,
      quantity: input.quantity,
      notes: input.notes.trim(),
    },
  });
  return { id: dto.id };
}
