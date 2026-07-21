"use client";

import { supabase } from "../supabaseClient";
import { isAdvertisingCategory } from "../utils/expenseCategoryHelpers";
import { fetchTotalProfit } from "./dashboard";

/**
 * Cost per acquisition (ad spend / new orders in the period)
 */
export async function cpaForPeriod(params: {
  organizationId: string;
  startDate?: string;
  endDate?: string;
  formId?: string | null;
  /** When set, new order count is limited to this CSR (ad spend remains org-level). */
  csrId?: string | null;
}): Promise<{ cpa: number; adSpend: number; newOrders: number }> {
  const { organizationId, startDate, endDate, formId, csrId } = params;

  let spendQ = supabase
    .from("unified_expenses")
    .select("amount, occurred_at, category")
    .eq("organization_id", organizationId)
    .eq("scope", "org");
  if (formId) {
    spendQ = spendQ;
  }
  const { data: spRows, error: spErr } = await spendQ;
  if (spErr) {
    console.warn("unified_expenses cpa", spErr);
  }
  const spendRows = (spRows || []) as { amount: number; occurred_at: string }[];
  const filteredSpend = spendRows.filter((r) => {
    const t = r.occurred_at;
    if (startDate && t < startDate) {
      return false;
    }
    if (endDate && t > endDate) {
      return false;
    }
    return isAdvertisingCategory((r as { category?: string }).category);
  });
  const adSpend = filteredSpend.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  let oq = supabase
    .from("customer_orders")
    .select("id, created_at", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if (formId) {
    oq = oq.eq("form_id", formId);
  }
  if (csrId) {
    oq = oq.eq("csr_id", csrId);
  }
  if (startDate) {
    oq = oq.gte("created_at", startDate);
  }
  if (endDate) {
    const e = new Date(endDate);
    e.setDate(e.getDate() + 1);
    oq = oq.lt("created_at", e.toISOString());
  }
  const { count, error: ocErr } = await oq;
  if (ocErr) {
    if (ocErr.message?.includes("schema cache") || ocErr.code === "42P01") {
      let fq = supabase
        .from("form_responses")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("response_type", "order");
      if (formId) {
        fq = fq.eq("form_id", formId);
      }
      if (csrId) {
        fq = fq.eq("csr_id", csrId);
      }
      if (startDate) {
        fq = fq.gte("created_at", startDate);
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setDate(e.getDate() + 1);
        fq = fq.lt("created_at", e.toISOString());
      }
      const { count: fc } = await fq;
      const n = fc || 0;
      const cpa = n > 0 && adSpend > 0 ? adSpend / n : 0;
      return { cpa, adSpend, newOrders: n };
    }
    throw ocErr;
  }
  const newOrders = count || 0;
  const cpa = newOrders > 0 && adSpend > 0 ? adSpend / newOrders : 0;
  return { cpa, adSpend, newOrders };
}

export async function totalProfitV2(
  organizationId: string,
  startDate?: string,
  endDate?: string,
  formId?: string | null,
  csrId?: string | null
): Promise<number> {
  return fetchTotalProfit(
    organizationId,
    startDate,
    endDate,
    formId ?? undefined,
    csrId ?? undefined
  );
}
