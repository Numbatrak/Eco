"use client";

import { supabase } from "../supabaseClient";
import { AgentExpense, AgentExpenseWithRelations } from "../types/expense";
import { emptyWithoutOrg } from "./orgQuery";

/**
 * Read all agent expenses from the database with relations
 */
export async function fetchExpenses(
  organizationId: string | null = null
): Promise<AgentExpenseWithRelations[]> {
  const empty = emptyWithoutOrg<AgentExpenseWithRelations>(organizationId);
  if (empty) return empty;

  let query = supabase.from("agent_expenses").select("*").eq("organization_id", organizationId);

  const { data: expenses, error } = await query
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!expenses || expenses.length === 0) {
    return [];
  }

  // Get unique agent IDs
  const agentIds = [...new Set(expenses.map((e: any) => e.agent_id).filter(Boolean))];

  // Fetch agents separately
  const agentsResult = agentIds.length > 0
    ? await supabase.from("agents").select("id, name").in("id", agentIds)
    : { data: [], error: null };

  // Create map for quick lookup
  const agentsMap = new Map(
    (agentsResult.data || []).map((a: any) => [Number(a.id), { id: Number(a.id), name: a.name }])
  );

  return expenses.map((row: any) => ({
    id: Number(row.id),
    date: row.date,
    category: row.category,
    amount: Number(row.amount),
    agent_id: row.agent_id ? Number(row.agent_id) : null,
    created_at: row.created_at ?? null,
    agent: row.agent_id ? agentsMap.get(Number(row.agent_id)) || null : null,
  }));
}

/**
 * Insert a new expense into the database
 */
export async function createExpense(input: {
  date: string;
  category: string;
  amount: number;
  agent_id?: number | null;
  organization_id: string;
}): Promise<AgentExpense> {
  const { data, error } = await supabase
    .from("agent_expenses")
    .insert([
      {
        date: input.date,
        category: input.category,
        amount: input.amount,
        agent_id: input.agent_id || null,
        organization_id: input.organization_id,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from insert");
  }

  return {
    id: Number(data.id),
    date: data.date,
    category: data.category,
    amount: Number(data.amount),
    agent_id: data.agent_id ? Number(data.agent_id) : null,
    created_at: data.created_at ?? null,
  };
}

/**
 * Update an existing expense in the database
 */
export async function updateExpense(
  expenseId: number,
  input: {
    date?: string;
    category?: string;
    amount?: number;
    agent_id?: number | null;
  }
): Promise<AgentExpense> {
  const updateData: any = {};
  if (input.date !== undefined) updateData.date = input.date;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.amount !== undefined) updateData.amount = input.amount;
  if (input.agent_id !== undefined) updateData.agent_id = input.agent_id;

  const { data, error } = await supabase
    .from("agent_expenses")
    .update(updateData)
    .eq("id", expenseId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from update");
  }

  return {
    id: Number(data.id),
    date: data.date,
    category: data.category,
    amount: Number(data.amount),
    agent_id: data.agent_id ? Number(data.agent_id) : null,
    created_at: data.created_at ?? null,
  };
}

/**
 * Delete an expense from the database
 */
export async function removeExpense(expenseId: number): Promise<void> {
  const { error } = await supabase
    .from("agent_expenses")
    .delete()
    .eq("id", expenseId);
  if (error) {
    throw error;
  }
}

/**
 * Get month name from date
 */
export function getMonthName(date: string): string {
  const d = new Date(date);
  return d.toLocaleString("default", { month: "long" });
}

/**
 * Monthly expense summary data structure
 */
export interface MonthlyExpenseSummary {
  month: string;
  monthNumber: number;
  total: number;
  categoryBreakdown: Record<string, number>;
}

/**
 * Get monthly summary of expenses for a specific year (filtered by organization)
 */
export async function fetchMonthlyExpenseSummary(
  organizationId: string | null,
  year: number = new Date().getFullYear()
): Promise<MonthlyExpenseSummary[]> {
  const empty = emptyWithoutOrg<MonthlyExpenseSummary>(organizationId);
  if (empty) return empty;

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  let query = supabase
    .from("agent_expenses")
    .select("date, category, amount")
    .eq("organization_id", organizationId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  if (!data) {
    return [];
  }

  // Initialize all 12 months
  const months: MonthlyExpenseSummary[] = Array.from(
    { length: 12 },
    (_, i) => ({
      month: new Date(2024, i, 1).toLocaleString("default", { month: "long" }),
      monthNumber: i + 1,
      total: 0,
      categoryBreakdown: {},
    })
  );

  // Process each expense
  data.forEach((expense: any) => {
    const date = new Date(expense.date);
    const monthIndex = date.getMonth(); // 0-11
    const amount = Number(expense.amount);
    const category = expense.category;

    months[monthIndex].total += amount;
    if (!months[monthIndex].categoryBreakdown[category]) {
      months[monthIndex].categoryBreakdown[category] = 0;
    }
    months[monthIndex].categoryBreakdown[category] += amount;
  });

  return months;
}
