"use client";

import { supabase } from "../supabaseClient";
import {
  UnifiedExpense,
  UnifiedExpenseWithRelations,
  UnifiedExpenseScope,
  ExpenseSourceType,
} from "../types/unifiedExpense";
import { emptyWithoutOrg } from "./orgQuery";
import { normalizeExpenseRow } from "../utils/expenseCategoryHelpers";
import {
  platformForAdvertisingSubcategory,
  validateExpenseAttribution,
} from "../utils/expenseAttribution";

function mapExpenseRow(
  row: Record<string, unknown>,
  am: Map<number, { id: number; name: string }>,
  pm: Map<string, { id: string; name: string }>
): UnifiedExpenseWithRelations {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    scope: row.scope as UnifiedExpenseScope,
    category: (row.category as string) || "",
    subcategory: (row.subcategory as string) || "",
    amount: Number(row.amount) || 0,
    agent_id: row.agent_id != null ? Number(row.agent_id) : null,
    product_id: (row.product_id as string | null) ?? null,
    order_id: (row.order_id as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    occurred_at:
      typeof row.occurred_at === "string"
        ? row.occurred_at
        : String(row.occurred_at ?? ""),
    created_by: (row.created_by as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    source_type: (row.source_type as ExpenseSourceType) ?? "manual",
    source_id: (row.source_id as string | null) ?? null,
    offer_name: (row.offer_name as string | null) ?? null,
    platform: (row.platform as string | null) ?? null,
    agent:
      row.agent_id != null
        ? am.get(Number(row.agent_id)) || null
        : null,
    product: row.product_id
      ? pm.get(row.product_id as string) || null
      : null,
  };
}

export async function findExpenseBySource(
  organizationId: string,
  sourceType: ExpenseSourceType,
  sourceId: string
): Promise<UnifiedExpense | null> {
  const { data, error } = await supabase
    .from("unified_expenses")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (error) throw error;
  return data ? (data as unknown as UnifiedExpense) : null;
}

export async function fetchUnifiedExpenses(
  organizationId: string | null,
  filters?: { scope?: UnifiedExpenseScope; category?: string }
): Promise<UnifiedExpenseWithRelations[]> {
  const empty = emptyWithoutOrg<UnifiedExpenseWithRelations>(organizationId);
  if (empty) return empty;

  let q = supabase
    .from("unified_expenses")
    .select("*")
    .eq("organization_id", organizationId);
  if (filters?.scope) q = q.eq("scope", filters.scope);
  if (filters?.category) q = q.eq("category", filters.category);

  const { data, error } = await q
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!data?.length) return [];

  const agentIds = [
    ...new Set(data.map((e) => e.agent_id).filter((x) => x != null)),
  ] as number[];
  const productIds = [
    ...new Set(data.map((e) => e.product_id).filter(Boolean)),
  ] as string[];

  const [a, p] = await Promise.all([
    agentIds.length
      ? supabase.from("agents").select("id, name").in("id", agentIds)
      : { data: [] },
    productIds.length
      ? supabase.from("products").select("id, name").in("id", productIds)
      : { data: [] },
  ]);

  const am = new Map(
    (a.data || []).map((x) => [Number(x.id), { id: Number(x.id), name: x.name }])
  );
  const pm = new Map(
    (p.data || []).map((x) => [x.id, { id: x.id, name: x.name }])
  );

  return (data as Record<string, unknown>[]).map((row) =>
    mapExpenseRow(row, am, pm)
  );
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
  const normalized = normalizeExpenseRow(
    input.category,
    input.subcategory || "",
    input.scope
  );

  const platform =
    input.platform ??
    (normalized.category === "advertising"
      ? platformForAdvertisingSubcategory(normalized.subcategory)
      : null);

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

  const { data, error } = await supabase
    .from("unified_expenses")
    .insert({
      organization_id: input.organization_id,
      scope: input.scope,
      category: normalized.category,
      subcategory: normalized.subcategory,
      amount: input.amount,
      agent_id: input.agent_id ?? null,
      product_id: input.product_id ?? null,
      order_id: input.order_id ?? null,
      note: input.note ?? null,
      occurred_at: input.occurred_at,
      created_by: input.created_by ?? null,
      source_type: input.source_type ?? "manual",
      source_id: input.source_id ?? null,
      offer_name: input.offer_name?.trim() || null,
      platform,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as UnifiedExpense;
}

/** Idempotent insert for auto-feeds — returns existing row when source matches */
export async function createUnifiedExpenseIdempotent(
  input: Parameters<typeof createUnifiedExpense>[0] & {
    source_type: Exclude<ExpenseSourceType, "manual">;
    source_id: string;
  }
): Promise<UnifiedExpense> {
  const existing = await findExpenseBySource(
    input.organization_id,
    input.source_type,
    input.source_id
  );
  if (existing) return existing;

  return createUnifiedExpense({
    ...input,
    skip_attribution_validation: true,
  });
}

export async function deleteUnifiedExpense(id: string) {
  const { error } = await supabase.from("unified_expenses").delete().eq("id", id);
  if (error) throw error;
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
) {
  const patchOut: Record<string, unknown> = { ...patch };
  if (patch.category !== undefined) {
    const normalized = normalizeExpenseRow(
      patch.category,
      patch.subcategory ?? "",
      patch.scope ?? "org"
    );
    patchOut.category = normalized.category;
    patchOut.subcategory = normalized.subcategory;
    if (patch.platform === undefined && normalized.category === "advertising") {
      patchOut.platform = platformForAdvertisingSubcategory(normalized.subcategory);
    }
  }

  const { data, error } = await supabase
    .from("unified_expenses")
    .update(patchOut)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as UnifiedExpense;
}
