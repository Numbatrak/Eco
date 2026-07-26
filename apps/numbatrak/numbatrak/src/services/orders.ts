"use client";

import { supabase } from "../supabaseClient";
import { Order, OrderWithRelations } from "../types/order";
import { emptyWithoutOrg } from "./orgQuery";
import { getNextAssignedUser } from "./orderAssignmentSettings";

/**
 * Read all orders from the database (filtered by organization)
 */
export async function fetchOrders(
  organizationId: string | null,
): Promise<OrderWithRelations[]> {
  const empty = emptyWithoutOrg<OrderWithRelations>(organizationId);
  if (empty) return empty;

  let query = supabase.from("orders").select("*").eq("organization_id", organizationId);

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!data) {
    return [];
  }

  return data.map((row: any) => ({
    id: Number(row.id),
    customer_name: row.customer_name || "",
    phone_number: row.phone_number,
    location: row.location,
    order_date:
      row.order_date ||
      (row.created_at
        ? row.created_at.split("T")[0]
        : new Date().toISOString().split("T")[0]),
    order_month: row.order_month,
    order_year: row.order_year,
    product_name: row.product_name,
    mail_quan: row.mail_quan ? Number(row.mail_quan) : null,
    agent_quan: row.agent_quan ? Number(row.agent_quan) : null,
    quantity: row.quantity ? Number(row.quantity) : null,
    product2: row.product2,
    mail_quan2: row.mail_quan2 ? Number(row.mail_quan2) : null,
    agent_quan2: row.agent_quan2 ? Number(row.agent_quan2) : null,
    quantity2: row.quantity2 ? Number(row.quantity2) : null,
    cost_price: row.cost_price ? Number(row.cost_price) : null,
    delivery_fee: row.delivery_fee ? Number(row.delivery_fee) : null,
    sales_price: row.sales_price ? Number(row.sales_price) : null,
    profit: row.profit ? Number(row.profit) : null,
    order_status: row.order_status,
    delivery_date: row.delivery_date,
    delivery_month: row.delivery_month,
    delivery_year: row.delivery_year,
    confirmed_delivery: row.confirmed_delivery === true,
    agent_name: row.agent_name,
    note: row.note,
    subject: row.subject,
    assigned_to: row.assigned_to || null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }));
}

/**
 * Insert a new order into the database
 */
export async function createOrder(input: {
  customer_name: string;
  phone_number?: string | null;
  location?: string | null;
  order_date: string;
  order_month?: string | null;
  order_year?: string | null;
  product_name?: string | null;
  mail_quan?: number | null;
  agent_quan?: number | null;
  quantity?: number | null;
  product2?: string | null;
  mail_quan2?: number | null;
  agent_quan2?: number | null;
  quantity2?: number | null;
  cost_price?: number | null;
  delivery_fee?: number | null;
  sales_price?: number | null;
  profit?: number | null;
  order_status?: string | null;
  delivery_date?: string | null;
  delivery_month?: string | null;
  delivery_year?: string | null;
  confirmed_delivery?: boolean;
  agent_name?: string | null;
  note?: string | null;
  subject?: string | null;
  organization_id: string;
  assigned_to?: string | null; // Optional: if provided, will use this instead of auto-assignment
}): Promise<Order> {
  // Auto-assign order if not explicitly provided
  let assignedTo = input.assigned_to;
  if (!assignedTo) {
    try {
      assignedTo = await getNextAssignedUser(input.organization_id);
    } catch (err) {
      console.error("Error auto-assigning order:", err);
      // Continue without assignment if auto-assignment fails
      assignedTo = null;
    }
  }

  const { data, error } = await supabase
    .from("orders")
    .insert([
      {
        customer_name: input.customer_name,
        phone_number: input.phone_number || null,
        location: input.location || null,
        order_date: input.order_date,
        order_month: input.order_month || null,
        order_year: input.order_year || null,
        product_name: input.product_name || null,
        mail_quan: input.mail_quan || null,
        agent_quan: input.agent_quan || null,
        quantity: input.quantity || null,
        product2: input.product2 || null,
        mail_quan2: input.mail_quan2 || null,
        agent_quan2: input.agent_quan2 || null,
        quantity2: input.quantity2 || null,
        cost_price: input.cost_price || null,
        delivery_fee: input.delivery_fee || null,
        sales_price: input.sales_price || null,
        profit: input.profit || null,
        order_status: input.order_status || null,
        delivery_date: input.delivery_date || null,
        delivery_month: input.delivery_month || null,
        delivery_year: input.delivery_year || null,
        confirmed_delivery: input.confirmed_delivery ?? false,
        agent_name: input.agent_name || null,
        note: input.note || null,
        subject: input.subject || null,
        organization_id: input.organization_id,
        assigned_to: assignedTo,
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

  return mapOrderFromRow(data);
}

/**
 * Update an existing order in the database
 */
export async function updateOrder(
  orderId: number,
  input: Partial<{
    customer_name: string;
    phone_number: string | null;
    location: string | null;
    order_date: string;
    order_month: string | null;
    order_year: string | null;
    product_name: string | null;
    mail_quan: number | null;
    agent_quan: number | null;
    quantity: number | null;
    product2: string | null;
    mail_quan2: number | null;
    agent_quan2: number | null;
    quantity2: number | null;
    cost_price: number | null;
    delivery_fee: number | null;
    sales_price: number | null;
    profit: number | null;
    order_status: string | null;
    delivery_date: string | null;
    delivery_month: string | null;
    delivery_year: string | null;
    confirmed_delivery: boolean;
    agent_name: string | null;
    note: string | null;
    subject: string | null;
  }>,
): Promise<Order> {
  const updateData: any = {};

  if (input.customer_name !== undefined)
    updateData.customer_name = input.customer_name;
  if (input.phone_number !== undefined)
    updateData.phone_number = input.phone_number;
  if (input.location !== undefined) updateData.location = input.location;
  if (input.order_date !== undefined) updateData.order_date = input.order_date;
  if (input.order_month !== undefined)
    updateData.order_month = input.order_month;
  if (input.order_year !== undefined) updateData.order_year = input.order_year;
  if (input.product_name !== undefined)
    updateData.product_name = input.product_name;
  if (input.mail_quan !== undefined) updateData.mail_quan = input.mail_quan;
  if (input.agent_quan !== undefined) updateData.agent_quan = input.agent_quan;
  if (input.quantity !== undefined) updateData.quantity = input.quantity;
  if (input.product2 !== undefined) updateData.product2 = input.product2;
  if (input.mail_quan2 !== undefined) updateData.mail_quan2 = input.mail_quan2;
  if (input.agent_quan2 !== undefined)
    updateData.agent_quan2 = input.agent_quan2;
  if (input.quantity2 !== undefined) updateData.quantity2 = input.quantity2;
  if (input.cost_price !== undefined) updateData.cost_price = input.cost_price;
  if (input.delivery_fee !== undefined)
    updateData.delivery_fee = input.delivery_fee;
  if (input.sales_price !== undefined)
    updateData.sales_price = input.sales_price;
  if (input.profit !== undefined) updateData.profit = input.profit;
  if (input.order_status !== undefined)
    updateData.order_status = input.order_status;
  if (input.delivery_date !== undefined)
    updateData.delivery_date = input.delivery_date;
  if (input.delivery_month !== undefined)
    updateData.delivery_month = input.delivery_month;
  if (input.delivery_year !== undefined)
    updateData.delivery_year = input.delivery_year;
  if (input.confirmed_delivery !== undefined)
    updateData.confirmed_delivery = input.confirmed_delivery;
  if (input.agent_name !== undefined) updateData.agent_name = input.agent_name;
  if (input.note !== undefined) updateData.note = input.note;
  if (input.subject !== undefined) updateData.subject = input.subject;

  const { data, error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from update");
  }

  return mapOrderFromRow(data);
}

/**
 * Delete an order from the database
 */
export async function removeOrder(orderId: number): Promise<void> {
  const { error } = await supabase.from("orders").delete().eq("id", orderId);
  if (error) {
    throw error;
  }
}

/**
 * Helper function to map database row to Order type
 */
function mapOrderFromRow(row: any): Order {
  return {
    id: Number(row.id),
    customer_name: row.customer_name || "",
    phone_number: row.phone_number,
    location: row.location,
    order_date:
      row.order_date ||
      (row.created_at
        ? row.created_at.split("T")[0]
        : new Date().toISOString().split("T")[0]),
    order_month: row.order_month,
    order_year: row.order_year,
    product_name: row.product_name,
    mail_quan: row.mail_quan ? Number(row.mail_quan) : null,
    agent_quan: row.agent_quan ? Number(row.agent_quan) : null,
    quantity: row.quantity ? Number(row.quantity) : null,
    product2: row.product2,
    mail_quan2: row.mail_quan2 ? Number(row.mail_quan2) : null,
    agent_quan2: row.agent_quan2 ? Number(row.agent_quan2) : null,
    quantity2: row.quantity2 ? Number(row.quantity2) : null,
    cost_price: row.cost_price ? Number(row.cost_price) : null,
    delivery_fee: row.delivery_fee ? Number(row.delivery_fee) : null,
    sales_price: row.sales_price ? Number(row.sales_price) : null,
    profit: row.profit ? Number(row.profit) : null,
    order_status: row.order_status,
    delivery_date: row.delivery_date,
    delivery_month: row.delivery_month,
    delivery_year: row.delivery_year,
    confirmed_delivery: row.confirmed_delivery === true,
    agent_name: row.agent_name,
    note: row.note,
    subject: row.subject,
    assigned_to: row.assigned_to || null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}
