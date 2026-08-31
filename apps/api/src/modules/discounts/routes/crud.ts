import type { FastifyInstance } from "fastify";
import { discountRequestSchema } from "@platform/shared-types";
import {
  createDiscount,
  deleteDiscount,
  getDiscount,
  listDiscounts,
  serializeDiscount,
  updateDiscount,
} from "../lib/discounts-store.js";

export default async function discountsCrudRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/discounts",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const rows = await listDiscounts(db, request.activeOrganizationId!);
      return reply.send({ discounts: rows.map(serializeDiscount) });
    },
  );

  app.get<{ Params: { discountId: string } }>(
    "/org/discounts/:discountId",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const row = await getDiscount(db, request.activeOrganizationId!, request.params.discountId);
      if (!row) return reply.code(404).send({ error: "Discount not found" });
      return reply.send(serializeDiscount(row));
    },
  );

  app.post(
    "/org/discounts",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const body = discountRequestSchema.parse(request.body);
      const db = app.getDb();
      const row = await createDiscount(db, request.activeOrganizationId!, body);
      return reply.code(201).send(serializeDiscount(row));
    },
  );

  app.patch<{ Params: { discountId: string } }>(
    "/org/discounts/:discountId",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const body = discountRequestSchema.partial().parse(request.body);
      const db = app.getDb();
      const row = await updateDiscount(db, request.activeOrganizationId!, request.params.discountId, body);
      if (!row) return reply.code(404).send({ error: "Discount not found" });
      return reply.send(serializeDiscount(row));
    },
  );

  app.delete<{ Params: { discountId: string } }>(
    "/org/discounts/:discountId",
    { preHandler: app.requireOrgPermission({ settings: ["manage"] }) },
    async (request, reply) => {
      const db = app.getDb();
      const deleted = await deleteDiscount(db, request.activeOrganizationId!, request.params.discountId);
      if (!deleted) return reply.code(404).send({ error: "Discount not found" });
      return reply.code(204).send();
    },
  );
}
