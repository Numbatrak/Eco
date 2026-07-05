# Platform Monorepo

Multi-tenant SaaS platform: storefront builder, admin dashboard, backend API, and a
dev SDK, orchestrated with pnpm workspaces + Turborepo. Numbatrak (an existing
product) lives here too and will be migrated in during a later task.

## Layout

```
/apps
  /storefront   Next.js (App Router) — customer-facing sites, one per tenant subdomain
  /admin        Vite + React — internal dashboard
  /api          Fastify — backend API
  /numbatrak    placeholder — migration lands in a later task
/packages
  /db           Drizzle ORM schema, migrations, drizzle-kit config (source of truth for the DB shape)
  /shared-types Zod schemas + inferred TS types shared across api/storefront/admin/sdk
  /sdk          Dev-facing SDK, published to npm independently
  /config       Shared ESLint config, Prettier config
```

`tsconfig.base.json` lives at the repo root (not in `packages/config`) so every
workspace's `tsconfig.json` can `extends` it with a short relative path. ESLint and
Prettier configs live in `packages/config` since they're consumed as real package
imports (`@platform/config/eslint.config.js`) rather than filesystem-relative
extends.

## How the packages relate

- `apps/api` imports `@platform/db` (data access) and `@platform/shared-types`
  (request/response schemas).
- `apps/storefront` and `apps/admin` import `@platform/shared-types` for shared
  validation/types.
- `packages/sdk` will eventually wrap `@platform/shared-types` and the API surface
  for external developers; it's a standalone-publishable package.
- `packages/db` is the only package that talks to Postgres; its schema now
  includes `users`, `tenants`/`tenant_members`, `refresh_tokens`, `backup_codes`,
  and `security_events` for auth + 2FA.
- `apps/api` also talks to Redis directly (`src/lib/redis.ts`) for ephemeral,
  short-TTL auth state: rate limiting, 2FA challenge single-use tracking, email
  OTP codes, and password reset tokens.

## Getting started

```
pnpm install
pnpm dev      # runs apps/api, apps/storefront, apps/admin concurrently
pnpm build    # builds every app/package in dependency order
pnpm lint
pnpm typecheck
```

Each app has a `.env.example` — copy to `.env` and fill in real values before
running anything that touches Postgres.

## Requirements

- Node 20+ (see `.nvmrc`)
- pnpm 9+ (pinned via `packageManager` in `package.json`)

## Auth: the two-step login contract

`apps/api` implements password auth plus optional two-factor authentication (TOTP
or email OTP). A client integrating against `POST /auth/login` must handle two
possible response shapes, distinguished by `status`:

**No 2FA enabled** — tokens are issued immediately:

```json
{ "status": "authenticated", "accessToken": "...", "refreshToken": "..." }
```

**2FA enabled** — no usable token is issued yet. The response only tells you a
challenge is required and which method to use:

```json
{ "status": "mfa_required", "challengeToken": "...", "method": "totp" }
```

To finish authenticating, send the `challengeToken` plus the user's code (from
their authenticator app, an emailed OTP, or a backup code — the server detects
which one it is, the client doesn't need to specify) to `POST /auth/2fa/verify`:

```json
{ "challengeToken": "...", "code": "123456" }
```

A successful call returns the same `{ accessToken, refreshToken }` shape as a
non-2FA login. If `method` is `"email_otp"`, call `POST /auth/2fa/send-email-otp`
with just the `challengeToken` first to have a code emailed, then verify as above.

The `challengeToken` is short-lived (5 minutes), single-use (a second `verify`
call with the same token — even a correct one — is rejected), and capped at 5
verify attempts before the challenge is invalidated outright and the user must
log in again.

### Managing 2FA (authenticated endpoints, `Authorization: Bearer <accessToken>`)

- `POST /auth/2fa/totp/setup` → `{ otpauthUrl, secret }`. Render `otpauthUrl` as a
  QR code client-side (this API never generates images) or let the user enter
  `secret` manually. This does **not** enable TOTP yet.
- `POST /auth/2fa/totp/confirm` with `{ code }` → enables TOTP and returns
  `{ backupCodes: string[] }` (8 codes). **This is the only time backup codes are
  ever returned — store them now, they cannot be retrieved again.**
- `GET /auth/2fa/status` → which methods are enabled and how many unused backup
  codes remain. Never returns secrets or code hashes.
- `POST /auth/2fa/disable` with `{ password, code }` → requires the current
  password **and** a currently-valid 2FA code (TOTP or an unused backup code),
  the same bar as enabling. Disables all 2FA methods and deletes unused backup
  codes.
- `POST /auth/2fa/backup-codes/regenerate` with `{ password, code }` → same
  re-auth bar as disable; invalidates all existing unused codes and returns 8 new
  ones once.

### Security notes

- A user with 2FA enabled never receives a usable access/refresh token from
  password verification alone — `POST /auth/login` only ever returns a challenge
  token in that case.
- TOTP secrets are encrypted at rest (AES-256-GCM, key from `TOTP_ENCRYPTION_KEY`)
  and never returned by any endpoint except the one `setup` response where
  returning it is unavoidable (it's embedded in the QR provisioning URI).
- Backup codes and email OTP codes are hashed with argon2id, exactly like
  passwords — never stored or logged in plaintext after their one display.
- Every failed login/2FA/backup-code attempt is rate-limited (Redis-backed, so
  it holds up across restarts and multiple instances) and written to
  `security_events` (`login_failed`, `2fa_failed`, etc.) for audit purposes.
- Completing a password reset revokes every refresh token for that account (all
  devices, all sessions) — it does not touch 2FA enrollment, so 2FA is still
  required on the next login.

### Known gaps (flagged, not silently skipped)

- The generated Drizzle migration (`packages/db/drizzle/0000_*.sql`) has **not**
  been applied or verified against a live Postgres instance — there's no
  database available in this environment. Run `pnpm --filter @platform/db
  db:migrate` against a real `DATABASE_URL` before relying on this schema.
- Vitest coverage here mocks `@platform/db` and Redis (via `ioredis-mock`); there
  is no integration-tier suite exercising a real Postgres/Redis end to end, since
  neither is available in this environment. Add a Docker/testcontainers-based
  suite before treating this as full coverage.
- There is no dedicated endpoint to enroll email OTP as a user's 2FA method in
  this task's scope — the schema and login/verify flows support it
  (`email_otp_enabled_at`, `preferred_2fa_method`), but only the TOTP
  setup/confirm pair is wired up. Add an email-OTP enrollment endpoint before
  exposing it as a user-facing option.

