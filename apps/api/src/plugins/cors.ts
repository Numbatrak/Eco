import fp from "fastify-plugin";
import cors from "@fastify/cors";

/**
 * Three first-party origins:
 * - PUBLIC_APP_URL (platform-admin console, apps/admin)
 * - STOREFRONT_APP_URL (Next.js storefront + store-owner /dashboard).
 * - NUMBATRAK_APP_URL (apps/numbatrak/numbatrak - a separate Vite SPA, so
 *   unlike the storefront it has no same-origin rewrite and calls this API
 *   genuinely cross-origin). Comma-separated to allow more than one origin
 *   during domain cutovers (e.g. the old numbatrak.io alongside the new
 *   app.numbatrak.io).
 *
 * Tenant-subdomain traffic (e.g. shop.localhost:3000) goes through Next's
 * /api/:path* rewrite (apps/storefront/next.config.mjs), so from the API's
 * point of view it arrives with the storefront origin, not the subdomain -
 * no CORS wildcard needed. `credentials: true` forbids `*`, so we allow
 * exact origins only.
 *
 * Exception: /public/numbatrak/forms/* (the WordPress embed intake surface)
 * is hit from arbitrary third-party sites and needs any-origin CORS. That
 * can't be done inside this plugin's own `origin` option - @fastify/cors
 * calls it as `origin.call(fastify, req.headers.origin, cb)` (see its
 * resolveOriginWrapper), so it only ever gets the Origin header value, never
 * the request/path, and `this` is the Fastify instance, not the request.
 * Instead, those routes set `config: { cors: false }` on themselves, which
 * this plugin's own onRequest hook respects (`addCorsHeadersHandler` checks
 * `req.routeOptions.config?.cors === false` and no-ops) - the routes then
 * set their own permissive headers directly. @fastify/cors also can't be
 * registered a second time in-process (it decorates the root instance
 * internally; a second registration throws FST_ERR_DEC_ALREADY_PRESENT even
 * from a nested plugin context), which is why this opt-out, not a second
 * registration, is the mechanism.
 */
export default fp(async (app) => {
  const adminOrigin = process.env.PUBLIC_APP_URL ?? "http://localhost:3002";
  const storefrontOrigin = process.env.STOREFRONT_APP_URL ?? "http://localhost:3000";
  const numbatrakOrigins = (process.env.NUMBATRAK_APP_URL ?? "http://localhost:3003")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: [adminOrigin, storefrontOrigin, ...numbatrakOrigins],
    credentials: true,
  });
});
