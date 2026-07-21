"use client";

import { supabase } from "../supabaseClient";
import {
  Product,
  ProductPerformance,
  ProductPrice,
  ProductWithDetails,
  ProductWithPrices,
} from "../types/product";
import { fetchOffersForProducts } from "./productOffers";
import { fetchInventoryLotsSummaryByProduct } from "./inventoryLots";
import { fetchVariantsForProducts } from "./productVariants";
import { emptyWithoutOrg } from "./orgQuery";

function mapProductRow(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    name: (row.name as string) ?? "Unknown",
    sku: (row.sku as string | null) ?? null,
    type: (row.type as Product["type"]) ?? "NORMAL",
    base_price: row.base_price != null ? Number(row.base_price) : undefined,
    cost_price: row.cost_price != null ? Number(row.cost_price) : undefined,
    active: row.active !== false,
    low_stock_threshold:
      row.low_stock_threshold != null
        ? Number(row.low_stock_threshold)
        : null,
    category: (row.category as string | null) ?? null,
    sub_brand: (row.sub_brand as string | null) ?? null,
    allows_variants: row.allows_variants === true,
    allows_bundles: row.allows_bundles === true,
    allows_discounts: row.allows_discounts === true,
    created_at: (row.created_at as string) ?? null,
    updated_at: (row.updated_at as string) ?? null,
  };
}

/**
 * Read all products from the database (filtered by organization)
 */
export async function fetchProducts(
  organizationId: string | null,
  options?: { activeOnly?: boolean }
): Promise<Product[]> {
  const empty = emptyWithoutOrg<Product>(organizationId);
  if (empty) return empty;

  let query = supabase
    .from("products")
    .select("*")
    .eq("organization_id", organizationId);

  if (options?.activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!data) {
    return [];
  }

  return data.map((row: Record<string, unknown>) => mapProductRow(row));
}

/**
 * Read all products with their price history (filtered by organization)
 */
export async function fetchProductsWithPrices(
  organizationId: string | null
): Promise<ProductWithPrices[]> {
  return fetchProductsWithDetails(organizationId);
}

export async function fetchProductsWithDetails(
  organizationId: string | null
): Promise<ProductWithDetails[]> {
  const empty = emptyWithoutOrg<ProductWithDetails>(organizationId);
  if (empty) return empty;

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!products || products.length === 0) return [];

  const productIds = products.map((p: { id: string }) => p.id);

  const [pricesMap, offersMap, variantsMap, stockMap, performanceMap] =
    await Promise.all([
      fetchLegacyPricesMap(productIds),
      fetchOffersForProducts(organizationId, productIds),
      fetchVariantsForProducts(organizationId, productIds),
      fetchInventoryLotsSummaryByProduct(organizationId, productIds),
      fetchProductPerformance(organizationId, productIds),
    ]);

  return products.map((row: Record<string, unknown>) => {
    const mapped = mapProductRow(row);
    const id = mapped.id;
    return {
      ...mapped,
      base_price: mapped.base_price ?? 0,
      cost_price: mapped.cost_price ?? 0,
      prices: pricesMap.get(id) ?? [],
      offers: offersMap[id] ?? [],
      variants: variantsMap[id] ?? [],
      stock_on_hand: stockMap[id]?.quantity ?? 0,
      performance: performanceMap[id],
    };
  });
}

async function fetchLegacyPricesMap(
  productIds: string[]
): Promise<Map<string, ProductPrice[]>> {
  const pricesMap = new Map<string, ProductPrice[]>();
  if (productIds.length === 0) return pricesMap;

  const pricesQuery = await supabase
    .from("product_prices")
    .select("id, product_id, date, quantity, offer, sales_price, unit_cost, created_at")
    .in("product_id", productIds)
    .order("date", { ascending: false });

  let rows: Record<string, unknown>[] = [];

  if (pricesQuery.error) {
    const historyQuery = await supabase
      .from("product_price_history")
      .select("id, product_id, starts_at, price, cost_price, created_at")
      .in("product_id", productIds)
      .order("starts_at", { ascending: false });

    if (!historyQuery.error && historyQuery.data) {
      rows = historyQuery.data.map((row: Record<string, unknown>) => ({
        id: row.id,
        product_id: row.product_id,
        date: row.starts_at,
        quantity: 1,
        offer: 0,
        sales_price: row.price,
        unit_cost: row.cost_price,
        created_at: row.created_at,
      }));
    }
  } else {
    rows = (pricesQuery.data ?? []) as Record<string, unknown>[];
  }

  for (const price of rows) {
    const productId = String(price.product_id);
    if (!pricesMap.has(productId)) pricesMap.set(productId, []);
    pricesMap.get(productId)!.push({
      id: price.id as string | number,
      product_id: productId,
      date: String(price.date ?? price.starts_at ?? ""),
      quantity: Number(price.quantity ?? 1),
      offer: Number(price.offer ?? 0),
      sales_price: Number(price.sales_price ?? price.price ?? 0),
      unit_cost: Number(price.unit_cost ?? price.cost_price ?? 0),
      created_at: (price.created_at as string) ?? null,
    });
  }

  return pricesMap;
}

export async function fetchProductPerformance(
  organizationId: string | null,
  productIds?: string[]
): Promise<Record<string, ProductPerformance>> {
  const result: Record<string, ProductPerformance> = {};
  if (!organizationId) return result;

  const { data: formItems, error: formError } = await supabase
    .from("form_response_items")
    .select(
      "product_id, quantity_paid, quantity, true_unit_count, total_price, profit, form_responses!inner(organization_id, response_type, submission_status)"
    )
    .eq("form_responses.organization_id", organizationId)
    .eq("form_responses.response_type", "order");

  if (formError) {
    console.warn("fetchProductPerformance form_response_items:", formError);
  } else {
    for (const row of formItems ?? []) {
      const pid = row.product_id as string;
      if (productIds && !productIds.includes(pid)) continue;
      if (!result[pid]) {
        result[pid] = { units_sold: 0, revenue: 0, margin: 0 };
      }
      const units =
        Number(row.true_unit_count) ||
        Number(row.quantity_paid) ||
        Number(row.quantity) ||
        0;
      result[pid].units_sold += units;
      result[pid].revenue += Number(row.total_price ?? 0);
      result[pid].margin += Number(row.profit ?? 0);
    }
  }

  const { data: orderItems, error: orderError } = await supabase
    .from("customer_order_items")
    .select(
      "product_id, quantity_paid, quantity, true_unit_count, total_price, profit, customer_orders!inner(organization_id)"
    )
    .eq("customer_orders.organization_id", organizationId);

  if (orderError) {
    console.warn("fetchProductPerformance customer_order_items:", orderError);
  } else {
    for (const row of orderItems ?? []) {
      const pid = row.product_id as string;
      if (productIds && !productIds.includes(pid)) continue;
      if (!result[pid]) {
        result[pid] = { units_sold: 0, revenue: 0, margin: 0 };
      }
      const units =
        Number(row.true_unit_count) ||
        Number(row.quantity_paid) ||
        Number(row.quantity) ||
        0;
      result[pid].units_sold += units;
      result[pid].revenue += Number(row.total_price ?? 0);
      result[pid].margin += Number(row.profit ?? 0);
    }
  }

  return result;
}

/**
 * Fetch price history for a specific product
 */
export async function fetchProductPrices(
  productId: number | string
): Promise<ProductPrice[]> {
  // Prefer product_price_history (FIFO-compatible; products use UUID)
  const historyResult = await supabase
    .from("product_price_history")
    .select("*")
    .eq("product_id", productId)
    .order("starts_at", { ascending: false });

  if (!historyResult.error && historyResult.data && historyResult.data.length > 0) {
    return historyResult.data.map((row: any) => ({
      id: row.id,
      product_id: row.product_id,
      date: row.starts_at,
      quantity: 1,
      offer: 0,
      sales_price: Number(row.price),
      unit_cost: Number(row.cost_price),
      created_at: row.created_at ?? null,
    }));
  }

  // Fallback: legacy product_prices (numeric product_id)
  const pricesResult = await supabase
    .from("product_prices")
    .select("*")
    .eq("product_id", productId)
    .order("date", { ascending: false })
    .order("quantity", { ascending: true });

  if (pricesResult.error || !pricesResult.data || pricesResult.data.length === 0) {
    return [];
  }

  return pricesResult.data.map((row: any) => ({
    id: Number(row.id),
    product_id: Number(row.product_id),
    date: row.date,
    quantity: Number(row.quantity || 1),
    offer: Number(row.offer || 0),
    sales_price: Number(row.sales_price),
    unit_cost: Number(row.unit_cost),
    created_at: row.created_at ?? null,
  }));
}

/**
 * Insert a new product into the database
 */
export async function createProduct(input: {
  name: string;
  organization_id: string;
  base_price: number;
  cost_price: number;
  type?: "NORMAL" | "INCENTIVE";
  sku?: string | null;
  category?: string | null;
  sub_brand?: string | null;
  low_stock_threshold?: number | null;
  allows_variants?: boolean;
  allows_bundles?: boolean;
  allows_discounts?: boolean;
}): Promise<Product> {
  // Validate required prices
  if (input.base_price === undefined || input.base_price === null || isNaN(input.base_price)) {
    throw new Error("base_price is required and must be a valid number");
  }
  if (input.cost_price === undefined || input.cost_price === null || isNaN(input.cost_price)) {
    throw new Error("cost_price is required and must be a valid number");
  }
  
  if (input.base_price < 0) {
    throw new Error("base_price cannot be negative");
  }
  if (input.cost_price < 0) {
    throw new Error("cost_price cannot be negative");
  }

  const basePrice = input.base_price;
  const costPrice = input.cost_price;
  const productType = input.type ?? 'NORMAL';

  const { data, error } = await supabase
    .from("products")
    .insert([
      {
        name: input.name,
        organization_id: input.organization_id,
        base_price: basePrice,
        cost_price: costPrice,
        type: productType,
        sku: input.sku ?? null,
        category: input.category ?? null,
        sub_brand: input.sub_brand ?? null,
        low_stock_threshold: input.low_stock_threshold ?? null,
        allows_variants: input.allows_variants ?? false,
        allows_bundles: input.allows_bundles ?? false,
        allows_discounts: input.allows_discounts ?? false,
        active: true,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("No data returned from insert");
  return mapProductRow(data);
}

/**
 * Update an existing product in the database.
 * When base_price or cost_price change, ends current product_price_history period and inserts new row (FIFO-compatible).
 */
export async function updateProduct(
  productId: string | number,
  input: {
    name?: string;
    base_price?: number;
    cost_price?: number;
    type?: "NORMAL" | "INCENTIVE";
    sku?: string | null;
    active?: boolean;
    category?: string | null;
    sub_brand?: string | null;
    low_stock_threshold?: number | null;
    allows_variants?: boolean;
    allows_bundles?: boolean;
    allows_discounts?: boolean;
  }
): Promise<Product> {
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.base_price !== undefined) updateData.base_price = input.base_price;
  if (input.cost_price !== undefined) updateData.cost_price = input.cost_price;
  if (input.type !== undefined) updateData.type = input.type;
  if (input.sku !== undefined) updateData.sku = input.sku;
  if (input.active !== undefined) updateData.active = input.active;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.sub_brand !== undefined) updateData.sub_brand = input.sub_brand;
  if (input.low_stock_threshold !== undefined)
    updateData.low_stock_threshold = input.low_stock_threshold;
  if (input.allows_variants !== undefined)
    updateData.allows_variants = input.allows_variants;
  if (input.allows_bundles !== undefined)
    updateData.allows_bundles = input.allows_bundles;
  if (input.allows_discounts !== undefined)
    updateData.allows_discounts = input.allows_discounts;
  updateData.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("products")
    .update(updateData)
    .eq("id", productId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("No data returned from update");
  }

  // When price/cost change, record in product_price_history so RPC and FIFO see current price
  if (input.base_price !== undefined || input.cost_price !== undefined) {
    const price = input.base_price !== undefined ? input.base_price : Number(data.base_price);
    const costPrice = input.cost_price !== undefined ? input.cost_price : Number(data.cost_price);
    await supabase
      .from("product_price_history")
      .update({ ends_at: new Date().toISOString() })
      .eq("product_id", productId)
      .is("ends_at", null);
    await supabase
      .from("product_price_history")
      .insert([
        {
          product_id: productId,
          price,
          cost_price: costPrice,
          starts_at: new Date().toISOString(),
          ends_at: null,
        },
      ]);
  }

  return mapProductRow(data);
}

/**
 * Activate or deactivate a product without deleting history.
 */
export async function setProductActive(
  productId: string | number,
  active: boolean
): Promise<Product> {
  return updateProduct(productId, { active });
}

/**
 * Delete a product from the database (cascade will delete prices)
 */
export async function removeProduct(productId: string | number): Promise<void> {
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId);
  if (error) {
    throw error;
  }
}

/**
 * Add a price entry for a product.
 * Writes to product_price_history (FIFO-compatible): ends current price period and inserts new row.
 * Also updates products.base_price and products.cost_price so product reflects current price.
 */
export async function createProductPrice(input: {
  product_id: number | string;
  date: string; // ISO date string → used as starts_at
  quantity?: number;
  offer?: number;
  sales_price: number;
  unit_cost: number;
}): Promise<ProductPrice> {
  const productId = input.product_id;
  const price = Number(input.sales_price);
  const costPrice = Number(input.unit_cost);
  const startsAt = input.date ? new Date(input.date).toISOString() : new Date().toISOString();

  // End current price period in product_price_history (if any)
  await supabase
    .from("product_price_history")
    .update({ ends_at: new Date().toISOString() })
    .eq("product_id", productId)
    .is("ends_at", null);

  const { data, error } = await supabase
    .from("product_price_history")
    .insert([
      {
        product_id: productId,
        price,
        cost_price: costPrice,
        starts_at: startsAt,
        ends_at: null,
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

  // Keep product row in sync (current selling price and fallback cost)
  await supabase
    .from("products")
    .update({ base_price: price, cost_price: costPrice, updated_at: new Date().toISOString() })
    .eq("id", productId);

  return {
    id: data.id as string,
    product_id: productId,
    date: data.starts_at,
    quantity: input.quantity ?? 1,
    offer: input.offer ?? 0,
    sales_price: price,
    unit_cost: costPrice,
    created_at: data.created_at ?? null,
  };
}

/**
 * Update a price entry
 */
export async function updateProductPrice(
  priceId: number,
  input: {
    date?: string;
    quantity?: number;
    offer?: number;
    sales_price?: number;
    unit_cost?: number;
  }
): Promise<ProductPrice> {
  const updateData: any = {};
  if (input.date !== undefined) updateData.date = input.date;
  if (input.quantity !== undefined) updateData.quantity = input.quantity;
  if (input.offer !== undefined) updateData.offer = input.offer;
  if (input.sales_price !== undefined)
    updateData.sales_price = input.sales_price;
  if (input.unit_cost !== undefined) updateData.unit_cost = input.unit_cost;

  const { data, error } = await supabase
    .from("product_prices")
    .update(updateData)
    .eq("id", priceId)
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
    product_id: Number(data.product_id),
    date: data.date,
    quantity: Number(data.quantity),
    offer: Number(data.offer || 0),
    sales_price: Number(data.sales_price),
    unit_cost: Number(data.unit_cost),
    created_at: data.created_at ?? null,
  };
}

/**
 * Delete a price entry (supports product_prices id number or product_price_history id UUID)
 */
export async function removeProductPrice(priceId: number | string): Promise<void> {
  // Try product_price_history first (UUID)
  const { error: historyError } = await supabase
    .from("product_price_history")
    .delete()
    .eq("id", priceId);
  if (!historyError) return;
  // If not found or table doesn't exist, try legacy product_prices
  const { error } = await supabase
    .from("product_prices")
    .delete()
    .eq("id", priceId);
  if (error) {
    throw error;
  }
}

/**
 * Get the current price for a product by name, date, and quantity
 * Returns the most recent price entry that matches the criteria
 */
export async function getProductPriceByName(
  productName: string,
  organizationId: string | null,
  orderDate: string,
  quantity: number = 1
): Promise<{ unit_cost: number; sales_price: number; offer: number } | null> {
  if (!productName || !organizationId) {
    return null;
  }

  // First, find the product by name
  let productQuery = supabase
    .from("products")
    .select("id")
    .eq("name", productName)
    .eq("organization_id", organizationId)
    .limit(1);

  const { data: productData, error: productError } = await productQuery;

  if (productError || !productData || productData.length === 0) {
    return null;
  }

  const productId = productData[0].id;

  // Get prices for this product, ordered by date (most recent first) and quantity
  const { data: pricesData, error: pricesError } = await supabase
    .from("product_prices")
    .select("*")
    .eq("product_id", productId)
    .lte("date", orderDate) // Price must be valid on or before order date
    .order("date", { ascending: false })
    .order("quantity", { ascending: true });

  if (pricesError || !pricesData || pricesData.length === 0) {
    return null;
  }

  // Find the best matching price based on quantity
  // First, try to find exact quantity match, then closest lower quantity
  let bestPrice = pricesData.find((p) => p.quantity === quantity);
  
  if (!bestPrice) {
    // Find the highest quantity that's <= the requested quantity
    const matchingPrices = pricesData.filter((p) => p.quantity <= quantity);
    if (matchingPrices.length > 0) {
      bestPrice = matchingPrices.reduce((prev, curr) =>
        curr.quantity > prev.quantity ? curr : prev
      );
    } else {
      // If no price with quantity <= requested, use the lowest quantity price
      bestPrice = pricesData.reduce((prev, curr) =>
        curr.quantity < prev.quantity ? curr : prev
      );
    }
  }

  if (!bestPrice) {
    return null;
  }

  return {
    unit_cost: Number(bestPrice.unit_cost),
    sales_price: Number(bestPrice.sales_price),
    offer: Number(bestPrice.offer || 0),
  };
}










