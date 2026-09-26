import Fastify from "fastify";
import dbPlugin from "./plugins/db.js";
import redisPlugin from "./plugins/redis.js";
import corsPlugin from "./plugins/cors.js";
import cookiesPlugin from "./plugins/cookies.js";
import betterAuthPlugin from "./plugins/better-auth.js";
import orgAccessPlugin from "./plugins/org-access.js";
import apiKeyAccessPlugin from "./plugins/api-key-access.js";
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
import numbatrakDeliveryFeesRoutes from "./modules/numbatrak-delivery-fees/routes/index.js";
import numbatrakRemittanceRoutes from "./modules/numbatrak-remittance/routes/index.js";
import numbatrakExpensesRoutes from "./modules/numbatrak-expenses/routes/index.js";
import numbatrakFollowUpsRoutes from "./modules/numbatrak-follow-ups/routes/index.js";
import numbatrakDashboardRoutes from "./modules/numbatrak-dashboard/routes/index.js";
import numbatrakFormsRoutes from "./modules/numbatrak-forms/routes/index.js";
import numbatrakInventoryRoutes from "./modules/numbatrak-inventory/routes/index.js";
import numbatrakStaffRoutes from "./modules/numbatrak-staff/routes/index.js";
import numbatrakPayrollRoutes from "./modules/numbatrak-payroll/routes/index.js";
import numbatrakOrderAssignmentRoutes from "./modules/numbatrak-order-assignment/routes/index.js";
import numbatrakMediaBuyersRoutes from "./modules/numbatrak-media-buyers/routes/index.js";
import numbatrakTrackingLinksRoutes from "./modules/numbatrak-tracking-links/routes/index.js";
import numbatrakCrmRoutes from "./modules/numbatrak-crm/routes/index.js";
import numbatrakAccountingRoutes from "./modules/numbatrak-accounting/routes/index.js";
import numbatrakInvoicingRoutes from "./modules/numbatrak-invoicing/routes/index.js";
import numbatrakSettingsRoutes from "./modules/numbatrak-settings/routes/index.js";
import externalApiRoutes from "./modules/external-api/routes/index.js";
import collectionsRoutes from "./modules/collections/routes/index.js";
import cartRoutes from "./modules/cart/routes/index.js";
import checkoutRoutes from "./modules/checkout/routes/index.js";
import paymentsRoutes from "./modules/payments/routes/index.js";
import ordersRoutes from "./modules/orders/routes/index.js";
import deliveryRoutes from "./modules/delivery/routes/index.js";
import discountsRoutes from "./modules/discounts/routes/index.js";
import customersRoutes from "./modules/customers/routes/index.js";
import catalogRoutes from "./modules/catalog/routes/index.js";
import analyticsRoutes from "./modules/analytics/routes/index.js";
import whatsappRoutes from "./modules/whatsapp/routes/index.js";
import platformAdminRoutes from "./modules/platform-admin/routes/index.js";
import platformBillingRoutes from "./modules/platform-billing/routes/index.js";
import { recordError } from "./modules/platform-admin/lib/operations-store.js";
import { ZodError } from "zod";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(dbPlugin);
  await app.register(redisPlugin);
  await app.register(corsPlugin);
  await app.register(cookiesPlugin);
  await app.register(betterAuthPlugin);
  await app.register(orgAccessPlugin);
  await app.register(apiKeyAccessPlugin);
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
  await app.register(numbatrakDeliveryFeesRoutes);
  await app.register(numbatrakRemittanceRoutes);
  await app.register(numbatrakExpensesRoutes);
  await app.register(numbatrakFollowUpsRoutes);
  await app.register(numbatrakDashboardRoutes);
  await app.register(numbatrakFormsRoutes);
  await app.register(numbatrakInventoryRoutes);
  await app.register(numbatrakStaffRoutes);
  await app.register(numbatrakPayrollRoutes);
  await app.register(numbatrakOrderAssignmentRoutes);
  await app.register(numbatrakMediaBuyersRoutes);
  await app.register(numbatrakTrackingLinksRoutes);
  await app.register(numbatrakCrmRoutes);
  await app.register(numbatrakAccountingRoutes);
  await app.register(numbatrakInvoicingRoutes);
  await app.register(numbatrakSettingsRoutes);
  await app.register(externalApiRoutes);
  await app.register(collectionsRoutes);
  await app.register(cartRoutes);
  await app.register(checkoutRoutes);
  await app.register(paymentsRoutes);
  await app.register(ordersRoutes);
  await app.register(deliveryRoutes);
  await app.register(discountsRoutes);
  await app.register(customersRoutes);
  await app.register(catalogRoutes);
  await app.register(analyticsRoutes);
  await app.register(whatsappRoutes);
  await app.register(platformAdminRoutes);
  await app.register(platformBillingRoutes);

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

  // Without this, Fastify's default handler echoes error.message verbatim to
  // the client - fine for our own `throw new Error("Customer name is
  // required")`-style validation, but drizzle/postgres-js embeds the raw SQL
  // and bind params into Error.message on query failure, so an uncaught DB
  // error would leak schema/query details straight into the HTTP response.
  // Zod's `.parse()` throws are the one case we can label 400 with confidence
  // (malformed request body/params); everything else uncaught is treated as
  // an internal error - logged in full server-side, replied to generically.
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "Invalid request",
        issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      });
    }

    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status < 500) {
      return reply.code(status).send({ error: (error as Error).message });
    }

    request.log.error({ err: error, method: request.method, url: request.url }, "Unhandled error");
    return reply.code(500).send({ error: "Internal server error" });
  });

  return app;
}
