import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  numbatrakCustomerOrderItems,
  numbatrakCustomerOrders,
  numbatrakInventoryLots,
  numbatrakProductOffers,
  numbatrakProductPriceHistory,
  numbatrakProductVariants,
  numbatrakProducts,
  products,
  type Database,
} from "@platform/db";
import type {
  CreateNumbatrakProductRequest,
  NumbatrakProduct,
  NumbatrakProductOffer,
  NumbatrakProductVariant,
  NumbatrakProductWithDetails,
  UpdateNumbatrakProductRequest,
} from "@platform/shared-types";

export type NumbatrakProductRow = typeof numbatrakProducts.$inferSelect;
export type NumbatrakProductVariantRow = typeof numbatrakProductVariants.$inferSelect;
export type NumbatrakProductOfferRow = typeof numbatrakProductOffers.$inferSelect;

export function serializeNumbatrakProduct(row: NumbatrakProductRow): NumbatrakProduct {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    active: row.active,
    basePrice: row.basePrice,
    costPrice: row.costPrice,
    imageUrl: row.imageUrl,
  };
}

export function serializeVariant(row: NumbatrakProductVariantRow): NumbatrakProductVariant {
  return {
    id: row.id,
    organizationId: row.organizationId,
    productId: row.productId,
    name: row.name,
    sku: row.sku,
    basePrice: row.basePrice,
    costPrice: row.costPrice,
    active: row.active,
    displayOrder: row.displayOrder,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export function serializeOffer(row: NumbatrakProductOfferRow): NumbatrakProductOffer {
  return {
    id: row.id,
    organizationId: row.organizationId,
    productId: row.productId,
    variantId: row.variantId,
    offerType: row.offerType,
    label: row.label,
    minQuantity: row.minQuantity,
    freeQuantity: row.freeQuantity,
    bundleItems: (row.bundleItems as NumbatrakProductOffer["bundleItems"]) ?? null,
    price: row.price,
    unitCost: row.unitCost,
    active: row.active,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    displayOrder: row.displayOrder,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export async function listNumbatrakProductsForOrg(
  db: Database,
  organizationId: string,
): Promise<NumbatrakProductRow[]> {
  return db
    .select()
    .from(numbatrakProducts)
    .where(eq(numbatrakProducts.organizationId, organizationId))
    .orderBy(asc(numbatrakProducts.name));
}

/**
 * Units sold / revenue / margin per product. Source app unions
 * form_response_items with customer_order_items - Forms isn't ported yet, so
 * only manual/CRS orders show up here until the Forms slice ships;
 * acceptable partial functionality, not a bug.
 */
async function fetchPerformanceByProduct(
  db: Database,
  organizationId: string,
  productIds: string[],
): Promise<Record<string, { unitsSold: number; revenue: number; margin: number }>> {
  const result: Record<string, { unitsSold: number; revenue: number; margin: number }> = {};
  if (productIds.length === 0) return result;

  const rows = await db
    .select({
      productId: numbatrakCustomerOrderItems.productId,
      quantity: numbatrakCustomerOrderItems.quantity,
      totalPrice: numbatrakCustomerOrderItems.totalPrice,
      profit: numbatrakCustomerOrderItems.profit,
    })
    .from(numbatrakCustomerOrderItems)
    .innerJoin(numbatrakCustomerOrders, eq(numbatrakCustomerOrders.id, numbatrakCustomerOrderItems.orderId))
    .where(
      and(
        eq(numbatrakCustomerOrders.organizationId, organizationId),
        inArray(numbatrakCustomerOrderItems.productId, productIds),
      ),
    );

  for (const row of rows) {
    const bucket = result[row.productId] ?? { unitsSold: 0, revenue: 0, margin: 0 };
    bucket.unitsSold += row.quantity;
    bucket.revenue += Number(row.totalPrice);
    bucket.margin += Number(row.profit);
    result[row.productId] = bucket;
  }
  return result;
}

export async function listNumbatrakProductsWithDetailsForOrg(
  db: Database,
  organizationId: string,
): Promise<NumbatrakProductWithDetails[]> {
  const products = await listNumbatrakProductsForOrg(db, organizationId);
  if (products.length === 0) return [];
  const productIds = products.map((p) => p.id);

  const [variants, offers, lots, performance] = await Promise.all([
    db
      .select()
      .from(numbatrakProductVariants)
      .where(
        and(eq(numbatrakProductVariants.organizationId, organizationId), inArray(numbatrakProductVariants.productId, productIds)),
      )
      .orderBy(asc(numbatrakProductVariants.displayOrder)),
    db
      .select()
      .from(numbatrakProductOffers)
      .where(
        and(eq(numbatrakProductOffers.organizationId, organizationId), inArray(numbatrakProductOffers.productId, productIds)),
      )
      .orderBy(asc(numbatrakProductOffers.displayOrder)),
    db
      .select({ productId: numbatrakInventoryLots.productId, quantityRemaining: numbatrakInventoryLots.quantityRemaining })
      .from(numbatrakInventoryLots)
      .where(
        and(eq(numbatrakInventoryLots.organizationId, organizationId), inArray(numbatrakInventoryLots.productId, productIds)),
      ),
    fetchPerformanceByProduct(db, organizationId, productIds),
  ]);

  const variantsByProduct = new Map<string, NumbatrakProductVariant[]>();
  for (const v of variants) {
    const list = variantsByProduct.get(v.productId) ?? [];
    list.push(serializeVariant(v));
    variantsByProduct.set(v.productId, list);
  }

  const offersByProduct = new Map<string, NumbatrakProductOffer[]>();
  for (const o of offers) {
    const list = offersByProduct.get(o.productId) ?? [];
    list.push(serializeOffer(o));
    offersByProduct.set(o.productId, list);
  }

  const stockByProduct = new Map<string, number>();
  for (const lot of lots) {
    stockByProduct.set(lot.productId, (stockByProduct.get(lot.productId) ?? 0) + lot.quantityRemaining);
  }

  return products.map((row) => ({
    ...serializeNumbatrakProduct(row),
    type: row.type,
    category: row.category,
    subBrand: row.subBrand,
    lowStockThreshold: row.lowStockThreshold,
    allowsVariants: row.allowsVariants,
    allowsBundles: row.allowsBundles,
    allowsDiscounts: row.allowsDiscounts,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    variants: variantsByProduct.get(row.id) ?? [],
    offers: offersByProduct.get(row.id) ?? [],
    stockOnHand: stockByProduct.get(row.id) ?? 0,
    performance: performance[row.id] ?? null,
  }));
}

/**
 * Numbatrak is the source of truth for product data; the storefront's own
 * `products` row is just a read-side mirror kept in sync on every
 * create/update so it can render on the public site (name/price/image/
 * published-state), matched by the unique `numbatrakProductId` column.
 */
async function syncMirroredStorefrontProduct(
  db: Database,
  organizationId: string,
  numbatrakProduct: NumbatrakProductRow,
): Promise<void> {
  const priceCents = Math.round(Number(numbatrakProduct.basePrice) * 100);
  await db
    .insert(products)
    .values({
      tenantId: organizationId,
      numbatrakProductId: numbatrakProduct.id,
      name: numbatrakProduct.name,
      priceCents,
      currency: "NGN",
      imageUrl: numbatrakProduct.imageUrl,
      status: numbatrakProduct.active ? "published" : "draft",
    })
    .onConflictDoUpdate({
      target: products.numbatrakProductId,
      set: {
        name: numbatrakProduct.name,
        priceCents,
        imageUrl: numbatrakProduct.imageUrl,
        status: numbatrakProduct.active ? "published" : "draft",
        updatedAt: new Date(),
      },
    });
}

export async function createNumbatrakProduct(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakProductRequest,
): Promise<NumbatrakProductRow> {
  const [row] = await db
    .insert(numbatrakProducts)
    .values({
      organizationId,
      name: input.name,
      basePrice: String(input.basePrice),
      costPrice: String(input.costPrice),
      type: input.type ?? "NORMAL",
      sku: input.sku ?? null,
      category: input.category ?? null,
      subBrand: input.subBrand ?? null,
      lowStockThreshold: input.lowStockThreshold ?? null,
      allowsVariants: input.allowsVariants ?? false,
      allowsBundles: input.allowsBundles ?? false,
      allowsDiscounts: input.allowsDiscounts ?? false,
      imageUrl: input.imageUrl ?? null,
    })
    .returning();
  if (!row) throw new Error("Failed to create product");
  await syncMirroredStorefrontProduct(db, organizationId, row);
  return row;
}

/**
 * Updating base_price/cost_price closes the currently-open
 * product_price_history row and opens a new one - preserved even though
 * nothing ported yet reads price_history, since the (unported) webhook
 * order-intake RPC depends on it for "current price" once Forms ships.
 */
export async function updateNumbatrakProduct(
  db: Database,
  organizationId: string,
  productId: string,
  input: UpdateNumbatrakProductRequest,
): Promise<NumbatrakProductRow | null> {
  const values: Partial<typeof numbatrakProducts.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) values.name = input.name;
  if (input.basePrice !== undefined) values.basePrice = String(input.basePrice);
  if (input.costPrice !== undefined) values.costPrice = String(input.costPrice);
  if (input.type !== undefined) values.type = input.type;
  if (input.sku !== undefined) values.sku = input.sku;
  if (input.active !== undefined) values.active = input.active;
  if (input.category !== undefined) values.category = input.category;
  if (input.subBrand !== undefined) values.subBrand = input.subBrand;
  if (input.lowStockThreshold !== undefined) values.lowStockThreshold = input.lowStockThreshold;
  if (input.allowsVariants !== undefined) values.allowsVariants = input.allowsVariants;
  if (input.allowsBundles !== undefined) values.allowsBundles = input.allowsBundles;
  if (input.allowsDiscounts !== undefined) values.allowsDiscounts = input.allowsDiscounts;
  if (input.imageUrl !== undefined) values.imageUrl = input.imageUrl;

  const [row] = await db
    .update(numbatrakProducts)
    .set(values)
    .where(and(eq(numbatrakProducts.organizationId, organizationId), eq(numbatrakProducts.id, productId)))
    .returning();
  if (!row) return null;
  await syncMirroredStorefrontProduct(db, organizationId, row);

  if (input.basePrice !== undefined || input.costPrice !== undefined) {
    const price = input.basePrice !== undefined ? input.basePrice : Number(row.basePrice);
    const costPrice = input.costPrice !== undefined ? input.costPrice : Number(row.costPrice);
    const now = new Date();
    await db
      .update(numbatrakProductPriceHistory)
      .set({ endsAt: now })
      .where(and(eq(numbatrakProductPriceHistory.productId, productId), sql`${numbatrakProductPriceHistory.endsAt} IS NULL`));
    await db.insert(numbatrakProductPriceHistory).values({
      productId,
      price: String(price),
      costPrice: String(costPrice),
      startsAt: now,
      endsAt: null,
    });
  }

  return row;
}

export async function removeNumbatrakProduct(db: Database, organizationId: string, productId: string): Promise<boolean> {
  try {
    // Hide the mirrored storefront listing first - deleting the numbatrak row
    // nulls products.numbatrakProductId via FK (onDelete: set null), which would
    // otherwise leave an orphaned row stuck published on the public site.
    await db
      .update(products)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(products.numbatrakProductId, productId));

    const result = await db
      .delete(numbatrakProducts)
      .where(and(eq(numbatrakProducts.organizationId, organizationId), eq(numbatrakProducts.id, productId)))
      .returning({ id: numbatrakProducts.id });
    return result.length > 0;
  } catch (err) {
    // inventory_lots/product_variants/product_offers -> products.id are ON
    // DELETE RESTRICT/CASCADE by FK (a product with received stock can't be
    // deleted outright) - surface this as a clear message instead of a raw
    // Postgres FK-violation 500. Drizzle wraps the real postgres-js error
    // (whose message names the violated constraint) in `.cause`.
    const pgMessage = (err as { cause?: { message?: string } } | undefined)?.cause?.message ?? "";
    if (pgMessage.includes("violates") && pgMessage.includes("foreign key constraint")) {
      throw new Error("Can't delete a product with existing inventory lots or order history. Deactivate it instead.");
    }
    throw err;
  }
}
