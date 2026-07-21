# Role mapping — spec vs current app

Reference: `Numbatrak_Feature_Spec_WORKING - New.pdf` (Staff Management, Dashboard role scope, Orders).

Until the **Staff Management** suite (spec §7–11) ships with multi-role union, the app uses **org membership roles** from `organization_members.role`. This document is the interim mapping for stabilization and RBAC checks.

## Current app roles

| App role (`UserRole`) | Spec role | Data scope (orders, dashboard, follow-ups) |
|----------------------|-----------|---------------------------------------------|
| Customer Relations | CRS | **Own** — only their assigned orders and follow-ups |
| Manager | Manager | **Team** — team view (today: org-wide operational data; team hierarchy when HR lands) |
| Admin | Admin | **Org + money** — all orders, expenses, wallet, dashboard KPIs |
| Owner | Founder | **Org + money** — same as Admin plus member/role management |

Implementation: `src/utils/specRoles.ts` — `orderDataScope()`, `canViewOrgMoney()`, `csrScopeFilter()`.

## Spec roles not yet in membership

| Spec role | Interim behavior |
|-----------|------------------|
| Media | Treated as Admin/Owner for nav until Media Buyers module exists |
| Accountant | Wallet remittance ping is notification-only; no separate login role yet |

## Permission matrix

Authoritative matrix: `src/utils/permissions.ts` (resource × action per app role).

When adding a gated action:

1. Check `permissions.ts` for the resource/action.
2. Apply `orderDataScope()` / `csrScopeFilter()` on **queries**, not only UI hiding.
3. RLS remains the security boundary on Supabase tables.

## Future: multi-role union (Phase Next)

Spec rule: staff hold one **primary** role plus optional **extra** roles; access is the **union** of all roles held.

When Staff (§7) ships:

- Extend `organization_members` or link to `staff` records.
- Replace single `role` string with role set.
- Update `getPermissions()` to merge permission matrices.
- Wire Media → Media Buyers nav; Accountant → wallet oversight notifications.

## Dashboard widget visibility (current)

| Widget / section | CRS | Manager | Admin | Owner |
|------------------|-----|---------|-------|-------|
| DashboardSummary money KPIs (CPA, ROAS, ROI) | Hidden | Shown | Shown | Shown |
| NewOrders / AbandonedCarts widgets | Shown | Hidden | Hidden | Hidden |
| LatestDeliveries / ActivityFeed | Shown | Shown | Shown | Shown |
| DeliveryRateByLocation | Hidden | Shown | Shown | Shown |
| Wallet | Hidden | Shown | Shown | Shown |

See `src/components/dashboard/DashboardPage.tsx` and `DashboardSummary.tsx`.
