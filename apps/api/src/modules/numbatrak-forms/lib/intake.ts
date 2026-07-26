import { eq, inArray } from "drizzle-orm";
import {
  numbatrakCustomerOrderItems,
  numbatrakCustomerOrders,
  numbatrakForms,
  numbatrakProducts,
  type Database,
} from "@platform/db";
import type { PublicFormLineItem, SubmitPublicNumbatrakFormResult } from "@platform/shared-types";
import { getNextAssignedUser } from "../../numbatrak-orders/lib/assignment.js";
import { createCart } from "../../numbatrak-abandoned-carts/lib/abandoned-carts.js";
import { validateSubmissionAgainstSchema } from "./validation.js";
import { resolveLinePricing } from "./offer-pricing.js";
import { consumeFifoLots } from "./inventory-consumption.js";

export type FormRow = typeof numbatrakForms.$inferSelect;

export async function findActiveFormByToken(db: Database, formToken: string): Promise<FormRow | null> {
  const [row] = await db.select().from(numbatrakForms).where(eq(numbatrakForms.formToken, formToken)).limit(1);
  return row ?? null;
}

interface ContactFields {
  customerName: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  state: string | null;
}

function deriveContactFields(fieldValues: Record<string, unknown>): ContactFields {
  const str = (v: unknown): string | null => (v != null && String(v).trim() !== "" ? String(v).trim() : null);
  const first = str(fieldValues.first_name) ?? str(fieldValues.customer_name) ?? str(fieldValues.name);
  const last = str(fieldValues.last_name) ?? str(fieldValues.surname);
  const customerName = first && last ? `${first} ${last}` : (first ?? last);
  const phone = str(fieldValues.phone) ?? str(fieldValues.customer_phone) ?? str(fieldValues.phone_number);
  const whatsapp = str(fieldValues.whatsapp) ?? str(fieldValues.whatsapp_number);
  const address = str(fieldValues.address) ?? str(fieldValues.delivery_address);
  const state = str(fieldValues.state) ?? str(fieldValues.region);
  return { customerName, phone, whatsapp, address, state };
}

export interface SubmitFormOrderInput {
  fieldValues: Record<string, unknown>;
  items: PublicFormLineItem[];
  source?: string | null;
  pageUrl?: string | null;
  offerName?: string | null;
  packageName?: string | null;
}

/**
 * Server-side port of the create-order-from-form Edge Function +
 * create_order_from_normalized_submission RPC (the final, authoritative
 * version - packages/db/src/schema/numbatrak's migration notes flag two
 * earlier redefinitions that omit CSR auto-assignment, a trap already
 * caught during this slice's research pass).
 *
 * Deliberate design fork vs. the source app: writes new orders directly
 * into numbatrak_customer_orders/numbatrak_customer_order_items, NOT
 * numbatrak_form_responses - matching the precedent every other ported
 * module already set (Orders' createManualOrder, Abandoned Carts'
 * convertCartToOrder both bypass form_responses entirely). Writing to
 * form_responses instead would mean new WordPress orders never show up in
 * the already-shipped Orders admin UI, which only ever queries
 * customer_orders. order_inventory_consumption (whose FK still points at
 * form_responses) is deliberately NOT written to here - it has zero readers
 * anywhere in the ported frontend or backend (verified during research),
 * so skipping its audit-trail rows costs nothing observable; the actual lot
 * quantity decrements (the part that matters for inventory accuracy) still
 * happen via consumeFifoLots.
 */
export async function submitFormOrder(
  db: Database,
  form: FormRow,
  input: SubmitFormOrderInput,
): Promise<SubmitPublicNumbatrakFormResult> {
  const contact = deriveContactFields(input.fieldValues);
  const hasContact = !!contact.customerName && (!!contact.phone || !!contact.whatsapp);

  if (hasContact && input.items.length === 0) {
    const cart = await createCart(db, form.organizationId, {
      customerName: contact.customerName,
      phoneNumber: contact.phone,
      whatsappNumber: contact.whatsapp,
      deliveryAddress: contact.address,
      state: contact.state,
      pageUrl: input.pageUrl ?? null,
      selectedPackage: input.packageName ?? null,
      formId: form.id,
      funnelName: form.funnelName ?? form.name,
      offerName: input.offerName ?? input.packageName ?? null,
      subBrand: form.subBrand ?? null,
    });
    return { success: true, kind: "abandoned_cart", id: cart.id, confirmation: null };
  }

  if (!contact.customerName) throw new Error("Customer name is required");
  if (!contact.phone && !contact.whatsapp) throw new Error("A phone or WhatsApp number is required");
  if (input.items.length === 0) throw new Error("At least one product is required");

  const schemaError = validateSubmissionAgainstSchema(form.schema as Record<string, unknown>, input.fieldValues);
  if (schemaError) throw new Error(schemaError);

  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await db
    .select({ id: numbatrakProducts.id, organizationId: numbatrakProducts.organizationId, active: numbatrakProducts.active })
    .from(numbatrakProducts)
    .where(inArray(numbatrakProducts.id, productIds));

  const productById = new Map(products.map((p) => [p.id, p]));
  for (const id of productIds) {
    const product = productById.get(id);
    if (!product) throw new Error(`Product ${id} not found`);
    if (product.organizationId !== form.organizationId) throw new Error(`Product ${id} does not belong to this form's organization`);
    if (!product.active) throw new Error(`Product ${id} is not active`);
  }

  const result = await db.transaction(async (tx) => {
    let orderRevenue = 0;
    let orderCost = 0;
    const lineRows: Array<{
      productId: string;
      quantity: number;
      unitPriceAtSubmission: string;
      unitCostAtSubmission: string;
      totalPrice: string;
      totalCost: string;
      profit: string;
    }> = [];

    for (const item of input.items) {
      const pricing = await resolveLinePricing(
        tx,
        form.organizationId,
        item.productId,
        item.quantity,
        item.variantId ?? null,
        item.offerId ?? null,
      );

      const consumption = await consumeFifoLots(
        tx,
        form.organizationId,
        item.productId,
        pricing.variantId,
        pricing.trueUnitCount,
      );
      const lineTotalCost = consumption ? consumption.totalCost : pricing.unitCost * pricing.trueUnitCount;
      const unitCostAvg = pricing.trueUnitCount > 0 ? lineTotalCost / pricing.trueUnitCount : pricing.unitCost;
      const lineTotalPrice = pricing.unitPrice * pricing.quantityPaid;

      orderRevenue += lineTotalPrice;
      orderCost += lineTotalCost;

      lineRows.push({
        productId: item.productId,
        quantity: pricing.quantityPaid,
        unitPriceAtSubmission: String(pricing.unitPrice),
        unitCostAtSubmission: String(unitCostAvg),
        totalPrice: String(lineTotalPrice),
        totalCost: String(lineTotalCost),
        profit: String(lineTotalPrice - lineTotalCost),
      });
    }

    const csrId = await getNextAssignedUser(tx, form.organizationId);
    const profit = orderRevenue - orderCost;

    const [order] = await tx
      .insert(numbatrakCustomerOrders)
      .values({
        organizationId: form.organizationId,
        csrId,
        source: "form",
        formId: form.id,
        status: "new",
        customerName: contact.customerName,
        phoneNumber: contact.phone ?? contact.whatsapp,
        state: contact.state,
        deliveryAddress: contact.address,
        orderRevenue: String(orderRevenue),
        orderCost: String(orderCost),
        amountPaid: String(orderRevenue),
        deliveryFee: "0",
        profit: String(profit),
        funnelName: form.funnelName ?? form.name,
        offerName: input.offerName ?? input.packageName ?? null,
        subBrand: form.subBrand ?? null,
      })
      .returning();
    if (!order) throw new Error("Failed to create order");

    await tx.insert(numbatrakCustomerOrderItems).values(lineRows.map((line) => ({ ...line, orderId: order.id })));

    return { order, orderRevenue, orderCost, profit };
  });

  return {
    success: true,
    kind: "order",
    id: result.order.id,
    confirmation: (form.schema as { confirmation?: SubmitPublicNumbatrakFormResult["confirmation"] })?.confirmation ?? {
      type: "message",
      message: "Thank you for your order. We'll be in touch soon.",
    },
    totals: { orderRevenue: result.orderRevenue, orderCost: result.orderCost, orderProfit: result.profit },
  };
}
