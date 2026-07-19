# Authentication Architecture

This platform uses two **fully isolated** Better Auth instances on the same
API server and PostgreSQL database. They share no session rows, no cookies,
and (in production) should use separate signing secrets.

## Auth instances

| Property | Tenant Auth | Platform Admin Auth |
|---|---|---|
| Purpose | Merchant dashboard (`/dashboard/*`) | Super-admin console (`apps/admin`) |
| Users table | `user` | `platform_admin_user` |
| Session table | `session` | `platform_admin_session` |
| Cookie prefix | `better-auth` (default) | `platform_admin` |
| Session cookie | `better-auth.session_token` | `platform_admin.session_token` |
| Base path | `/api/auth` | `/platform-admin/auth` |
| Signing secret env | `BETTER_AUTH_SECRET` | `PLATFORM_ADMIN_AUTH_SECRET` (falls back to `BETTER_AUTH_SECRET`) |
| Plugins | `organization` + `twoFactor` | `twoFactor` only |
| Public signup | Yes (`/dashboard/signup`) | Blocked — CLI only (`create-admin-account`) |
| 2FA | Optional for tenant users | Mandatory, enrolled at account creation |
| Trusted origins | `PUBLIC_APP_URL`, `STOREFRONT_APP_URL` | `PUBLIC_APP_URL` only |

## Cookie isolation

The two instances produce cookies with **different names** due to distinct
`cookiePrefix` values. Even when both apps run on the same domain (e.g.
`localhost` in development), the cookies don't collide:

- Tenant: `better-auth.session_token`
- Admin: `platform_admin.session_token`

**Production checklist:**

1. Set `PLATFORM_ADMIN_AUTH_SECRET` to a value **different** from
   `BETTER_AUTH_SECRET`. This prevents a token signed by one instance from
   passing signature validation in the other. (In dev, sharing a single
   secret is acceptable — practical isolation via separate table lookups
   still holds.)
2. Better Auth defaults to `httpOnly: true` and `sameSite: lax`. In
   production with HTTPS, `secure: true` is auto-detected from the
   `baseURL` scheme. Verify that `BETTER_AUTH_URL` starts with `https://`
   in production.

## Customer-facing storefronts (`/sites/[subdomain]/*`)

Storefront shoppers are **not authenticated**. They interact via:

- A `cart_token` cookie (set by the cart API, scoped per subdomain)
- Customer records in the `customers` table (created at checkout, no
  password or login)

The tenant session cookie (`better-auth.session_token`) is set on the
main domain's `/dashboard/*` path. It should **not** leak to subdomain
storefronts because:

- Browser requests to `tenant.yourdomain.com` don't send cookies scoped
  to `yourdomain.com/dashboard` (path-scoped cookies).
- Better Auth's default `sameSite: lax` prevents the cookie from being
  sent on cross-origin subrequests.

If you configure a wildcard cookie domain (e.g. `.yourdomain.com`), the
tenant session cookie would become visible on subdomains. Don't do this.

## Server-side auth guards

### Tenant dashboard (Next.js middleware)

`apps/storefront/src/middleware.ts` checks for the `better-auth.session_token`
cookie on all `/dashboard/*` requests. Unauthenticated requests are
redirected to `/dashboard/login`. Guest-only pages (`/dashboard/login`,
`/dashboard/signup`, `/dashboard/forgot-password`, `/dashboard/reset-password`)
redirect authenticated users to `/dashboard`. The 2FA verification flow
(`/dashboard/2fa/*`) is exempted.

This is a **fast first-pass** check (cookie presence, not validity).
Client-side `RequireAuth` / `RequireGuest` guards handle expired or
invalid sessions by calling `/auth/me` and redirecting on 401.

### Platform admin API

Every route under `/platform-admin/*` (except the login endpoint) uses the
`requirePlatformAdminAuth` Fastify preHandler, which calls
`platformAdminAuth.api.getSession()`. Better Auth's 2FA plugin does not
issue a full session until TOTP verification completes, so no admin can
reach a protected endpoint without completing 2FA.

## Security event logging

### Tenant auth → `security_events`

Events logged: `login_success`, `login_failed`, `2fa_challenge_issued`,
`password_reset_requested`, `password_reset_completed`, `sessions_revoked`.

Via Better Auth after-hooks: `2fa_enabled`, `2fa_disabled`, `2fa_verified`,
`backup_code_used`, `backup_codes_regenerated`.

**Known gap:** `2fa_failed` cannot be logged through Better Auth's hook
system — the `after` middleware only fires on successful responses. A
custom plugin wrapper would be needed to capture verification failures.

### Platform admin → `platform_admin_audit_log`

All 7 mutation routes (suspend/reactivate tenant, update plan, adjust
credits, toggle feature flags, update settings, manage reserved subdomains)
log via `logPlatformAdminAction()`.

Login events: `login_success`, `login_failed`, `login_rate_limited` are
logged with IP and email in the audit log's `details` JSONB field.

## Access control (RBAC)

Four roles: `owner` > `admin` > `editor` > `viewer`.

- `owner`: full access including billing, org deletion, and member management
- `admin`: same as owner minus org deletion and access-control management
- `editor`: products and collections only
- `viewer`: read-only access to products, collections, orders, billing

Defined in `apps/api/src/lib/access-control.ts` using Better Auth's
`createAccessControl`. The organization plugin enforces these on its own
endpoints (invite/remove/update-member-role). Custom routes use
`requireOrgPermission()` from `apps/api/src/plugins/org-access.ts`.

## Multi-role support (investigation — Phase 4)

**Finding:** Better Auth's organization plugin natively supports multiple
roles per member as of the version used in this project. No schema
migration is required.

### How it works

The `member.role` column is a single `text` field. When multiple roles are
assigned, they are **comma-joined** and stored as one string (e.g.
`"admin,editor"`).

- **API input:** `addMember`, `updateMemberRole`, and `createInvitation`
  all accept `string | string[]` for the `role` field. An array like
  `["admin", "editor"]` is joined to `"admin,editor"` before storage.
- **Permission checking:** `hasPermission` splits the comma-delimited
  string back into an array and checks each role. Access is granted if
  **any** role in the list has the requested permission (logical OR).
- **Role mutation:** `updateMemberRole` normalizes input via
  `flatMap(r => r.split(",")).map(r => r.trim()).filter(Boolean)`, so
  mixed formats (arrays, comma-strings, single strings) all work.

### Migration options (not needed — native support exists)

Two options were evaluated in case native support did not exist:

| Option | Approach | Migration cost |
|---|---|---|
| **(a) Join table** | `member_roles(member_id, role)` alongside existing `role` column | New table + migration of existing rows. Every query touching roles needs a join. Better Auth's internal role checks would need a plugin override. High cost. |
| **(b) Array column** | Change `role` from `text` to `text[]` or `jsonb` | Column migration + rewrite of every `WHERE role = ?` query. Better Auth's `parseRoles`/`split(",")` internals would break. High cost. |

**Recommendation:** Use the existing comma-delimited approach. It is how
Better Auth works internally, requires zero migration, and permission
checks already iterate over all roles.

### Application-code caveat

One place in the storefront does a direct string comparison on `role`:

```
const canManageMembers = activeOrganization.role === "owner" || activeOrganization.role === "admin";
```

If multi-role is enabled, this check would fail for a member with role
`"owner,editor"`. The fix is to split on commas before checking:

```typescript
const roles = activeOrganization.role.split(",");
const canManageMembers = roles.includes("owner") || roles.includes("admin");
```

This is the only such check in `apps/storefront`. The API side uses
Better Auth's `hasPermission` which already handles comma-delimited roles
correctly. No fix is needed today (multi-role is not actively used), but
this should be addressed before assigning multiple roles to any member.
