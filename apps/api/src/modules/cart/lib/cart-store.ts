import { and, eq } from "drizzle-orm";
import { carts, cartItems, products, type Database } from "@platform/db";
import type { Cart, CartItem } from "@platform/shared-types";
import { generateOpaqueToken, sha256Hex } from "../../auth/lib/tokens.js";

export type CartRow = typeof carts.$inferSelect;

export async function createCart(
  db: Database,
  tenantId: string,
): Promise<{ cart: CartRow; token: string }> {
  const token = generateOpaqueToken();
  const [cart] = await db
    .insert(carts)
    .values({ tenantId, cartToken: sha256Hex(token) })
    .returning();
  if (!cart) {
    throw new Error("Failed to create cart");
  }
  return { cart, token };
}

export async function findCartByToken(
  db: Database,
  tenantId: string,
  token: string,
): Promise<CartRow | null> {
  const [row] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.tenantId, tenantId), eq(carts.cartToken, sha256Hex(token))))
    .limit(1);
  return row ?? null;
}

export interface CartItemWithProductRow {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPriceSnapshotCents: number;
  currency: string;
  status: "draft" | "published";
}

async function getCartItemsWithProduct(
  db: Database,
  cartId: string,
): Promise<CartItemWithProductRow[]> {
  return db
    .select({
      id: cartItems.id,
      productId: cartItems.productId,
      name: products.name,
      quantity: cartItems.quantity,
      unitPriceSnapshotCents: cartItems.unitPriceSnapshotCents,
      currency: products.currency,
      status: products.status,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(eq(cartItems.cartId, cartId));
}

/**
 * Pure total-calculation step, split out from the DB fetch so the money math
 * (line totals, subtotal, single-currency assumption) is unit-testable
 * without a database.
 */
export function buildCartSummary(cartId: string, rows: CartItemWithProductRow[]): Cart {
  const items: CartItem[] = rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    name: row.name,
    quantity: row.quantity,
    unitPriceSnapshotCents: row.unitPriceSnapshotCents,
    lineTotalCents: row.quantity * row.unitPriceSnapshotCents,
  }));
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const currency = rows[0]?.currency ?? null;
  return { id: cartId, items, subtotalCents, currency };
}

export async function serializeCart(db: Database, cart: CartRow): Promise<Cart> {
  const rows = await getCartItemsWithProduct(db, cart.id);
  return buildCartSummary(cart.id, rows);
}

/** Cart lines whose product is no longer published - checkout must block on these. */
export async function findUnpublishedCartItems(db: Database, cartId: string) {
  const rows = await getCartItemsWithProduct(db, cartId);
  return rows.filter((row) => row.status !== "published");
}

export type AddItemFailureReason = "product_not_found" | "product_not_published";

export async function addItemToCart(
  db: Database,
  tenantId: string,
  cartId: string,
  productId: string,
  quantity: number,
): Promise<{ ok: true } | { ok: false; reason: AddItemFailureReason }> {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
    .limit(1);
  if (!product) {
    return { ok: false, reason: "product_not_found" };
  }
  if (product.status !== "published") {
    return { ok: false, reason: "product_not_published" };
  }

  const [existing] = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)))
    .limit(1);

  if (existing) {
    await db
      .update(cartItems)
      .set({ quantity: existing.quantity + quantity, updatedAt: new Date() })
      .where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({
      cartId,
      productId,
      quantity,
      unitPriceSnapshotCents: product.priceCents,
    });
  }
  return { ok: true };
}

export async function updateCartItemQuantity(
  db: Database,
  cartId: string,
  itemId: string,
  quantity: number,
): Promise<boolean> {
  const result = await db
    .update(cartItems)
    .set({ quantity, updatedAt: new Date() })
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.id, itemId)))
    .returning({ id: cartItems.id });
  return result.length > 0;
}

export async function removeCartItem(
  db: Database,
  cartId: string,
  itemId: string,
): Promise<boolean> {
  const result = await db
    .delete(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.id, itemId)))
    .returning({ id: cartItems.id });
  return result.length > 0;
}

export async function deleteCart(db: Database, cartId: string): Promise<void> {
  await db.delete(carts).where(eq(carts.id, cartId));
}
