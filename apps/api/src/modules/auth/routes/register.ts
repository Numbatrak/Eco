import type { FastifyInstance } from "fastify";
import { registerRequestSchema, type MessageResponse } from "@platform/shared-types";
import { isAPIError } from "better-auth/api";
import { auth } from "../../../lib/auth.js";

// Identical regardless of whether the email was already registered - the
// registration outcome must never be inferable from the response.
const GENERIC_MESSAGE =
  "If that email is available, we've created your account. Check your inbox for a verification link.";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base.length > 0 ? base : "org";
}

export default async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register", async (request, reply) => {
    const body = registerRequestSchema.parse(request.body);

    let signUp;
    try {
      signUp = await auth.api.signUpEmail({
        body: { name: body.businessName, email: body.email, password: body.password },
      });
    } catch (error) {
      if (isAPIError(error) && error.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
        const response: MessageResponse = { message: GENERIC_MESSAGE };
        return reply.code(202).send(response);
      }
      throw error;
    }

    // Auto-slugify from the business name; the org-creation hook rejects
    // reserved/invalid/duplicate slugs, so retry with a random suffix until
    // one sticks. The subdomain stays user-changeable later via /org/site-settings.
    let attempt = 0;
    let lastError: unknown;
    while (attempt < 5) {
      const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
      const slug = `${slugify(body.businessName)}${suffix}`;
      try {
        await auth.api.createOrganization({
          body: { name: body.businessName, slug, userId: signUp.user.id },
        });
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        attempt += 1;
      }
    }
    if (lastError) {
      request.log.error({ err: lastError }, "Failed to create organization for new user");
    }

    const response: MessageResponse = { message: GENERIC_MESSAGE };
    return reply.code(202).send(response);
  });
}
