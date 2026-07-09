import Fastify from "fastify";
import dbPlugin from "./plugins/db.js";
import redisPlugin from "./plugins/redis.js";
import corsPlugin from "./plugins/cors.js";
import cookiesPlugin from "./plugins/cookies.js";
import betterAuthPlugin from "./plugins/better-auth.js";
import orgAccessPlugin from "./plugins/org-access.js";
import healthRoutes from "./routes/health.js";
import authRoutes from "./modules/auth/routes/index.js";
import sitesRoutes from "./modules/sites/routes/index.js";
import productsRoutes from "./modules/products/routes/index.js";
import cartRoutes from "./modules/cart/routes/index.js";
import checkoutRoutes from "./modules/checkout/routes/index.js";
import paymentsRoutes from "./modules/payments/routes/index.js";
import ordersRoutes from "./modules/orders/routes/index.js";

const app = Fastify({ logger: true });

await app.register(dbPlugin);
await app.register(redisPlugin);
await app.register(corsPlugin);
await app.register(cookiesPlugin);
await app.register(betterAuthPlugin);
await app.register(orgAccessPlugin);
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(sitesRoutes);
await app.register(productsRoutes);
await app.register(cartRoutes);
await app.register(checkoutRoutes);
await app.register(paymentsRoutes);
await app.register(ordersRoutes);

const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: "0.0.0.0" }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
