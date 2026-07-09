import fp from "fastify-plugin";
import fastifyBetterAuth, { type FastifyBetterAuthOptions } from "fastify-better-auth";
import { auth } from "../lib/auth.js";

/**
 * Mounts Better Auth's HTTP surface (organization + twoFactor + core
 * email/password endpoints) at its default base path (/api/auth/*).
 * Server-side code that needs to call auth.api.* directly imports `auth`
 * from ../lib/auth.js rather than going through a Fastify decorator.
 *
 * The cast below works around a type-identity mismatch, not a real bug:
 * fastify-better-auth imports its own `better-auth` types from a separately
 * pnpm-resolved copy (different peer-dependency context than this repo's),
 * so structurally-identical `Auth<...>` types come out nominally
 * "unrelated" to tsc even though they describe the same shape. Verified
 * working at runtime via an integration spike (Fastify inject: sign-up ->
 * create-organization -> has-permission all round-tripped correctly).
 */
export default fp(async (app) => {
  await app.register(fastifyBetterAuth, { auth } as unknown as FastifyBetterAuthOptions);
});
