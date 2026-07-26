import { eq, inArray } from "drizzle-orm";
import { numbatrakCustomerOrderItems, numbatrakCustomerOrders, numbatrakForms, numbatrakProducts, type Database } from "@platform/db";
import type { NumbatrakOrder } from "@platform/shared-types";
import { attachRelations } from "../../numbatrak-orders/lib/orders.js";
import { findCartForOrg, markCartConverted } from "./abandoned-carts.js";

interface CartLine {
  product_id: string;
  quantity: number;
}

/** Mirrors the source app's parseCartSelectedProducts - tolerant of malformed rows. */
function parseSelectedProducts(raw: unknown): CartLine[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .filter((row): row is { product_id: string; quantity?: number } => {
      return !!row && typeof row === "object" && typeof (row as { product_id?: unknown }).product_id === "string";
    })
    .map((row) => ({ product_id: row.product_id, quantity: Math.max(1, Number(row.quantity) || 1) }));
}

/**
 * Converts an abandoned cart to a customer order, atomically on the server -
 * mirrors the source app's client-orchestrated two-step flow
 * (createCustomerOrderFromAbandonedCart + markAsConverted) but in one
 * transaction. Deliberately NOT reusing numbatrak-orders' createManualOrder:
 * that function requires >=1 line item and always auto-assigns a CSR via
 * round-robin, but the original conversion logic supports zero-item carts
 * (falling back to the cart's own stale sales_price/cost_price/profit
 * snapshot) and never auto-assigns a CSR - both preserved here.
 *
 * Pricing only resolves against current product base_price/cost_price (no
 * offer/variant/FIFO-lot resolution, unlike the unported webhook RPC) -
 * intentionally kept simple to match resolveCartLinePrices' existing scope.
 * A line whose product_id no longer resolves to a product is silently
 * dropped, same as the source app.
 */
export async function convertCartToOrder(db: Database, organizationId: string, cartId: string): Promise<NumbatrakOrder> {
  const cart = await findCartForOrg(db, organizationId, cartId);
  if (!cart) throw new Error("Abandoned cart not found");
  if (cart.convertedToOrder) throw new Error("This cart has already been converted to an order.");

  const lines = parseSelectedProducts(cart.selectedProducts);
  let pricedLines: Array<{ productId: string; quantity: number; unitPrice: number; unitCost: number }> = [];

  if (lines.length > 0) {
    const productIds = [...new Set(lines.map((l) => l.product_id))];
    const products = await db
      .select({ id: numbatrakProducts.id, basePrice: numbatrakProducts.basePrice, costPrice: numbatrakProducts.costPrice })
      .from(numbatrakProducts)
      .where(inArray(numbatrakProducts.id, productIds));
    const priceById = new Map(products.map((p) => [p.id, { price: Number(p.basePrice), cost: Number(p.costPrice) }]));

    pricedLines = lines
      .map((line) => {
        const prices = priceById.get(line.product_id);
        if (!prices) return null;
        return { productId: line.product_id, quantity: line.quantity, unitPrice: prices.price, unitCost: prices.cost };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }

  let linkedForm: { name: string; funnelName: string | null; subBrand: string | null } | null = null;
  if (cart.formId) {
    const [form] = await db
      .select({ name: numbatrakForms.name, funnelName: numbatrakForms.funnelName, subBrand: numbatrakForms.subBrand })
      .from(numbatrakForms)
      .where(eq(numbatrakForms.id, cart.formId))
      .limit(1);
    linkedForm = form ?? null;
  }

  const hasItems = pricedLines.length > 0;
  const orderRevenue = hasItems
    ? pricedLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
    : cart.salesPrice != null
      ? Number(cart.salesPrice)
      : 0;
  const orderCost = hasItems
    ? pricedLines.reduce((s, l) => s + l.unitCost * l.quantity, 0)
    : cart.costPrice != null
      ? Number(cart.costPrice)
      : 0;
  const deliveryFee = cart.deliveryFee != null ? Number(cart.deliveryFee) : 0;
  const profit = hasItems ? orderRevenue - orderCost - deliveryFee : cart.profit != null ? Number(cart.profit) : null;

  const [order] = await db
    .insert(numbatrakCustomerOrders)
    .values({
      organizationId,
      csrId: null,
      agentId: null,
      source: "converted_from_cart",
      formId: cart.formId,
      abandonedCartId: cart.id,
      status: "new",
      customerName: cart.customerName || "Unknown Customer",
      phoneNumber: cart.phoneNumber || cart.whatsappNumber || null,
      state: cart.state ?? null,
      deliveryAddress: cart.deliveryAddress ?? null,
      orderRevenue: String(orderRevenue),
      orderCost: String(orderCost),
      amountPaid: hasItems ? String(orderRevenue) : null,
      deliveryFee: String(deliveryFee),
      profit: profit != null ? String(profit) : null,
      notes: `Converted from abandoned cart #${cart.id}. Page: ${cart.pageUrl || "N/A"}`,
      funnelName: cart.funnelName ?? linkedForm?.funnelName ?? linkedForm?.name ?? null,
      offerName: cart.offerName ?? cart.selectedPackage ?? null,
      subBrand: cart.subBrand ?? linkedForm?.subBrand ?? null,
      moneyReceivedBy: "agent_collected",
    })
    .returning();
  if (!order) throw new Error("Failed to create order");

  if (hasItems) {
    await db.insert(numbatrakCustomerOrderItems).values(
      pricedLines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        quantity: l.quantity,
        unitPriceAtSubmission: String(l.unitPrice),
        unitCostAtSubmission: String(l.unitCost),
        totalPrice: String(l.unitPrice * l.quantity),
        totalCost: String(l.unitCost * l.quantity),
        profit: String((l.unitPrice - l.unitCost) * l.quantity),
      })),
    );
  }

  await markCartConverted(db, organizationId, cartId, order.id);

  const [full] = await attachRelations(db, [order]);
  return full!;
}
