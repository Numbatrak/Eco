# Platform Auth Hardening — Plan & Claude Code Prompts

**Scope:** get Tenant Auth (`apps/storefront`) and Platform Admin Auth (`apps/admin`) fully solid, before Numbatrak lands as the 4th app and starts leaning on the same `organization`/`member` model. Numbatrak migration itself is out of scope here — Phase 4 is just the bridge notes so Phase 1 doesn't quietly make decisions that are expensive to unwind later.

Adjust file paths below if your actual folder names differ from the `apps/*` / `packages/*` convention implied by the package names (`@platform/api`, `@platform/storefront`, `@platform/admin`, `@platform/db`).

---

## Why start with an audit

Both auth systems have full table sets already (`session`, `account`, `verification`, `two_factor` on both sides) — that's schema, not proof the flows are wired. Your uncommitted changes are on orders/checkout, which suggests auth was scaffolded earlier and may be partially stubbed. Don't build Phase 1–3 on assumptions about what exists; find out first.

---

## Phase 0 — Audit current state (run this first)

```
You're working in the `platform` monorepo (pnpm + Turborepo). Before any auth
changes, audit the current state of authentication across apps/api,
apps/storefront, and apps/admin. Do not change any code in this pass —
report only.

1. In apps/api: which better-auth instances exist, their config (baseURL,
   trustedOrigins, plugins enabled — organization, two-factor, etc.), and
   which auth-related routes/handlers are implemented vs. only referenced.

2. In apps/storefront: which pages/routes under /dashboard/* exist for
   login, signup, password reset, 2FA setup/verify, organization creation,
   and team invites. Which render a real form vs. a placeholder. Is there
   middleware protecting /dashboard/* from unauthenticated access? Does it
   redirect users with no active_organization_id to an onboarding step?

3. In apps/admin: which login/2FA screens exist for platform_admin_user.
   Is there a bootstrap/seed script for creating the first platform admin
   (there's presumably no public signup for this)? Can an admin reach any
   protected screen without completing 2FA?

4. Is anything actually writing to security_events yet, or does the table
   exist with nothing populating it?

5. Is anything writing to pa_audit_log yet on admin mutations?

Output a short markdown report, one section per app, listing DONE /
PARTIAL / MISSING for each item with file paths.
```

Read the output before starting Phase 1 — it'll tell you whether to run Phase 1/2 in parallel or in sequence, and may make some of the prompts below redundant.

---

## Phase 1 — Tenant Auth (storefront)

### 1a. Signup + org bootstrap

```
In apps/storefront, under /dashboard, implement (or complete) signup:

- Email/password signup via the better-auth client, against the tenant
  auth instance in apps/api.
- On success, auto-create an organization (name from a "business name"
  field on the form, slug generated and checked against organization.slug
  for uniqueness — slug doubles as the storefront subdomain), and a
  member row with role 'owner'.
- Set that organization as the session's active_organization_id.
- Redirect to /dashboard.

Handle slug collisions by suggesting an alternate slug rather than failing
silently. Add Vitest coverage: successful signup + org creation, duplicate
email, slug-collision fallback.
```

### 1b. Login + session + org switching

```
Complete the login flow in apps/storefront:

- Email/password login against the tenant better-auth instance.
- If the logged-in user belongs to more than one organization (via
  member), show an org switcher before entering /dashboard. If exactly
  one, set it as active_organization_id automatically.
- Add middleware (or a layout-level guard) on /dashboard/* that redirects
  to /login with no valid session, and to an org-creation step if the
  session has no active_organization_id.
- Log a security_events row on every attempt — event_type 'login_success'
  or 'login_failed', keyed to user_id (nullable on failure if the email
  doesn't resolve to a user).
```

### 1c. Two-factor (TOTP + email OTP)

```
Wire up 2FA for tenant users in apps/storefront, using the two_factor
table and better-auth's 2FA plugin already reflected in the schema
(two_factor_enabled on user; secret / backup_codes / verified /
locked_until on two_factor):

- A settings page to enroll: generate a TOTP secret + QR code, verify
  with a 6-digit code, show backup codes once.
- An email-OTP fallback path for users who prefer it over an
  authenticator app.
- Enforce locked_until — lock further attempts for a short window after
  repeated failures. Log security_events rows for '2fa_enrolled',
  '2fa_verified', and '2fa_failed'.

Keep this optional for regular tenant users (recommended for the org
owner, not mandatory). Platform admin 2FA is mandatory — that's a
separate system, handled in Phase 2.
```

### 1d. Team invites

```
Complete the invite flow using the invitation table:

- From /dashboard/settings/team, an owner/admin invites by email + role.
  Creates an invitation row (organization_id, inviter_id, email, role,
  status: 'pending').
- Send the invite email, or log it to console in dev if email isn't wired
  yet — note explicitly which.
- Accept flow: if the invited email already has a user account, log in
  and attach a member row to the INVITING organization (not a new one)
  with the invited role, then mark the invitation accepted. If no
  account exists, route through signup first, then attach the same way.
- Handle expired or already-accepted invitations with a clear error
  state, not a silent failure.
```

---

## Phase 2 — Platform Admin Auth (admin app)

### 2a. Bootstrap the first admin

```
In apps/api, write a one-off script (e.g. scripts/bootstrap-platform-
admin.ts, run via pnpm --filter api exec tsx scripts/...) that creates the
first platform_admin_user from env vars or CLI args (email, name, temp
password) — there's no public signup path for platform admins. Print a
clear success message with the login URL. Make it idempotent: safe to
re-run without creating a duplicate if the email already exists.
```

### 2b. Admin login with mandatory 2FA

```
In apps/admin, complete login against the platform-admin better-auth
instance — fully separate from tenant auth: separate cookie name/domain,
separate secret.

- Email/password login.
- If two_factor_enabled is false for this admin, force enrollment before
  granting access to any admin screen — no bypass path.
- If true, require a valid code every login. No "remember this device"
  at this stage — that's a deliberate omission, not an oversight: this is
  the account that can impersonate any tenant.
- Every route under the admin app's protected layout must hard-check for
  a valid, 2FA-verified pa_session server-side, not just client-side.
```

### 2c. Audit log wiring

```
Add an audit-logging helper (apps/api, or packages/db if shared logic
lives there) that writes a pa_audit_log row (admin_id, action,
target_type, target_id, details jsonb) on every mutating action taken by
a platform admin — starting with whatever already exists in the API's
Platform Admin module (credit adjustments, reserved subdomains, feature
flags). Wire it as middleware/hook around admin mutations rather than a
manual call at each site, so new admin actions get logged by default.
```

---

## Phase 3 — Cross-cutting auth infrastructure

### 3a. Cookie / domain isolation

```
Review and document (a short AUTH.md at repo root) how cookies are scoped
across the three surfaces: /dashboard/* (tenant auth, authenticated
merchant), /sites/[subdomain]/* (no auth — customer-facing, cart-token
based), and apps/admin (platform admin auth). Confirm:

- The tenant-auth cookie's domain doesn't leak onto customer-facing
  tenant subdomains — a customer browsing tenant1.yourdomain.com
  shouldn't receive or need a tenant session cookie at all.
- The platform-admin cookie name/domain is distinct enough from the
  tenant-auth cookie that having both apps open locally or in staging
  can't cross-contaminate a session.
- trustedOrigins in both better-auth configs lists exactly what should be
  allowed (dev ports, staging, prod domain + wildcard subdomain pattern
  for tenant sites) — nothing wider.

Fix anything that doesn't hold. Record the reasoning in AUTH.md.
```

### 3b. Test coverage

```
Add Vitest coverage for both auth systems' happy and unhappy paths:
tenant signup, tenant login (wrong password, locked-2FA), invite-accept,
and platform-admin login with mandatory 2FA. Use the existing Testing
Library setup. These should run in CI as a gate before anything
auth-adjacent merges.
```

---

## Phase 4 — Numbatrak bridge (planning only — don't build yet)

Two things worth knowing now so Phase 1 doesn't box you in:

**Super Admin is already solved.** Numbatrak's Feature 25 (Super Admin
Dashboard) spec calls for founder-only access, completely separate
authentication, mandatory 2FA — that's precisely `apps/admin` +
`platform_admin_*` as they already exist. When Numbatrak lands, its Super
Admin becomes new tabs inside `apps/admin` reading Numbatrak-specific
data. No new auth system needed there.

**The role model doesn't fit yet.** Numbatrak's spec assumes six roles
(CRS, Manager, Admin, Media, Accountant, Founder) with a person able to
hold more than one and get the union of access. `member.role` today is a
single-role field via better-auth's org plugin. If Phase 1 hardcodes
"one role per member" and storefront accumulates real data on that
assumption, migrating to multi-role later is a real data migration, not
a schema tweak. Worth a look now, before that data exists.

Spike prompt (investigate only — no build):

```
Look at how better-auth's organization plugin implements roles and
permissions (packages/db schema + org plugin config in apps/api). Report
whether it supports multiple roles per member natively, or only a single
role string. If single-role only, sketch two options:

(a) a member_roles join table (member_id, role) alongside the existing
    single `role` column kept as the "primary" role, or
(b) migrating `role` to a text[] / jsonb array.

Note the migration cost of each against existing member rows, given
storefront will have real production data in this table before Numbatrak
needs multi-role. Don't implement — report findings and a recommendation.
```

Two smaller notes, no action needed: Numbatrak's `customers` and
`agents` are both meant to be unauthenticated records, not logins — which
matches how `customers` already works in this schema (no auth fields on
it at all). And Numbatrak's "agent" concept (external delivery partner)
maps to nothing here yet — it's not `member` and not `customers`; when
that migration comes, it'll likely be its own tenant-scoped table with no
auth relationship, same pattern.

---

## Suggested order

1. Run Phase 0. Read the output.
2. Phase 1 and Phase 2 don't depend on each other — run in either order,
   or split across two Claude Code sessions in parallel.
3. Phase 3 last — it's reviewing/hardening what 1 and 2 just built.
4. Phase 4 is a read, not a task — revisit it once you're actually
   scoping the Numbatrak migration.
