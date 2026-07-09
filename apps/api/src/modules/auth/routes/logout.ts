import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../lib/auth.js";

export default async function logoutRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/logout", async (request, reply) => {
    const result = await auth.api.signOut({
      headers: fromNodeHeaders(request.headers),
      asResponse: true,
    });
    const setCookies = result.headers.getSetCookie();
    if (setCookies.length > 0) {
      reply.header("set-cookie", setCookies);
    }
    return reply.code(204).send();
  });
}
