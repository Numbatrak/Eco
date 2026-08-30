import type { FastifyInstance, FastifyRequest } from "fastify";
import { loginRequestSchema, type LoginResponse } from "@platform/shared-types";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../../lib/auth.js";
import { logSecurityEvent } from "../lib/security-events.js";
import { sendEmail } from "../lib/email.js";
import { loginNotificationEmail } from "../../../lib/email-templates.js";

function requestMeta(request: FastifyRequest): { ip: string; userAgent?: string } {
  return { ip: request.ip, userAgent: request.headers["user-agent"] };
}

export default async function loginRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/login", async (request, reply) => {
    const body = loginRequestSchema.parse(request.body);
    const db = app.getDb();
    const meta = requestMeta(request);

    // With asResponse: true, Better Auth resolves errors into an error
    // Response rather than throwing - it doesn't propagate as a catchable
    // exception the way it does without asResponse (see register.ts).
    const result = await auth.api.signInEmail({
      body: { email: body.email, password: body.password },
      headers: fromNodeHeaders(request.headers),
      asResponse: true,
    });

    if (!result.ok) {
      await logSecurityEvent(db, { eventType: "login_failed", ...meta });
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    // Forward Better Auth's Set-Cookie (session, or the 2FA-pending cookie)
    // to the real client. Fastify's reply.header accepts an array for
    // multi-value headers like Set-Cookie - setting it per-cookie in a loop
    // would overwrite rather than append.
    const setCookies = result.headers.getSetCookie();
    if (setCookies.length > 0) {
      reply.header("set-cookie", setCookies);
    }
    const payload = (await result.json()) as LoginResponse;

    if ("twoFactorRedirect" in payload) {
      await logSecurityEvent(db, { eventType: "2fa_challenge_issued", ...meta });
      return reply.code(result.status).send(payload);
    }

    // Signup creates the org via a headerless "system action" call (see
    // register.ts), so createOrganization's own auto-set-active-org logic
    // never fires (it only runs when ctx.context.session exists). This
    // repo's admin UI assumes a single active tenant with no switcher, so
    // default the session's active org to the user's first membership here
    // instead, the first time we see it unset.
    const sessionHeaders = new Headers({ cookie: setCookies.map((c) => c.split(";")[0]).join("; ") });
    const session = await auth.api.getSession({ headers: sessionHeaders });
    if (session && !session.session.activeOrganizationId) {
      const organizations = await auth.api.listOrganizations({ headers: sessionHeaders });
      if (organizations.length > 0) {
        await auth.api.setActiveOrganization({
          headers: sessionHeaders,
          body: { organizationId: organizations[0]!.id },
        });
      }
    }

    await logSecurityEvent(db, { userId: payload.user.id, eventType: "login_success", ...meta });

    // Best-effort: never let a notification-email failure slow down or fail the login response.
    sendEmail(request.log, {
      to: payload.user.email,
      subject: "New sign-in to your account",
      body: loginNotificationEmail({ time: new Date().toISOString(), ip: meta.ip, userAgent: meta.userAgent }),
    }).catch((err) => request.log.error({ err }, "Failed to send login notification email"));

    return reply.code(result.status).send(payload);
  });
}
