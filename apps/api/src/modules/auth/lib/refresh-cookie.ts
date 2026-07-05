import type { FastifyReply } from "fastify";

export const REFRESH_TOKEN_COOKIE = "refresh_token";

function refreshTtlSeconds(): number {
  const raw = process.env.REFRESH_TOKEN_TTL_SECONDS;
  return raw ? Number(raw) : 2_592_000;
}

/**
 * Refresh tokens never appear in a JSON response body - they're only ever
 * set as an httpOnly cookie, so a successful XSS payload in the SPA can't
 * read or exfiltrate one via `document.cookie` or the fetch response.
 */
export function setRefreshTokenCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: refreshTtlSeconds(),
  });
}

export function clearRefreshTokenCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });
}
