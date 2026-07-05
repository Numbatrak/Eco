import type { FastifyInstance } from "fastify";
import type { OrderStatusResponse } from "@platform/shared-types";
import { findPublishedTenantBySubdomain } from "../../sites/lib/site-store.js";
import { findOrderById, markOrderPaid, markOrderFailed } from "../lib/orders.js";
import { findPaymentSettings } from "../../payments/lib/payment-settings-store.js";
import { buildProvider } from "../../payments/lib/provider-factory.js";

export default async function checkoutStatusRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { subdomain: string; orderId: string } }>(
    "/public/sites/:subdomain/checkout/:orderId/status",
    async (request, reply) => {
      const db = app.getDb();
      const tenant = await findPublishedTenantBySubdomain(db, request.params.subdomain);
      if (!tenant) {
        return reply.code(404).send({ error: "site_not_found" });
      }
      let order = await findOrderById(db, tenant.id, request.params.orderId);
      if (!order) {
        return reply.code(404).send({ error: "order_not_found" });
      }

      // The provider redirect query params are never trusted on their own -
      // re-verify server-side against the provider before reporting status.
      if (order.status === "pending" && order.paymentReference) {
        const settings = await findPaymentSettings(db, tenant.id);
        const provider = settings ? buildProvider(settings) : null;
        if (provider) {
          const verified = await provider.verifyTransaction(order.paymentReference);
          if (verified.status === "success") {
            await markOrderPaid(db, app.log, order);
          } else if (verified.status === "failed") {
            await markOrderFailed(db, order);
          }
          const refreshed = await findOrderById(db, tenant.id, request.params.orderId);
          if (refreshed) {
            order = refreshed;
          }
        }
      }

      const response: OrderStatusResponse = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalCents: order.totalCents,
        currency: order.currency,
      };
      return reply.send(response);
    },
  );
}
