import type { FastifyInstance } from "fastify";
import { listNumbatrakFollowUpsQuerySchema } from "@platform/shared-types";
import { countFollowUpsForOrg } from "../lib/follow-ups.js";

export default async function countFollowUpsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/org/numbatrak/follow-ups/count",
    { preHandler: app.requireOrgPermission({ numbatrakFollowUps: ["view"] }) },
    async (request, reply) => {
      const query = listNumbatrakFollowUpsQuerySchema.partial().parse(request.query);
      const db = app.getDb();
      const count = await countFollowUpsForOrg(db, request.activeOrganizationId!, query);
      return reply.send({ count });
    },
  );
}
