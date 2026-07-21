import { FormResponseWithItems, FormResponseItem } from "../types/formResponse";
import { CustomerOrderWithRelations } from "../types/customerOrder";
import { getDisplayName } from "./userDisplay";
import { FormResponseFieldValues } from "./formResponseHelpers";
import { inferMoneyReceivedBy } from "../constants/orderAttribution";

export type AugmentedFormResponse = FormResponseWithItems & {
  _customerOrderId?: string;
  csr_name?: string | null;
  csr_email?: string | null;
};

/**
 * Map greenfield `customer_orders` row to the shape used by `FormResponseTable` / `FormResponseDialog`.
 */
export function customerOrderToFormResponse(
  o: CustomerOrderWithRelations
): AugmentedFormResponse {
  const frId = o.form_response_id || o.id;
  const items: FormResponseItem[] = (o.items || []).map((i) => ({
    id: i.id,
    form_response_id: o.form_response_id || o.id,
    product_id: i.product_id,
    quantity: i.quantity,
    unit_price_at_submission: i.unit_price_at_submission,
    unit_cost_at_submission: i.unit_cost_at_submission,
    total_price: i.total_price,
    total_cost: i.total_cost,
    profit: i.profit,
    created_at: i.created_at,
  }));
  return {
    id: o.id,
    form_response_id: o.form_response_id,
    organization_id: o.organization_id,
    form_id: o.form_id,
    response_type: "order",
    status: o.status,
    source: o.source === "form" ? "wordpress" : "manual",
    page_url: null,
    field_values: {} as FormResponseFieldValues,
    selected_products: items.map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
    })),
    phone_number: o.phone_number,
    package_name: o.items?.[0] && o.productNames
      ? o.productNames[o.items[0].product_id] || null
      : null,
    offer_name: o.offer_name,
    funnel_name: o.funnel_name ?? o.form?.name ?? null,
    sub_brand: o.sub_brand,
    money_received_by: inferMoneyReceivedBy(
      o.money_received_by,
      o.payment_method ?? undefined
    ),
    payment_method: o.payment_method ?? undefined,
    customer_name: o.customer_name,
    profit: o.profit ?? 0,
    order_revenue: o.order_revenue ?? 0,
    order_cost: o.order_cost ?? 0,
    amount_paid: o.amount_paid,
    delivery_fee: o.delivery_fee,
    notes: o.notes,
    agent_id: o.agent_id,
    csr_id: o.csr_id,
    created_at: o.created_at,
    updated_at: o.updated_at,
    completed_at: o.completed_at,
    converted_from_abandoned: o.source === "converted_from_cart",
    converted_response_id: null,
    items,
    form: o.form,
    _customerOrderId: o.id,
    csr_name: o.csr
      ? getDisplayName(
          { full_name: o.csr.full_name, email: o.csr.email },
          "Unnamed CSR"
        )
      : null,
    csr_email: o.csr?.email ?? null,
  };
}
