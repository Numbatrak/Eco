"use client";

import { supabase } from "../supabaseClient";
import { createAbandonedCart as persistAbandonedCart } from "./abandonedCarts";

/**
 * Parse product text from form option
 * Example: "2 Vacuum Sealer = ₦35,500.00" -> { productName: "Vacuum Sealer", quantity: 2, price: 35500 }
 */
function parseProduct(optionText: string | null | undefined): {
  productName: string | null;
  quantity: number | null;
  mail_quantity: number | null;
  agent_quantity: number | null;
  price: number | null;
} {
  if (!optionText) {
    return {
      productName: null,
      quantity: null,
      mail_quantity: null,
      agent_quantity: null,
      price: null,
    };
  }

  const [left, pricePart] = optionText.split(" = ₦");
  const price = pricePart ? parseInt(pricePart.replace(/[^0-9]/g, "")) : null;

  const quantityMatch = left.match(/^\s*(\d+)/);
  const quantity = quantityMatch ? parseInt(quantityMatch[1]) : null;

  let productName = left.replace(/^\s*\d+\s*/, "").trim();
  productName = productName.split("+")[0].trim();

  return {
    productName: productName || null,
    quantity: quantity,
    mail_quantity: quantity,
    agent_quantity: null,
    price: price,
  };
}

function buildLocation(
  deliveryAddress?: string,
  state?: string
): string | null {
  if (!deliveryAddress) return null;
  return state ? `${deliveryAddress}, ${state}` : deliveryAddress;
}

function buildCustomerName(
  firstName?: string,
  lastName?: string
): string {
  return `${firstName || ""} ${lastName || ""}`.trim() || "Unknown Customer";
}

type WebhookFormData = {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  whatsapp_number?: string;
  delivery_address?: string;
  state?: string;
  selected_package?: string;
  selected_items?: string;
};

/**
 * Create an abandoned cart record (org-scoped abandoned_carts table).
 */
export async function createAbandonedCart(
  data: {
    page_url: string;
    timestamp: string;
    filled_count: number;
    form_data: WebhookFormData;
  },
  organizationId: string
): Promise<void> {
  const formData = data.form_data;
  const p1 = parseProduct(formData.selected_package);
  const p2 = parseProduct(formData.selected_items);

  await persistAbandonedCart({
    organization_id: organizationId,
    customer_name: buildCustomerName(formData.first_name, formData.last_name),
    phone_number: formData.phone_number || formData.whatsapp_number || null,
    whatsapp_number: formData.whatsapp_number || null,
    delivery_address: formData.delivery_address || null,
    state: formData.state || null,
    location: buildLocation(formData.delivery_address, formData.state),
    selected_package: formData.selected_package || null,
    selected_items: formData.selected_items || null,
    product_name: p1.productName,
    mail_quan: p1.mail_quantity,
    agent_quan: p1.agent_quantity,
    quantity: p1.quantity,
    product2: p2.productName,
    mail_quan2: p2.mail_quantity,
    agent_quan2: p2.agent_quantity,
    quantity2: p2.quantity,
    sales_price: p1.price,
    page_url: data.page_url,
    filled_fields_count: data.filled_count,
    note: `Abandoned cart from ${data.page_url}. Filled ${data.filled_count} fields.`,
    abandoned_at: data.timestamp || new Date().toISOString(),
  });
}

/**
 * Create an order from a WordPress form submission via the normalized RPC.
 * Requires organization_id and form_id — use the create-order-from-form edge function for full payloads.
 */
export async function createOrderFromForm(
  data: {
    page_url: string;
    timestamp: string;
    form_data: WebhookFormData;
  },
  organizationId: string,
  formId: string
): Promise<void> {
  const formData = data.form_data;
  const p1 = parseProduct(formData.selected_package);
  const p2 = parseProduct(formData.selected_items);

  const fieldValues = {
    first_name: formData.first_name ?? null,
    last_name: formData.last_name ?? null,
    phone_number: formData.phone_number ?? formData.whatsapp_number ?? null,
    whatsapp_number: formData.whatsapp_number ?? null,
    delivery_address: formData.delivery_address ?? null,
    state: formData.state ?? null,
    page_url: data.page_url,
  };

  const rawPayload = {
    page_url: data.page_url,
    timestamp: data.timestamp,
    form_data: formData,
  };

  const { error } = await supabase.rpc("create_order_from_normalized_submission", {
    p_organization_id: organizationId,
    p_form_id: formId,
    p_source: "wordpress",
    p_page_url: data.page_url,
    p_field_values: fieldValues,
    p_items: [],
    p_raw_payload: rawPayload,
    p_normalized_payload: rawPayload,
    p_package: formData.selected_package ?? null,
    p_offer_name: p1.productName ?? p2.productName ?? null,
  });

  if (error) {
    console.error("Error creating order from form:", error);
    throw error;
  }
}
