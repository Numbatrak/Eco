// Vitest doesn't auto-load .env the way `tsx --env-file` does for dev; load
// it explicitly so TEST_DATABASE_URL etc. are available. Fine to no-op in
// CI, where env vars are injected directly and no .env file exists.
try {
  process.loadEnvFile();
} catch {
  // no .env file present - rely on already-set process.env vars
}

process.env.BETTER_AUTH_SECRET ||= "test-better-auth-secret-do-not-use-in-prod";
process.env.SECRET_ENCRYPTION_KEY ||= Buffer.alloc(32, 7).toString("base64");
process.env.PUBLIC_APP_URL ||= "http://localhost:3002";

// Every module that calls getDb() (routes, lib/auth.ts's drizzleAdapter,
// test/test-db.ts) shares this one lazy singleton - pointing DATABASE_URL at
// the test database here makes the whole app under test transparently use
// it, no per-module wiring needed. Tier B tests additionally require
// TEST_DATABASE_URL to be set explicitly (see .env.example) so a missing
// env var fails loudly rather than silently running against dev data.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
