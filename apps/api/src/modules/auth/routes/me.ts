import type { FastifyInstance } from "fastify";
import type { MeResponse } from "@platform/shared-types";
import { findUserById } from "../lib/users.js";
import { listTenantsForUser } from "../lib/tenants.js";

export default async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/me", { preHandler: app.authenticate }, async (request, reply) => {
    const db = app.getDb();
    const user = await findUserById(db, request.userId);
    if (!user) {
      return reply.code(401).send({ error: "Unknown user" });
    }
    const tenants = await listTenantsForUser(db, user.id);
    const response: MeResponse = { id: user.id, email: user.email, tenants };
    return reply.send(response);
  });
}
