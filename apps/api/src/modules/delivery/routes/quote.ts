import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { findPublishedTenantBySubdomain } from "../../sites/lib/site-store.js";
import { findDeliverySettings, serializeDeliverySettings } from "../lib/delivery-settings-store.js";
import { quoteDelivery } from "../lib/quote.js";

const quoteQuerySchema = z.object({
  subtotalCents: z.coerce.number().int().nonnegative(),
});

export default async function deliveryQuoteRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { subdomain: string } }>(
    "/public/sites/:subdomain/delivery-quote",
    async (request, reply) => {
      const query = quoteQuerySchema.parse(request.query);
      const db = app.getDb();
      const tenant = await findPublishedTenantBySubdomain(db, request.params.subdomain);
      if (!tenant) {
        return reply.code(404).send({ error: "site_not_found" });
      }
      const settingsRow = await findDeliverySettings(db, tenant.id);
      const settings = serializeDeliverySettings(settingsRow);
      return reply.send(quoteDelivery(settings, query.subtotalCents));
    },
  );
}
