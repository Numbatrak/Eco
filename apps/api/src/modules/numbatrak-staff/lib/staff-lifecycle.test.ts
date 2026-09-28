import { describe, it, expect, afterEach } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { truncateAll } from "../../../test/test-db.js";
import { signUpOwnerWithOrg, addUserToOrgWithRole } from "../../../test/auth-helpers.js";
import numbatrakStaffRoutes from "../routes/index.js";

/**
 * Tier B (real Postgres via TEST_DATABASE_URL) - exercises the staff
 * lifecycle through the actual HTTP routes: employmentStatus auto-deriving
 * `active` + the deactivation audit trail, probation tracking, the quick
 * active/inactive toggle staying in sync with employmentStatus, and the
 * self-service bank-details endpoint being scoped to the caller's own row.
 */
describe("staff lifecycle", () => {
  afterEach(async () => {
    await truncateAll();
  });

  it("employmentStatus drives `active` and records a deactivation audit trail", async () => {
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [numbatrakStaffRoutes] });
    const owner = await signUpOwnerWithOrg();
    const ownerCookie = owner.headers.get("cookie") ?? "";
    const crs = await addUserToOrgWithRole(owner.orgId, "csr");

    const created = (
      await app.inject({
        method: "POST",
        url: "/org/numbatrak/staff",
        headers: { cookie: ownerCookie },
        payload: { userId: crs.userId, primaryRole: "CRS" },
      })
    ).json();
    expect(created.employmentStatus).toBe("active");
    expect(created.active).toBe(true);

    const suspended = (
      await app.inject({
        method: "PATCH",
        url: `/org/numbatrak/staff/${created.id}`,
        headers: { cookie: ownerCookie },
        payload: { employmentStatus: "suspended", deactivationReason: "policy violation", onProbation: true, probationEndsAt: "2026-07-01" },
      })
    ).json();
    expect(suspended.employmentStatus).toBe("suspended");
    expect(suspended.active).toBe(false);
    expect(suspended.deactivationReason).toBe("policy violation");
    expect(suspended.deactivatedByName).toBeTruthy();
    expect(suspended.deactivatedAt).toBeTruthy();
    expect(suspended.onProbation).toBe(true);

    const reactivated = (
      await app.inject({
        method: "PATCH",
        url: `/org/numbatrak/staff/${created.id}`,
        headers: { cookie: ownerCookie },
        payload: { employmentStatus: "active" },
      })
    ).json();
    expect(reactivated.active).toBe(true);
    expect(reactivated.deactivatedAt).toBeNull();
    expect(reactivated.deactivationReason).toBeNull();

    // The quick toggle (used by the plain Deactivate/Reactivate button)
    // keeps employmentStatus in lockstep rather than letting the two fields
    // drift out of sync.
    const toggledOff = (
      await app.inject({
        method: "PATCH",
        url: `/org/numbatrak/staff/${created.id}/active`,
        headers: { cookie: ownerCookie },
        payload: { active: false },
      })
    ).json();
    expect(toggledOff.active).toBe(false);
    expect(toggledOff.employmentStatus).toBe("inactive");
  });

  it("lets a staff member self-service their own bank details, and only their own", async () => {
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [numbatrakStaffRoutes] });
    const owner = await signUpOwnerWithOrg();
    const ownerCookie = owner.headers.get("cookie") ?? "";
    const crsA = await addUserToOrgWithRole(owner.orgId, "csr");
    const crsB = await addUserToOrgWithRole(owner.orgId, "csr");

    await app.inject({ method: "POST", url: "/org/numbatrak/staff", headers: { cookie: ownerCookie }, payload: { userId: crsA.userId, primaryRole: "CRS" } });
    await app.inject({ method: "POST", url: "/org/numbatrak/staff", headers: { cookie: ownerCookie }, payload: { userId: crsB.userId, primaryRole: "CRS" } });

    const selfUpdate = await app.inject({
      method: "PATCH",
      url: "/org/numbatrak/staff/me/bank-details",
      headers: { cookie: crsA.activeHeaders.get("cookie") ?? "" },
      payload: { bankName: "Test Bank", bankAccountNumber: "0123456789", bankAccountName: "CRS A" },
    });
    expect(selfUpdate.statusCode).toBe(200);
    expect(selfUpdate.json().bankName).toBe("Test Bank");

    // Confirm the update landed on CRS A's own row, not CRS B's.
    const list = await app.inject({ method: "GET", url: "/org/numbatrak/staff", headers: { cookie: ownerCookie } });
    const rows = list.json().staff as any[];
    const rowA = rows.find((r) => r.userId === crsA.userId);
    const rowB = rows.find((r) => r.userId === crsB.userId);
    expect(rowA.bankAccountNumber).toBe("0123456789");
    expect(rowB.bankAccountNumber).toBeNull();
  });
});
