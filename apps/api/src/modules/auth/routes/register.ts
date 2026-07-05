import type { FastifyInstance } from "fastify";
import { registerRequestSchema } from "@platform/shared-types";
import { hashPassword } from "../lib/password.js";
import { createUser, findUserByEmail } from "../lib/users.js";

export default async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register", async (request, reply) => {
    const body = registerRequestSchema.parse(request.body);
    const db = app.getDb();

    const existing = await findUserByEmail(db, body.email);
    if (existing) {
      return reply.code(409).send({ error: "Email already registered" });
    }

    const passwordHash = await hashPassword(body.password);
    const created = await createUser(db, { email: body.email, passwordHash });

    return reply.code(201).send(created);
  });
}
