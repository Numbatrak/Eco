import type { FastifyInstance } from "fastify";
import { funnelConfigSchema } from "@platform/shared-types";
import { findProductForTenant } from "../lib/products.js";
import {
  ensureProductFunnelConfig,
  findFunnelConfigByProduct,
  saveFunnelConfig,
  publishFunnel,
  unpublishFunnel,
} from "../lib/funnel-store.js";

export default async function productFunnelRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { productId: string } }>(
    "/org/products/:productId/funnel",
    { preHandler: app.requireOrgPermission({ products: ["view"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const product = await findProductForTenant(
        db,
        request.activeOrganizationId!,
        request.params.productId,
      );
      if (!product) {
        return reply.code(404).send({ error: "Product not found" });
      }
      await ensureProductFunnelConfig(db, product.id);
      const config = await findFunnelConfigByProduct(db, product.id);
      return reply.send(config);
    },
  );

  app.put<{ Params: { productId: string } }>(
    "/org/products/:productId/funnel",
    { preHandler: app.requireOrgPermission({ products: ["edit"] }) },
    async (request, reply) => {
      const body = funnelConfigSchema.parse(request.body);
      const db = app.getDb();
      const product = await findProductForTenant(
        db,
        request.activeOrganizationId!,
        request.params.productId,
      );
      if (!product) {
        return reply.code(404).send({ error: "Product not found" });
      }
      await ensureProductFunnelConfig(db, product.id);
      await saveFunnelConfig(db, product.id, body);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { productId: string } }>(
    "/org/products/:productId/funnel/publish",
    { preHandler: app.requireOrgPermission({ products: ["edit"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const product = await findProductForTenant(
        db,
        request.activeOrganizationId!,
        request.params.productId,
      );
      if (!product) {
        return reply.code(404).send({ error: "Product not found" });
      }
      await ensureProductFunnelConfig(db, product.id);
      await publishFunnel(db, product.id);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { productId: string } }>(
    "/org/products/:productId/funnel/unpublish",
    { preHandler: app.requireOrgPermission({ products: ["edit"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const product = await findProductForTenant(
        db,
        request.activeOrganizationId!,
        request.params.productId,
      );
      if (!product) {
        return reply.code(404).send({ error: "Product not found" });
      }
      await unpublishFunnel(db, product.id);
      return reply.code(204).send();
    },
  );
}
