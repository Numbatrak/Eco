"use client";

import { supabase } from "../supabaseClient";
import { Delivery, DeliveryWithRelations } from "../types/delivery";
import { emptyWithoutOrg } from "./orgQuery";

/**
 * Read all deliveries from the database with relations (filtered by organization)
 */
export async function fetchDeliveries(
  organizationId: string | null = null
): Promise<DeliveryWithRelations[]> {
  const empty = emptyWithoutOrg<DeliveryWithRelations>(organizationId);
  if (empty) return empty;

  let query = supabase.from("deliveries").select("*").eq("organization_id", organizationId);

  const { data: deliveries, error } = await query
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!deliveries || deliveries.length === 0) {
    return [];
  }

  // Get unique agent and product IDs
  const agentIds = [...new Set(deliveries.map((d: any) => d.agent_id).filter(Boolean))];
  const productIds = [...new Set(deliveries.map((d: any) => d.product_id).filter(Boolean))];

  // Fetch agents and products separately
  const [agentsResult, productsResult] = await Promise.all([
    agentIds.length > 0
      ? supabase.from("agents").select("id, name").in("id", agentIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length > 0
      ? supabase.from("products").select("id, name").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Create maps for quick lookup
  const agentsMap = new Map(
    (agentsResult.data || []).map((a: any) => [Number(a.id), { id: Number(a.id), name: a.name }])
  );
  const productsMap = new Map(
    (productsResult.data || []).map((p: any) => [
      String(p.id),
      { id: String(p.id), name: p.name },
    ])
  );

  // Map deliveries with relations
  return deliveries.map((row: any) => ({
    id: Number(row.id),
    date: row.date,
    csr: row.csr,
    agent_id: row.agent_id ? Number(row.agent_id) : null,
    status: row.status as "Waybilled" | "Delivered",
    product_id: String(row.product_id),
    quantity: Number(row.quantity),
    cost: Number(row.cost),
    waybilling_fee: Number(row.waybilling_fee || 0),
    sub_brand: row.sub_brand ?? null,
    waybill_batch_id: row.waybill_batch_id ?? null,
    created_at: row.created_at ?? null,
    agent: row.agent_id ? agentsMap.get(Number(row.agent_id)) || null : null,
    product: row.product_id
      ? productsMap.get(String(row.product_id)) || null
      : null,
  }));
}

/**
 * Insert a new delivery into the database
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
  const { data, error } = await supabase
    .from("deliveries")
    .insert([
      {
        date: input.date,
        csr: input.csr || null,
        agent_id: input.agent_id || null,
        status: input.status,
        product_id: input.product_id,
        quantity: input.quantity,
        cost: input.cost,
        waybilling_fee: input.waybilling_fee || 0,
        sub_brand: input.sub_brand ?? null,
        waybill_batch_id: input.waybill_batch_id ?? null,
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
    csr: data.csr,
    agent_id: data.agent_id ? Number(data.agent_id) : null,
    status: data.status as "Waybilled" | "Delivered",
    product_id: String(data.product_id),
    quantity: Number(data.quantity),
    cost: Number(data.cost),
    waybilling_fee: Number(data.waybilling_fee || 0),
    sub_brand: data.sub_brand ?? null,
    waybill_batch_id: data.waybill_batch_id ?? null,
    created_at: data.created_at ?? null,
  };
}

/**
 * Update an existing delivery in the database
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
  const updateData: any = {};
  if (input.date !== undefined) updateData.date = input.date;
  if (input.csr !== undefined) updateData.csr = input.csr;
  if (input.agent_id !== undefined) updateData.agent_id = input.agent_id;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.product_id !== undefined) updateData.product_id = input.product_id;
  if (input.quantity !== undefined) updateData.quantity = input.quantity;
  if (input.cost !== undefined) updateData.cost = input.cost;
  if (input.waybilling_fee !== undefined)
    updateData.waybilling_fee = input.waybilling_fee;
  if (input.sub_brand !== undefined) updateData.sub_brand = input.sub_brand;

  const { data, error } = await supabase
    .from("deliveries")
    .update(updateData)
    .eq("id", deliveryId)
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
    csr: data.csr,
    agent_id: data.agent_id ? Number(data.agent_id) : null,
    status: data.status as "Waybilled" | "Delivered",
    product_id: String(data.product_id),
    quantity: Number(data.quantity),
    cost: Number(data.cost),
    waybilling_fee: Number(data.waybilling_fee || 0),
    sub_brand: data.sub_brand ?? null,
    waybill_batch_id: data.waybill_batch_id ?? null,
    created_at: data.created_at ?? null,
  };
}

/**
 * Delete a delivery from the database
 */
export async function removeDelivery(deliveryId: number): Promise<void> {
  const { error } = await supabase
    .from("deliveries")
    .delete()
    .eq("id", deliveryId);
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
  /** `deliveries.product_id` (legacy int or UUID depending on deployment) */
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

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  let query = supabase
    .from("deliveries")
    .select("date, status, cost, waybilling_fee, agent_id")
    .eq("organization_id", organizationId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  if (options?.agentId != null) {
    query = query.eq("agent_id", options.agentId);
  }
  if (options?.productId != null) {
    query = query.eq("product_id", options.productId);
  }
  if (options?.csrText) {
    query = query.ilike("csr", `%${options.csrText.trim()}%`);
  }
  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.subBrand) {
    query = query.eq("sub_brand", options.subBrand);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  let rows = data || [];

  if (options?.location && options.location !== "all" && rows.length) {
    const agentIds = [
      ...new Set(rows.map((d: { agent_id: number | null }) => d.agent_id).filter(Boolean)),
    ] as number[];
    if (agentIds.length) {
      const { data: agents } = await supabase
        .from("agents")
        .select("id, locations")
        .in("id", agentIds);
      const lagosIds = new Set<number>();
      for (const a of agents || []) {
        const locs =
          typeof (a as { locations: unknown }).locations === "string"
            ? (a as { locations: string }).locations.split(",").map((l) => l.trim())
            : [];
        if (locs.some((l) => l.toLowerCase() === "lagos")) {
          lagosIds.add(Number((a as { id: number }).id));
        }
      }
      rows = rows.filter((d: { agent_id: number | null }) => {
        if (d.agent_id == null) return false;
        const lagos = lagosIds.has(Number(d.agent_id));
        return options.location === "lagos" ? lagos : !lagos;
      });
    }
  }

  if (!rows.length) {
    return [];
  }

  // Initialize all 12 months
  const months: MonthlySummary[] = [
    {
      month: "January",
      monthNumber: 1,
      waybilled: 0,
      delivered: 0,
      balance: 0,
      waybill_fee: 0,
    },
    {
      month: "February",
      monthNumber: 2,
      waybilled: 0,
      delivered: 0,
      balance: 0,
      waybill_fee: 0,
    },
    {
      month: "March",
      monthNumber: 3,
      waybilled: 0,
      delivered: 0,
      balance: 0,
      waybill_fee: 0,
    },
    {
      month: "April",
      monthNumber: 4,
      waybilled: 0,
      delivered: 0,
      balance: 0,
      waybill_fee: 0,
    },
    {
      month: "May",
      monthNumber: 5,
      waybilled: 0,
      delivered: 0,
      balance: 0,
      waybill_fee: 0,
    },
    {
      month: "June",
      monthNumber: 6,
      waybilled: 0,
      delivered: 0,
      balance: 0,
      waybill_fee: 0,
    },
    {
      month: "July",
      monthNumber: 7,
      waybilled: 0,
      delivered: 0,
      balance: 0,
      waybill_fee: 0,
    },
    {
      month: "August",
      monthNumber: 8,
      waybilled: 0,
      delivered: 0,
      balance: 0,
      waybill_fee: 0,
    },
    {
      month: "September",
      monthNumber: 9,
      waybilled: 0,
      delivered: 0,
      balance: 0,
      waybill_fee: 0,
    },
    {
      month: "October",
      monthNumber: 10,
      waybilled: 0,
      delivered: 0,
      balance: 0,
      waybill_fee: 0,
    },
    {
      month: "November",
      monthNumber: 11,
      waybilled: 0,
      delivered: 0,
      balance: 0,
      waybill_fee: 0,
    },
    {
      month: "December",
      monthNumber: 12,
      waybilled: 0,
      delivered: 0,
      balance: 0,
      waybill_fee: 0,
    },
  ];

  // Process each delivery
  rows.forEach((delivery: any) => {
    const date = new Date(delivery.date);
    const monthIndex = date.getMonth(); // 0-11
    const cost = Number(delivery.cost);
    const waybillFee = Number(delivery.waybilling_fee || 0);

    if (delivery.status === "Waybilled") {
      months[monthIndex].waybilled += cost;
      months[monthIndex].waybill_fee += waybillFee;
    } else if (delivery.status === "Delivered") {
      months[monthIndex].delivered += cost;
    }
  });

  // Calculate balance for each month
  months.forEach((month) => {
    month.balance = month.waybilled - month.delivered;
  });

  if (options?.quarter && options.quarter !== "all") {
    const map: Record<string, [number, number, number]> = {
      Q1: [0, 1, 2],
      Q2: [3, 4, 5],
      Q3: [6, 7, 8],
      Q4: [9, 10, 11],
    };
    const idx = map[options.quarter];
    if (idx) {
      return months.filter((m) => idx.includes(m.monthNumber - 1));
    }
  }

  return months;
}
