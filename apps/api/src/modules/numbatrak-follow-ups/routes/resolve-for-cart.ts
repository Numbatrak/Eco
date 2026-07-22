import type { FastifyInstance } from "fastify";
import { resolveNumbatrakFollowUpsForCartRequestSchema } from "@platform/shared-types";
import { resolveFollowUpsForConvertedCart } from "../lib/follow-ups.js";

export default async function resolveForCartRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/org/numbatrak/follow-ups/resolve-for-cart",
    { preHandler: app.requireOrgPermission({ numbatrakFollowUps: ["update"] }) },
    async (request, reply) => {
      const body = resolveNumbatrakFollowUpsForCartRequestSchema.parse(request.body);
      const db = app.getDb();
      await resolveFollowUpsForConvertedCart(db, request.activeOrganizationId!, body.cartId, body.orderId);
      return reply.code(204).send();
    },
  );
}
