import { toNodeHandler } from "better-auth/node";
import type { FastifyInstance } from "fastify";
import { platformAdminAuth } from "../lib/platform-admin-auth.js";

const BASE_PATH = "/platform-admin/auth";
// Accounts are created exclusively by the CLI (../cli/create-admin-account.ts),
// which calls platformAdminAuth.api.signUpEmail() directly (in-process, no
// HTTP) - that call is unaffected by blocking this one HTTP path. There is
// intentionally no `disableSignUp` option set on the instance itself: that
// flag makes the *same handler* throw for the CLI's direct calls too, not
// just this HTTP route.
const BLOCKED_PATH = `${BASE_PATH}/sign-up/email`;

// Mirrors fastify-better-auth's internal (unexported) mapHeaders() helper -
// converts Fastify's already-queued reply headers into a Headers object so
// they survive the handoff to the raw Node req/res that better-auth/node's
// toNodeHandler writes to directly.
function mapHeaders(fastifyHeaders: Record<string, unknown>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(fastifyHeaders)) {
    if (value) headers.append(key, String(value));
  }
  return headers;
}

/**
 * Mounts the platform-admin Better Auth instance's HTTP surface, separately
 * from ../plugins/better-auth.ts (the tenant-member bridge). Hand-written
 * rather than reusing the `fastify-better-auth` package: that package
 * decorates a fixed Symbol key on whatever Fastify instance `.register()`
 * is called on and is itself `fp()`-wrapped, so registering it twice on the
 * same root instance (once per Better Auth instance) throws a duplicate-
 * decorator error. This plugin is registered as a plain (non-fp) function
 * instead, so Fastify gives it its own encapsulated child context - no
 * decorator collision, and consistent with this repo's existing convention
 * of importing the `auth` object directly in route files rather than
 * fetching it off the Fastify instance.
 */
export default async function platformAdminBetterAuthPlugin(app: FastifyInstance): Promise<void> {
  const authHandler = toNodeHandler(platformAdminAuth);

  app.addContentTypeParser("application/json", (_request, _payload, done) => {
    done(null, null);
  });

  app.all(`${BASE_PATH}/*`, async (request, reply) => {
    if (request.url.split("?")[0] === BLOCKED_PATH) {
      return reply.code(404).send({ error: "not_found" });
    }
    reply.raw.setHeaders(mapHeaders(reply.getHeaders()));
    await authHandler(request.raw, reply.raw);
  });
}
