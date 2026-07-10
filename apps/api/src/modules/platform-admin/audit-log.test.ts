import { describe, it, expect, afterEach } from "vitest";
import RedisMock from "ioredis-mock";
import { eq, and } from "drizzle-orm";
import { platformAdminAuditLog } from "@platform/db";
import type { RedisClient } from "../../lib/redis.js";
import { buildTestApp } from "../../test/build-test-app.js";
import { truncateAll, getTestDb } from "../../test/test-db.js";
import { signUpPlatformAdmin } from "../../test/platform-admin-auth-helpers.js";
import { signUpOwnerWithOrg } from "../../test/auth-helpers.js";
import tenantSuspendRoutes from "./routes/tenant-suspend.js";
import tenantReactivateRoutes from "./routes/tenant-reactivate.js";
import tenantPlanRoutes from "./routes/tenant-plan.js";
import tenantCreditsAdjustRoutes from "./routes/tenant-credits-adjust.js";
import featureFlagsRoutes from "./routes/feature-flags.js";
import settingsRoutes from "./routes/settings.js";
import reservedSubdomainsRoutes from "./routes/reserved-subdomains.js";

async function auditCount(adminId: string, action: string): Promise<number> {
  const db = getTestDb();
  const rows = await db
    .select()
    .from(platformAdminAuditLog)
    .where(and(eq(platformAdminAuditLog.adminId, adminId), eq(platformAdminAuditLog.action, action)));
  return rows.length;
}

describe("platform-admin audit log", () => {
  afterEach(async () => {
    await truncateAll();
  });

  it("writes exactly one audit log entry per mutating action", async () => {
    const admin = await signUpPlatformAdmin();
    const cookie = admin.headers.get("cookie") ?? "";
    const tenant = await signUpOwnerWithOrg();

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({
      redis,
      routes: [
        tenantSuspendRoutes,
        tenantReactivateRoutes,
        tenantPlanRoutes,
        tenantCreditsAdjustRoutes,
        featureFlagsRoutes,
        settingsRoutes,
        reservedSubdomainsRoutes,
      ],
    });

    const suspendResponse = await app.inject({
      method: "POST",
      url: `/platform-admin/tenants/${tenant.orgId}/suspend`,
      headers: { cookie },
    });
    expect(suspendResponse.statusCode).toBe(204);
    expect(await auditCount(admin.adminId, "tenant_suspended")).toBe(1);

    await app.inject({
      method: "POST",
      url: `/platform-admin/tenants/${tenant.orgId}/reactivate`,
      headers: { cookie },
    });
    expect(await auditCount(admin.adminId, "tenant_reactivated")).toBe(1);

    await app.inject({
      method: "PATCH",
      url: `/platform-admin/tenants/${tenant.orgId}/plan`,
      headers: { cookie },
      payload: { plan: "pro" },
    });
    expect(await auditCount(admin.adminId, "tenant_plan_updated")).toBe(1);

    await app.inject({
      method: "POST",
      url: `/platform-admin/tenants/${tenant.orgId}/credits/adjust`,
      headers: { cookie },
      payload: { delta: 50, reason: "goodwill credit" },
    });
    expect(await auditCount(admin.adminId, "tenant_credits_adjusted")).toBe(1);

    await app.inject({
      method: "PATCH",
      url: "/platform-admin/feature-flags/new-checkout",
      headers: { cookie },
      payload: { enabled: true },
    });
    expect(await auditCount(admin.adminId, "feature_flag_updated")).toBe(1);

    await app.inject({
      method: "PATCH",
      url: "/platform-admin/settings/support_email",
      headers: { cookie },
      payload: { value: "help@example.com" },
    });
    expect(await auditCount(admin.adminId, "platform_setting_updated")).toBe(1);

    await app.inject({
      method: "POST",
      url: "/platform-admin/reserved-subdomains",
      headers: { cookie },
      payload: { word: "totally-new-word" },
    });
    expect(await auditCount(admin.adminId, "reserved_subdomain_added")).toBe(1);

    await app.inject({
      method: "DELETE",
      url: "/platform-admin/reserved-subdomains/totally-new-word",
      headers: { cookie },
    });
    expect(await auditCount(admin.adminId, "reserved_subdomain_removed")).toBe(1);
  });
});
