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
- `packages/db` is the only package that talks to Postgres. Auth tables and real
  schema land in a follow-up task.

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
# Eco
