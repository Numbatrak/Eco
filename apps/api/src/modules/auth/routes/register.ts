import type { FastifyInstance } from "fastify";
import { registerRequestSchema, type MessageResponse } from "@platform/shared-types";
import { hashPassword } from "../lib/password.js";
import { createUser, findUserByEmail } from "../lib/users.js";
import { createTenantWithOwner } from "../lib/tenants.js";
import { generateOpaqueToken, sha256Hex } from "../lib/tokens.js";
import { sendEmail } from "../lib/email.js";

const VERIFY_TOKEN_TTL_SECONDS = 24 * 60 * 60;

// Identical regardless of whether the email was already registered - the
// registration outcome must never be inferable from the response.
const GENERIC_MESSAGE =
  "If that email is available, we've created your account. Check your inbox for a verification link.";

function verifyTokenKey(hash: string): string {
  return `emailverify:${hash}`;
}

export default async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register", async (request, reply) => {
    const body = registerRequestSchema.parse(request.body);
    const db = app.getDb();
    const redis = app.getRedis();

    const existing = await findUserByEmail(db, body.email);

    // Hash unconditionally so the collision branch costs the same as a real
    // registration - otherwise response timing would leak which emails exist.
    const passwordHash = await hashPassword(body.password);

    if (existing) {
      await sendEmail(app.log, {
        to: existing.email,
        subject: "Someone tried to sign up with your email",
        body: "A new account was requested using this email address, which is already registered. If this was you, log in instead, or use the forgot-password link if you don't remember your password.",
      });
      const response: MessageResponse = { message: GENERIC_MESSAGE };
      return reply.code(202).send(response);
    }

    const created = await createUser(db, { email: body.email, passwordHash });
    await createTenantWithOwner(db, { name: body.businessName, ownerUserId: created.id });

    const token = generateOpaqueToken();
    await redis.set(verifyTokenKey(sha256Hex(token)), created.id, "EX", VERIFY_TOKEN_TTL_SECONDS);
    const verifyUrl = `${process.env.PUBLIC_APP_URL ?? "http://localhost:3002"}/verify-email?token=${token}`;
    await sendEmail(app.log, {
      to: created.email,
      subject: "Verify your email",
      body: `Welcome! Verify your email address to finish setting up your account: ${verifyUrl}`,
    });

    const response: MessageResponse = { message: GENERIC_MESSAGE };
    return reply.code(202).send(response);
  });
}
