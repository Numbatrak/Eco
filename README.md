# Platform Monorepo

Multi-tenant SaaS platform: storefront builder, admin dashboard, backend API, and a
dev SDK, orchestrated with pnpm workspaces + Turborepo. Numbatrak (an existing
product) lives here too and will be migrated in during a later task.

## Layout

```
/apps
  /storefront   Next.js (App Router) — customer-facing sites, one per tenant subdomain,
                plus the store-owner dashboard at /dashboard on the main domain
  /admin        Vite + React — Platform Admin (super-admin) console
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
  and `security_events` for auth + 2FA; `permissions`/`tenant_member_permissions`
  and `tenant_site_config` for authorization and the (stubbed) storefront
  builder; and `products`, `carts`/`cart_items`, `orders`/`order_items`,
  `tenant_payment_settings`, and `payment_webhook_events` for commerce.
- `apps/api` also talks to Redis directly (`src/lib/redis.ts`) for ephemeral,
  short-TTL auth state (rate limiting, 2FA challenge single-use tracking, email
  OTP codes, password reset tokens) and for checkout rate limiting.

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

**No 2FA enabled** — an access token is issued immediately, and the refresh
token is set as an `httpOnly` cookie (`refresh_token`) on the response — it is
never present in a JSON body, so a client-side script can't read it:

```json
{ "status": "authenticated", "accessToken": "..." }
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

A successful call returns `{ accessToken }` (again with the refresh token set
as the `refresh_token` cookie), same as a non-2FA login. If `method` is
`"email_otp"`, call `POST /auth/2fa/send-email-otp` with just the
`challengeToken` first to have a code emailed, then verify as above.

The `challengeToken` is short-lived (5 minutes), single-use (a second `verify`
call with the same token — even a correct one — is rejected), and capped at 5
verify attempts before the challenge is invalidated outright and the user must
log in again.

`POST /auth/refresh` and `POST /auth/logout` take no body — both read
`refresh_token` from the request cookie. `refresh` rotates it (revokes the old
row, issues a new one, sets a new cookie) and returns a fresh `{ accessToken }`;
`logout` revokes the row and clears the cookie. A client needs
`credentials: "include"` (fetch) for any of these calls to see the cookie
cross-origin; `apps/api`'s CORS plugin is configured for `PUBLIC_APP_URL` with
`credentials: true` rather than a wildcard origin, which cookies require.

## Auth: registration, tenant creation, and email verification

`POST /auth/register` takes `{ email, password, businessName }` and, in the
same request, creates the user, a new tenant named `businessName`, and an
`owner` `tenant_members` row linking them (all three in one DB transaction).
It always responds `202` with the same generic message regardless of whether
the email was already registered — an existing email gets a "someone tried to
sign up with your email" notice instead of a new account, so registration
outcome is never inferable from the response. A real new signup gets a
verification email (via the `sendEmail` stub) linking to
`${PUBLIC_APP_URL}/verify-email?token=...`; the frontend page at that route is
expected to `POST` the token to `POST /auth/verify-email` (rather than the
email link hitting the API directly via `GET`, which would let email-scanner
prefetching burn the one-time token) to set `users.email_verified_at`. The
token lives in Redis, TTL 24h, single-use.

Login is not gated on email verification in this task's scope — an unverified
user can still log in.

### Managing 2FA (authenticated endpoints, `Authorization: Bearer <accessToken>`)

- `POST /auth/2fa/totp/setup` → `{ otpauthUrl, secret }`. Render `otpauthUrl` as a
  QR code client-side (this API never generates images) or let the user enter
  `secret` manually. This does **not** enable TOTP yet.
- `POST /auth/2fa/totp/confirm` with `{ code }` → enables TOTP and returns
  `{ backupCodes: string[] }` (8 codes). **This is the only time backup codes are
  ever returned — store them now, they cannot be retrieved again.**
- `GET /auth/2fa/status` → which methods are enabled and how many unused backup
  codes remain. Never returns secrets or code hashes.
- `POST /auth/2fa/email-otp/setup` → emails a 6-digit code to the user's own
  address and responds `202`. Does **not** enable email OTP yet.
- `POST /auth/2fa/email-otp/confirm` with `{ code }` → enables email OTP as a
  2FA method for this user.
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
- TOTP secrets are encrypted at rest (AES-256-GCM, key from `SECRET_ENCRYPTION_KEY`,
  shared with payment-provider secret key encryption - see `src/lib/encryption.ts`)
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

## Permissions

There's no full RBAC system - just the three `tenant_member_role` values
(`owner`/`admin`/`member`) plus a seeded `permissions` table
(`products.view`, `products.edit`, `payments.manage`) and a
`tenant_member_permissions` join table. Permissions are granted **once**, at
`tenant_member` creation time, based on a static role → permission mapping in
`src/modules/permissions/lib/permissions.ts` (owner/admin get all three,
member gets `products.view` only) — they are not derived live from role on
every check, so a future per-member permission override doesn't need a schema
change. `app.requireTenantPermission(key)` and `app.requireTenantRole(roles)`
(registered by `src/plugins/tenant-access.ts`) are Fastify preHandlers that
read `:tenantId` from the route params, confirm the authenticated user is a
member of that tenant, and check the permission/role — used as
`{ preHandler: [app.authenticate, app.requireTenantPermission("products.edit")] }`.

## Commerce: products, cart, checkout, payments

### Tenant sites and subdomains

- `PATCH /tenants/:tenantId` (owner-only) sets `{ subdomain, published }`.
  `subdomain` is validated against a format pattern and a reserved list
  (`www`, `api`, `admin`, `app`, `mail`, `status`, `blog`, `help`, `docs`,
  `cdn`, `assets` by default — override via `RESERVED_SUBDOMAINS`) and
  uniqueness (case-insensitive) before being set. `published` toggles
  `tenant_site_config.published_at`.
- `GET /public/sites/:subdomain` is public and unauthenticated. It 404s with a
  stable `{ error: "site_not_found" }` shape — indistinguishable whether the
  subdomain doesn't exist, has no site config, or isn't published — and
  otherwise returns `{ tenant, theme, sections, products }` (published
  products only). `theme`/`sections` are opaque JSON stubs on
  `tenant_site_config` — there's no storefront-builder editor behind them in
  this task; see Known gaps.

### Products

`GET/POST/PATCH/DELETE /tenants/:tenantId/products` — tenant-scoped, gated by
`products.view` (read) or `products.edit` (write). Prices are always integer
`price_cents`; there's no endpoint to change status without going through the
normal PATCH (setting `status: "published"` is what makes a product appear in
`GET /public/sites/:subdomain`).

### Cart

Guest carts, no shopper auth. `POST /public/sites/:subdomain/cart` creates a
cart and sets an httpOnly `cart_token_{subdomain}` cookie — **one cookie per
tenant subdomain**, not a single shared cookie, since a shopper can browse
multiple tenant storefronts from the same browser against the same API host
and their carts must not collide. The cookie stores an opaque token; only its
SHA-256 hash is persisted (`carts.cart_token`), same pattern as refresh
tokens. `POST .../cart/items` upserts (adds to existing quantity rather than
duplicating a line) and rejects a product that's missing or not `published`.
Every cart mutation returns the full recomputed cart
(`{ id, items, subtotalCents, currency }`) so the frontend never has to
recompute money client-side from partial data.

### Checkout

`POST /public/sites/:subdomain/checkout` — rate-limited per IP
(`CHECKOUT_RATE_LIMIT_PER_MINUTE`, default 10/min) via the same Redis
fixed-window limiter auth uses. Rejects an empty cart or a cart containing a
since-unpublished item (`cart_empty` / `cart_has_unpublished_items`), then:
creates the `order` + `order_items` (snapshotting name and price at that
moment — never recomputed from live product data later), initializes a
transaction with the tenant's configured `PaymentProvider`, stores the
returned reference on the order, deletes the cart, and returns
`{ orderId, orderNumber, checkoutUrl }`.

`GET /public/sites/:subdomain/checkout/:orderId/status` is the landing point
for the provider's redirect. It never trusts the redirect's query params: if
the order is still `pending` and has a `payment_reference`, it calls
`provider.verifyTransaction()` server-side before ever reporting (or
persisting) anything other than `pending`.

### Payments

`PaymentProvider` (`src/modules/payments/lib/provider.ts`) is implemented by
`PaystackProvider` and `FlutterwaveProvider` — `initializeTransaction`,
`verifyTransaction`, `verifyWebhookSignature`. Both call the real
Paystack/Flutterwave HTTP APIs with native `fetch`, no SDK dependency.

- **Settings**: `GET/PUT /tenants/:tenantId/payment-settings`, gated by
  `payments.manage`. `GET` never returns the secret key — only
  `{ provider, mode, enabled, hasSecretKey, publicKey }`. `PUT` encrypts the
  secret key immediately (AES-256-GCM, `src/lib/encryption.ts` — the same
  helper TOTP secrets use) before it ever reaches the database.
- **Webhooks**: `POST /webhooks/paystack` and `POST /webhooks/flutterwave` are
  unauthenticated by design (no session exists to authenticate) and instead
  trust only a verified signature:
  - Paystack: HMAC-SHA512 of the **raw** request body (captured via a
    content-type-parser override scoped to just this route's plugin context,
    so the rest of the app keeps normal JSON parsing) keyed with the tenant's
    secret key, compared to `x-paystack-signature`.
  - Flutterwave: the `verif-hash` header compared directly to the tenant's
    configured secret key value.
  - Both comparisons are constant-time (`src/modules/payments/lib/constant-time.ts`,
    wrapping `crypto.timingSafeEqual`).
  - The tenant (and therefore which secret key to verify against) is resolved
    by looking up the order via the payload's transaction reference **before**
    verifying the signature — there's no tenant identifier in the webhook URL
    itself, so this lookup has to come first. If no order matches the
    reference, the request is rejected outright (400) with no processing.
  - Idempotency: each event is inserted into `payment_webhook_events` via
    `INSERT ... ON CONFLICT (provider, event_reference) DO NOTHING`; if that
    insert affects zero rows (the event was already recorded — a replay or a
    concurrent duplicate delivery that won the race), the handler
    acknowledges `200` without calling `verifyTransaction` or touching the
    order again.
  - An order only ever transitions `pending → paid` (or `→ failed`) via a
    conditional `UPDATE ... WHERE status = 'pending'` — so a webhook and a
    concurrent status-poll re-verification can't double-process the same
    order, and nothing is ever marked paid without a provider-verified
    transaction (`verifyTransaction`, not just a webhook body's claimed
    status or a redirect's query params).
  - On confirmed payment: a confirmation email is sent (reusing the existing
    `sendEmail` stub). There is a clearly marked call site
    (`src/modules/checkout/lib/orders.ts`, `markOrderPaid`) for a future
    WhatsApp order notification — deliberately not implemented in this task.

### Known gaps (flagged, not silently skipped)

- The generated Drizzle migrations (`packages/db/drizzle/0000_*.sql`,
  `0001_*.sql`) have **not** been applied or verified against a live Postgres
  instance — there's no database available in this environment. Run
  `pnpm --filter @platform/db db:migrate` against a real `DATABASE_URL` before
  relying on this schema.
- Vitest coverage here mocks `@platform/db` and Redis (via `ioredis-mock`); there
  is no integration-tier suite exercising a real Postgres/Redis end to end, since
  neither is available in this environment. Add a Docker/testcontainers-based
  suite before treating this as full coverage.
- `verifyCurrentMfaCode` (used for the disable/regenerate-backup-codes re-auth
  bar) only checks TOTP and backup codes, not email OTP — a user enrolled in
  email OTP only cannot currently re-authenticate with an emailed code for
  those two actions (pre-existing limitation, not introduced by the email-OTP
  enrollment endpoints added here).
- Re-registering with an already-registered email sends a same-shaped `202`
  response and a "someone tried to sign up with your email" notice to the
  existing address, but nothing rate-limits that notice email — repeated
  requests against the same existing email will re-send it every time.
- `tenant_site_config.theme`/`sections` are opaque JSON blobs with **no
  editor** behind them - there's no storefront-builder backend yet in this
  task's scope, so the only way to make `GET /public/sites/:subdomain` return
  something is the `published` toggle on `PATCH /tenants/:tenantId`. Treat
  the shape of `theme`/`sections` as provisional until that task lands.
  Similarly, there's no endpoint to invite additional tenant members in this
  task's scope, so `admin`/`member`-role permission grants
  (`src/modules/permissions/lib/permissions.ts`) are defined but currently
  unreachable in practice — only the `owner` path (registration) runs today.
- Paystack/Flutterwave integration is implemented against their public API
  docs but has **not** been exercised against live (or sandbox) provider
  accounts — there's no way to obtain test credentials in this environment.
  Get a real Paystack/Flutterwave test account and run an end-to-end
  checkout before relying on this in production.
- Flutterwave webhook verification compares `verif-hash` to the tenant's API
  secret key (decrypted), per this task's schema, which only has one secret
  field (`tenant_payment_settings.secret_key_encrypted`). Flutterwave
  actually lets you configure a distinct webhook "secret hash" separate from
  your API secret key; reusing the API secret key as the webhook hash works
  but means anyone who could forge a valid API secret key could also forge
  webhooks. Add a dedicated `webhook_secret_hash` column before this handles
  real money if that distinction matters for your threat model.
- The checkout rate limit is a simple fixed-window per-IP counter (same
  primitive as the login/2FA rate limits) - it doesn't distinguish a shopper
  behind a shared/CGNAT IP from an actual card-testing bot, and doesn't rate
  limit per-tenant or per-card. Treat it as a first line of defense, not a
  complete anti-fraud system.

## Commerce UI: merchant dashboard + published storefront

### `apps/storefront` `/dashboard` (merchant dashboard)

Lives at `/dashboard/*` on the main domain of the storefront Next.js app —
same origin as the tenant's public site, so the store-owner's Better Auth
session cookie carries through. A `DashboardLayout` shell (sidebar +
`{children}`) adds five sections behind the auth screens
(`/dashboard/{login,signup,forgot-password,reset-password,2fa/verify}`):
**Products** (list with published/draft filter, create/edit form, delete
with a plain confirm dialog), **Orders** (list + detail, read-only),
**Payment settings** (provider/keys/mode — saving `mode: "live"` reuses
`ReauthModal` as a money-movement gate, requiring password always and a 2FA
code only if the merchant actually has 2FA enabled, since unlike the
disable-2FA flow this can't assume 2FA is already on), and **Site settings**
(subdomain, publish toggle, and a standalone "show product grid on
storefront" toggle — see below). The middleware naturally 404s `/dashboard`
on a tenant subdomain (it rewrites to `/sites/[subdomain]/dashboard`, which
has no route), so the dashboard is main-domain-only.

### `apps/admin` (Platform Admin)

Vite + React SPA for super-admin work — tenant management, config, reserved
subdomains, feature flags. Talks to its own isolated Better Auth instance
(`/platform-admin/auth/*`, cookie prefix `platform_admin`) so it can't get
confused with a tenant-member session. Deliberately no store-owner UI here.

### `apps/storefront` (Next.js, published storefront)

`src/middleware.ts` reads the `Host` header, resolves it to a tenant
subdomain (`src/lib/subdomain.ts` — a pure, unit-tested function, kept
separate from the `NextRequest`-specific middleware wrapper), and rewrites to
`/sites/{subdomain}/...`. Note the route folder is `app/sites`, **not**
`app/_sites` — Next.js treats any `_`-prefixed folder as a private,
routing-excluded folder, so a `_sites` tree would silently 404 everything the
middleware rewrites to.

`app/sites/[subdomain]/layout.tsx` fetches `GET /public/sites/:subdomain`
server-side and calls `notFound()` for anything unpublished/missing, which
renders the sibling `not-found.tsx` — a branded "this site isn't available"
page, not the framework default. Cart state (`CartContext`) is backed by the
`cart_token_{subdomain}` cookie and drives a persistent mini-cart drawer
(`MiniCart`) in the header. The checkout page is a contact form
(react-hook-form + the shared `checkoutRequestSchema`) that redirects to the
provider's hosted checkout URL; the order-status page
(`/sites/[subdomain]/order/[orderId]/status`) polls
`GET .../checkout/:orderId/status` on an interval until it resolves to
`paid`/`failed` rather than trusting the provider redirect's query params,
consistent with how the backend itself never trusts them.

Money is formatted from integer cents at the UI layer only (`lib/money.ts` in
both apps) — no cart/order arithmetic happens client-side; totals always come
from the API response.

### Known gaps (Commerce UI)

- No custom-domain UI, no inventory display, no discount codes, and no saved
  customer accounts/order history — checkout is guest-only, per this task's
  explicit scope.
- Tenant switching isn't implemented: `AuthContext.currentTenant` is just
  `tenants[0]` from `GET /auth/me` — a user who somehow belongs to more than
  one tenant only ever sees the first.
