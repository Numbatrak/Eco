import type { FastifyInstance, FastifyRequest } from "fastify";
import { findPublishedTenantBySubdomain, type TenantSummary } from "../../sites/lib/site-store.js";
import { findCartByToken, type CartRow } from "./cart-store.js";
import { getCartTokenCookie } from "./cart-cookie.js";

export interface ResolvedCartContext {
  tenant: TenantSummary;
  cart: CartRow;
}

export interface CartContextError {
  error: "site_not_found" | "cart_not_found";
}

export async function resolveCartContext(
  app: FastifyInstance,
  request: FastifyRequest,
  subdomain: string,
): Promise<ResolvedCartContext | CartContextError> {
  const db = app.getDb();
  const tenant = await findPublishedTenantBySubdomain(db, subdomain);
  if (!tenant) {
    return { error: "site_not_found" };
  }
  const token = getCartTokenCookie(request, subdomain);
  const cart = token ? await findCartByToken(db, tenant.id, token) : null;
  if (!cart) {
    return { error: "cart_not_found" };
  }
  return { tenant, cart };
}

export function isCartContextError(
  value: ResolvedCartContext | CartContextError,
): value is CartContextError {
  return "error" in value;
}
