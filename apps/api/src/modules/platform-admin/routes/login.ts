import type { FastifyInstance } from "fastify";
import { platformAdminLoginRequestSchema, type LoginResponse } from "@platform/shared-types";
import { fromNodeHeaders } from "better-auth/node";
import { platformAdminAuth } from "../../../lib/platform-admin-auth.js";
import { checkAndIncrementRateLimit } from "../../auth/lib/rate-limit.js";

// Stricter than tenant-member login (no limit today) given the blast radius
// of a compromised platform-admin account.
const LOGIN_ATTEMPT_LIMIT = 3;
const LOGIN_WINDOW_SECONDS = 15 * 60;

export default async function platformAdminLoginRoutes(app: FastifyInstance): Promise<void> {
  app.post("/platform-admin/login", async (request, reply) => {
    const body = platformAdminLoginRequestSchema.parse(request.body);
    const redis = app.getRedis();

    const rate = await checkAndIncrementRateLimit(redis, `platform-admin-login:ip:${request.ip}`, {
      limit: LOGIN_ATTEMPT_LIMIT,
      windowSeconds: LOGIN_WINDOW_SECONDS,
    });
    if (!rate.allowed) {
      return reply.code(429).send({ error: "Too many login attempts. Try again later." });
    }

    const result = await platformAdminAuth.api.signInEmail({
      body: { email: body.email, password: body.password },
      headers: fromNodeHeaders(request.headers),
      asResponse: true,
    });

    if (!result.ok) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const setCookies = result.headers.getSetCookie();
    if (setCookies.length > 0) {
      reply.header("set-cookie", setCookies);
    }
    const payload = (await result.json()) as LoginResponse;
    return reply.code(result.status).send(payload);
  });
}
