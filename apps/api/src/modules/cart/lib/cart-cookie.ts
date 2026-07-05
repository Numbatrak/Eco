import type { FastifyReply, FastifyRequest } from "fastify";

const CART_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * One cookie per tenant subdomain - a shopper browsing multiple tenant
 * storefronts from the same browser must not have their carts collide,
 * since every tenant's site is served from the same API host/cookie jar.
 */
function cartCookieName(subdomain: string): string {
  return `cart_token_${subdomain.toLowerCase()}`;
}

export function getCartTokenCookie(request: FastifyRequest, subdomain: string): string | undefined {
  return request.cookies[cartCookieName(subdomain)];
}

export function setCartTokenCookie(reply: FastifyReply, subdomain: string, token: string): void {
  reply.setCookie(cartCookieName(subdomain), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_TOKEN_TTL_SECONDS,
  });
}

export function clearCartTokenCookie(reply: FastifyReply, subdomain: string): void {
  reply.clearCookie(cartCookieName(subdomain), { path: "/" });
}
