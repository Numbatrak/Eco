import { describe, it, expect, afterEach } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { truncateAll } from "../../../test/test-db.js";
import { signUpOwnerWithOrg, addUserToOrgWithRole } from "../../../test/auth-helpers.js";
import { numbatrakCustomerOrders, numbatrakAdSpend } from "@platform/db";
import numbatrakPayrollRoutes from "./../routes/index.js";
import numbatrakStaffRoutes from "../../numbatrak-staff/routes/index.js";

/**
 * Tier B (real Postgres via TEST_DATABASE_URL) - exercises the payroll
 * lifecycle end-to-end through the actual HTTP routes: pay-structure setup,
 * running a month, the manager team-ratio gate scoped to real direct
 * reports (not org-wide), media-buyer commission from ad_spend, closing a
 * period (every mutating action rejects), payment snapshotting, and the
 * cross-tenant line-ownership check.
 *
 * Split into several focused tests (rather than one long chain) because
 * this environment has no local Postgres - TEST_DATABASE_URL points at a
 * remote Neon branch, and one test doing 60+ sequential round trips proved
 * flaky against real network latency. Each test below re-does its own
 * setup, trading a bit more total wall-clock for a much smaller, more
 * reliable per-test round-trip count.
 */
async function setUpApp() {
  const redis = new RedisMock() as unknown as RedisClient;
  const app = await buildTestApp({ redis, routes: [numbatrakPayrollRoutes, numbatrakStaffRoutes] });
  return app;
}

describe("payroll lifecycle", () => {
  afterEach(async () => {
    await truncateAll();
  });

  it(
    "scopes the manager bonus gate to real direct reports, and pays media buyers off their own ad spend",
    async () => {
      const app = await setUpApp();
      const owner = await signUpOwnerWithOrg();
      const ownerCookie = owner.headers.get("cookie") ?? "";

      const managerMember = await addUserToOrgWithRole(owner.orgId, "manager");
      const inTeamMember = await addUserToOrgWithRole(owner.orgId, "csr");
      const outTeamMember = await addUserToOrgWithRole(owner.orgId, "csr");
      const buyerMember = await addUserToOrgWithRole(owner.orgId, "admin");

      const managerStaff = (
        await app.inject({
          method: "POST",
          url: "/org/numbatrak/staff",
          headers: { cookie: ownerCookie },
          payload: { userId: managerMember.userId, primaryRole: "Manager" },
        })
      ).json();

      // In-team CRS reports to the manager; out-of-team CRS deliberately
      // has NO managerId - not this manager's report.
      await app.inject({
        method: "POST",
        url: "/org/numbatrak/staff",
        headers: { cookie: ownerCookie },
        payload: { userId: inTeamMember.userId, primaryRole: "CRS", managerId: managerStaff.id },
      });
      await app.inject({
        method: "POST",
        url: "/org/numbatrak/staff",
        headers: { cookie: ownerCookie },
        payload: { userId: outTeamMember.userId, primaryRole: "CRS" },
      });
      const buyerStaff = (
        await app.inject({
          method: "POST",
          url: "/org/numbatrak/staff",
          headers: { cookie: ownerCookie },
          payload: { userId: buyerMember.userId, primaryRole: "Media" },
        })
      ).json();

      await app.inject({
        method: "POST",
        url: "/org/numbatrak/payroll/structures",
        headers: { cookie: ownerCookie },
        payload: {
          scopeType: "role",
          role: "Manager",
          managerBonusEnabled: true,
          managerBonusAmount: 10000,
          managerGateEnabled: true,
          managerGateTeamRatioPercent: 100,
          managerGateKpiThresholdPercent: 50,
        },
      });
      await app.inject({
        method: "POST",
        url: "/org/numbatrak/payroll/structures",
        headers: { cookie: ownerCookie },
        payload: { scopeType: "role", role: "Media", commissionEnabled: true, commissionBasis: "flat_per_order", commissionRate: 200 },
      });

      const month = "2026-06";
      const db = app.getDb();
      // In-team CRS delivers 1/1 (100%, clears 50% KPI). Out-of-team CRS
      // delivers 0/1 (0%, misses it) - if the gate wrongly counted CRSs
      // org-wide instead of just direct reports, this would drag the ratio
      // to 50% and fail the 100%-required gate.
      await db.insert(numbatrakCustomerOrders).values({
        organizationId: owner.orgId,
        csrId: inTeamMember.userId,
        status: "delivered",
        createdAt: new Date(`${month}-10T00:00:00Z`),
      });
      await db.insert(numbatrakCustomerOrders).values({
        organizationId: owner.orgId,
        csrId: outTeamMember.userId,
        status: "pending",
        createdAt: new Date(`${month}-10T00:00:00Z`),
      });
      await db.insert(numbatrakAdSpend).values({
        organizationId: owner.orgId,
        buyerId: buyerMember.userId,
        spendDate: `${month}-05`,
        spend: "1000",
        orders: 7,
      });

      const runResponse = await app.inject({
        method: "POST",
        url: "/org/numbatrak/payroll/run",
        headers: { cookie: ownerCookie },
        payload: { month },
      });
      expect(runResponse.statusCode).toBe(200);
      const run = runResponse.json();
      const managerLine = run.lines.find((l: any) => l.staffId === managerStaff.id);
      const buyerLine = run.lines.find((l: any) => l.staffId === buyerStaff.id);

      expect(managerLine.managerGateMissed).toBe(false);
      expect(managerLine.calculatedManagerBonus).toBe(10000);
      expect(buyerLine.calculatedCommission).toBe(1400);
    },
    120000,
  );

  it(
    "closes a period, rejects every mutating action, and blocks cross-tenant line access",
    async () => {
      const app = await setUpApp();
      const owner = await signUpOwnerWithOrg();
      const ownerCookie = owner.headers.get("cookie") ?? "";
      const crs = await addUserToOrgWithRole(owner.orgId, "csr");

      await app.inject({
        method: "POST",
        url: "/org/numbatrak/staff",
        headers: { cookie: ownerCookie },
        payload: { userId: crs.userId, primaryRole: "CRS" },
      });
      await app.inject({
        method: "POST",
        url: "/org/numbatrak/payroll/structures",
        headers: { cookie: ownerCookie },
        payload: { scopeType: "role", role: "CRS", baseSalaryEnabled: true, baseSalaryAmount: 50000 },
      });

      const month = "2026-06";
      const runResponse = await app.inject({
        method: "POST",
        url: "/org/numbatrak/payroll/run",
        headers: { cookie: ownerCookie },
        payload: { month },
      });
      const line = runResponse.json().lines[0];

      const closeResponse = await app.inject({
        method: "POST",
        url: `/org/numbatrak/payroll/run/${month}/close`,
        headers: { cookie: ownerCookie },
      });
      expect(closeResponse.statusCode).toBe(200);
      expect(closeResponse.json().status).toBe("closed");

      const rerun = await app.inject({ method: "POST", url: "/org/numbatrak/payroll/run", headers: { cookie: ownerCookie }, payload: { month } });
      expect(rerun.statusCode).toBe(400);

      const overrideAttempt = await app.inject({
        method: "PATCH",
        url: `/org/numbatrak/payroll/lines/${line.id}/override`,
        headers: { cookie: ownerCookie },
        payload: { overrideBaseSalary: 999 },
      });
      expect(overrideAttempt.statusCode).toBe(400);

      const payAttempt = await app.inject({
        method: "PATCH",
        url: `/org/numbatrak/payroll/lines/${line.id}/paid`,
        headers: { cookie: ownerCookie },
        payload: { paid: true },
      });
      expect(payAttempt.statusCode).toBe(400);

      // Cross-tenant: a second org's owner must not be able to touch this
      // line even though they legitimately hold "manage" in their own org.
      // assertLineMutable throws before any write, surfaced as a 400 with a
      // "not found" message (not a silent success).
      const otherOwner = await signUpOwnerWithOrg();
      const crossTenantAttempt = await app.inject({
        method: "PATCH",
        url: `/org/numbatrak/payroll/lines/${line.id}/override`,
        headers: { cookie: otherOwner.headers.get("cookie") ?? "" },
        payload: { overrideBaseSalary: 1 },
      });
      expect(crossTenantAttempt.statusCode).toBe(400);
      expect(crossTenantAttempt.json().error).toMatch(/not found/i);
    },
    120000,
  );

  it(
    "snapshots the paid amount on mark-paid and stays reversible on un-pay",
    async () => {
      const app = await setUpApp();
      const owner = await signUpOwnerWithOrg();
      const ownerCookie = owner.headers.get("cookie") ?? "";
      const crs = await addUserToOrgWithRole(owner.orgId, "csr");

      await app.inject({
        method: "POST",
        url: "/org/numbatrak/staff",
        headers: { cookie: ownerCookie },
        payload: { userId: crs.userId, primaryRole: "CRS" },
      });
      await app.inject({
        method: "POST",
        url: "/org/numbatrak/payroll/structures",
        headers: { cookie: ownerCookie },
        payload: { scopeType: "role", role: "CRS", baseSalaryEnabled: true, baseSalaryAmount: 50000 },
      });

      const month = "2026-06";
      const runResponse = await app.inject({
        method: "POST",
        url: "/org/numbatrak/payroll/run",
        headers: { cookie: ownerCookie },
        payload: { month },
      });
      const line = runResponse.json().lines[0];

      const payResponse = await app.inject({
        method: "PATCH",
        url: `/org/numbatrak/payroll/lines/${line.id}/paid`,
        headers: { cookie: ownerCookie },
        payload: { paid: true, paidNotes: "test payout" },
      });
      expect(payResponse.statusCode).toBe(200);

      const afterPay = await app.inject({ method: "GET", url: `/org/numbatrak/payroll/run/${month}`, headers: { cookie: ownerCookie } });
      const paidLine = afterPay.json().lines.find((l: any) => l.id === line.id);
      expect(paidLine.paid).toBe(true);
      expect(paidLine.paidAmount).toBe(50000);
      expect(paidLine.paidNotes).toBe("test payout");

      const unpayResponse = await app.inject({
        method: "PATCH",
        url: `/org/numbatrak/payroll/lines/${line.id}/paid`,
        headers: { cookie: ownerCookie },
        payload: { paid: false },
      });
      expect(unpayResponse.statusCode).toBe(200);

      const afterUnpay = await app.inject({ method: "GET", url: `/org/numbatrak/payroll/run/${month}`, headers: { cookie: ownerCookie } });
      const unpaidLine = afterUnpay.json().lines.find((l: any) => l.id === line.id);
      expect(unpaidLine.paid).toBe(false);
      expect(unpaidLine.paidAmount).toBeNull();
    },
    60000,
  );
});
