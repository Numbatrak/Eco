import fp from "fastify-plugin";
import cors from "@fastify/cors";

/**
 * Three first-party origins:
 * - PUBLIC_APP_URL (platform-admin console, apps/admin)
 * - STOREFRONT_APP_URL (Next.js storefront + store-owner /dashboard).
 * - NUMBATRAK_APP_URL (apps/numbatrak/numbatrak - a separate Vite SPA, so
 *   unlike the storefront it has no same-origin rewrite and calls this API
 *   genuinely cross-origin).
 *
 * Tenant-subdomain traffic (e.g. shop.localhost:3000) goes through Next's
 * /api/:path* rewrite (apps/storefront/next.config.mjs), so from the API's
 * point of view it arrives with the storefront origin, not the subdomain -
 * no CORS wildcard needed. `credentials: true` forbids `*`, so we allow
 * exact origins only.
 */
export default fp(async (app) => {
  const adminOrigin = process.env.PUBLIC_APP_URL ?? "http://localhost:3002";
  const storefrontOrigin = process.env.STOREFRONT_APP_URL ?? "http://localhost:3000";
  const numbatrakOrigin = process.env.NUMBATRAK_APP_URL ?? "http://localhost:3003";

  await app.register(cors, {
    origin: [adminOrigin, storefrontOrigin, numbatrakOrigin],
    credentials: true,
  });
});
