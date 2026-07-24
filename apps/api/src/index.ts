import Fastify from "fastify";
import dbPlugin from "./plugins/db.js";
import redisPlugin from "./plugins/redis.js";
import corsPlugin from "./plugins/cors.js";
import cookiesPlugin from "./plugins/cookies.js";
import betterAuthPlugin from "./plugins/better-auth.js";
import orgAccessPlugin from "./plugins/org-access.js";
import platformAdminBetterAuthPlugin from "./plugins/platform-admin-better-auth.js";
import platformAdminAccessPlugin from "./plugins/platform-admin-access.js";
import healthRoutes from "./routes/health.js";
import authRoutes from "./modules/auth/routes/index.js";
import sitesRoutes from "./modules/sites/routes/index.js";
import productsRoutes from "./modules/products/routes/index.js";
import numbatrakAgentsRoutes from "./modules/numbatrak-agents/routes/index.js";
import numbatrakProductsRoutes from "./modules/numbatrak-products/routes/index.js";
import numbatrakOrdersRoutes from "./modules/numbatrak-orders/routes/index.js";
import numbatrakAbandonedCartsRoutes from "./modules/numbatrak-abandoned-carts/routes/index.js";
import numbatrakDeliveriesRoutes from "./modules/numbatrak-deliveries/routes/index.js";
import numbatrakWalletRoutes from "./modules/numbatrak-wallet/routes/index.js";
import numbatrakExpensesRoutes from "./modules/numbatrak-expenses/routes/index.js";
import numbatrakFollowUpsRoutes from "./modules/numbatrak-follow-ups/routes/index.js";
import numbatrakDashboardRoutes from "./modules/numbatrak-dashboard/routes/index.js";
import numbatrakFormsRoutes from "./modules/numbatrak-forms/routes/index.js";
import numbatrakInventoryRoutes from "./modules/numbatrak-inventory/routes/index.js";
import numbatrakStaffRoutes from "./modules/numbatrak-staff/routes/index.js";
import numbatrakPayrollRoutes from "./modules/numbatrak-payroll/routes/index.js";
import numbatrakAttendanceRoutes from "./modules/numbatrak-attendance/routes/index.js";
import numbatrakStrikesRoutes from "./modules/numbatrak-strikes/routes/index.js";
import numbatrakStarsRoutes from "./modules/numbatrak-stars/routes/index.js";
import numbatrakLeaveRoutes from "./modules/numbatrak-leave/routes/index.js";
import numbatrakOrderAssignmentRoutes from "./modules/numbatrak-order-assignment/routes/index.js";
import collectionsRoutes from "./modules/collections/routes/index.js";
import cartRoutes from "./modules/cart/routes/index.js";
import checkoutRoutes from "./modules/checkout/routes/index.js";
import paymentsRoutes from "./modules/payments/routes/index.js";
import ordersRoutes from "./modules/orders/routes/index.js";
import deliveryRoutes from "./modules/delivery/routes/index.js";
import customersRoutes from "./modules/customers/routes/index.js";
import catalogRoutes from "./modules/catalog/routes/index.js";
import analyticsRoutes from "./modules/analytics/routes/index.js";
import platformAdminRoutes from "./modules/platform-admin/routes/index.js";
import platformBillingRoutes from "./modules/platform-billing/routes/index.js";
import { recordError } from "./modules/platform-admin/lib/operations-store.js";

const app = Fastify({ logger: true });

await app.register(dbPlugin);
await app.register(redisPlugin);
await app.register(corsPlugin);
await app.register(cookiesPlugin);
await app.register(betterAuthPlugin);
await app.register(orgAccessPlugin);
await app.register(platformAdminBetterAuthPlugin);
await app.register(platformAdminAccessPlugin);
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(sitesRoutes);
await app.register(productsRoutes);
await app.register(numbatrakAgentsRoutes);
await app.register(numbatrakProductsRoutes);
await app.register(numbatrakOrdersRoutes);
await app.register(numbatrakAbandonedCartsRoutes);
await app.register(numbatrakDeliveriesRoutes);
await app.register(numbatrakWalletRoutes);
await app.register(numbatrakExpensesRoutes);
await app.register(numbatrakFollowUpsRoutes);
await app.register(numbatrakDashboardRoutes);
await app.register(numbatrakFormsRoutes);
await app.register(numbatrakInventoryRoutes);
await app.register(numbatrakStaffRoutes);
await app.register(numbatrakPayrollRoutes);
await app.register(numbatrakAttendanceRoutes);
await app.register(numbatrakStrikesRoutes);
await app.register(numbatrakStarsRoutes);
await app.register(numbatrakLeaveRoutes);
await app.register(numbatrakOrderAssignmentRoutes);
await app.register(collectionsRoutes);
await app.register(cartRoutes);
await app.register(checkoutRoutes);
await app.register(paymentsRoutes);
await app.register(ordersRoutes);
await app.register(deliveryRoutes);
await app.register(customersRoutes);
await app.register(catalogRoutes);
await app.register(analyticsRoutes);
await app.register(platformAdminRoutes);
await app.register(platformBillingRoutes);

// Record server-side failures to the platform error log (Operations / Tab 6).
// Observes only — it never alters the response. Routine 4xx (validation, auth,
// not-found) are skipped so the log stays signal, not noise.
app.addHook("onError", async (request, _reply, error) => {
  const status = (error as { statusCode?: number }).statusCode ?? 500;
  if (status < 500) return;
  const url = request.url;
  const source = url.includes("/webhooks/") ? "webhook" : url.includes("/cron/") ? "cron" : "api";
  try {
    await recordError(app.getDb(), {
      source,
      message: error.message,
      context: { method: request.method, url, statusCode: status },
    });
  } catch {
    // Never let error logging break error handling.
  }
});

const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: "0.0.0.0" }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
