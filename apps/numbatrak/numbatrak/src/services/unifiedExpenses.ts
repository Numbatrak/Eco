"use client";

import { apiRequest } from "../lib/apiClient";
import {
  UnifiedExpense,
  UnifiedExpenseWithRelations,
  UnifiedExpenseScope,
  ExpenseSourceType,
} from "../types/unifiedExpense";
import { emptyWithoutOrg } from "./orgQuery";
import { normalizeExpenseRow } from "../utils/expenseCategoryHelpers";
import { platformForAdvertisingSubcategory, validateExpenseAttribution } from "../utils/expenseAttribution";

interface ExpenseDto {
  id: string;
  scope: UnifiedExpenseScope;
  category: string;
  subcategory: string;
  amount: number;
  agentId: number | null;
  agentName: string | null;
  productId: string | null;
  productName: string | null;
  orderId: string | null;
  note: string | null;
  occurredAt: string;
  createdBy: string | null;
  createdAt: string | null;
  sourceType: ExpenseSourceType;
  sourceId: string | null;
  offerName: string | null;
  platform: string | null;
}

function expenseFromDto(dto: ExpenseDto, organizationId: string): UnifiedExpenseWithRelations {
  return {
    id: dto.id,
    organization_id: organizationId,
    scope: dto.scope,
    category: dto.category,
    subcategory: dto.subcategory,
    amount: dto.amount,
    agent_id: dto.agentId,
    product_id: dto.productId,
    order_id: dto.orderId,
    note: dto.note,
    occurred_at: dto.occurredAt,
    created_by: dto.createdBy,
    created_at: dto.createdAt,
    source_type: dto.sourceType,
    source_id: dto.sourceId,
    offer_name: dto.offerName,
    platform: dto.platform,
    agent: dto.agentId != null ? { id: dto.agentId, name: dto.agentName ?? "" } : null,
    product: dto.productId != null ? { id: dto.productId, name: dto.productName ?? "" } : null,
  };
}

/**
 * @deprecated Kept for signature compatibility - findExpenseBySource-based
 * idempotency now happens server-side via a DB unique-index dedup, callers
 * don't need to check first. Always returns null.
 */
export async function findExpenseBySource(
  _organizationId: string,
  _sourceType: ExpenseSourceType,
  _sourceId: string
): Promise<UnifiedExpense | null> {
  return null;
}

export async function fetchUnifiedExpenses(
  organizationId: string | null,
  filters?: { scope?: UnifiedExpenseScope; category?: string }
): Promise<UnifiedExpenseWithRelations[]> {
  const empty = emptyWithoutOrg<UnifiedExpenseWithRelations>(organizationId);
  if (empty) return empty;

  const params = new URLSearchParams();
  if (filters?.scope) params.set("scope", filters.scope);
  if (filters?.category) params.set("category", filters.category);
  const qs = params.toString();

  const { expenses } = await apiRequest<{ expenses: ExpenseDto[] }>(`/org/numbatrak/expenses${qs ? `?${qs}` : ""}`);
  return expenses.map((e) => expenseFromDto(e, organizationId!));
}

export async function createUnifiedExpense(input: {
  organization_id: string;
  scope: UnifiedExpenseScope;
  category: string;
  subcategory?: string;
  amount: number;
  agent_id?: number | null;
  product_id?: string | null;
  order_id?: string | null;
  note?: string | null;
  occurred_at: string;
  created_by?: string | null;
  source_type?: ExpenseSourceType;
  source_id?: string | null;
  offer_name?: string | null;
  platform?: string | null;
  skip_attribution_validation?: boolean;
}): Promise<UnifiedExpense> {
  const normalized = normalizeExpenseRow(input.category, input.subcategory || "", input.scope);
  const platform =
    input.platform ??
    (normalized.category === "advertising" ? platformForAdvertisingSubcategory(normalized.subcategory) : null);

  if (!input.skip_attribution_validation) {
    const attrError = validateExpenseAttribution({
      scope: input.scope,
      category: normalized.category,
      subcategory: normalized.subcategory,
      product_id: input.product_id,
      offer_name: input.offer_name,
    });
    if (attrError) throw new Error(attrError);
  }

  const dto = await apiRequest<ExpenseDto>("/org/numbatrak/expenses", {
    method: "POST",
    body: {
      scope: input.scope,
      category: normalized.category,
      subcategory: normalized.subcategory,
      amount: input.amount,
      agentId: input.agent_id,
      productId: input.product_id,
      orderId: input.order_id,
      note: input.note,
      occurredAt: input.occurred_at,
      offerName: input.offer_name,
      platform,
    },
  });
  return expenseFromDto(dto, input.organization_id);
}

/**
 * Idempotent insert for auto-feeds. The dedup itself now happens inside the
 * relevant backend module's own insert (Orders' failed-delivery write,
 * Deliveries' waybill-fee write, Wallet's net-off write) via
 * onConflictDoNothing on the DB's source-dedup unique index - this
 * standalone client-side path is unused by the ported backend modules, but
 * kept for signature compatibility with any not-yet-repointed caller.
 */
export async function createUnifiedExpenseIdempotent(
  input: Parameters<typeof createUnifiedExpense>[0] & {
    source_type: Exclude<ExpenseSourceType, "manual">;
    source_id: string;
  }
): Promise<UnifiedExpense> {
  return createUnifiedExpense({ ...input, skip_attribution_validation: true });
}

export async function deleteUnifiedExpense(id: string): Promise<void> {
  await apiRequest<void>(`/org/numbatrak/expenses/${id}`, { method: "DELETE" });
}

export async function updateUnifiedExpense(
  id: string,
  patch: Partial<{
    scope: UnifiedExpenseScope;
    category: string;
    subcategory: string;
    amount: number;
    agent_id: number | null;
    product_id: string | null;
    order_id: string | null;
    note: string | null;
    occurred_at: string;
    offer_name: string | null;
    platform: string | null;
  }>
): Promise<UnifiedExpense> {
  let category = patch.category;
  let subcategory = patch.subcategory;
  let platform = patch.platform;
  if (category !== undefined) {
    const normalized = normalizeExpenseRow(category, subcategory ?? "", patch.scope ?? "org");
    category = normalized.category;
    subcategory = normalized.subcategory;
    if (platform === undefined && normalized.category === "advertising") {
      platform = platformForAdvertisingSubcategory(normalized.subcategory);
    }
  }

  const dto = await apiRequest<ExpenseDto>(`/org/numbatrak/expenses/${id}`, {
    method: "PATCH",
    body: {
      scope: patch.scope,
      category,
      subcategory,
      amount: patch.amount,
      agentId: patch.agent_id,
      productId: patch.product_id,
      orderId: patch.order_id,
      note: patch.note,
      occurredAt: patch.occurred_at,
      offerName: patch.offer_name,
      platform,
    },
  });
  return expenseFromDto(dto, "");
}
