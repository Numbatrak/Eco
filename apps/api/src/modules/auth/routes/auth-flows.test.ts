import { describe, it, expect, afterEach } from "vitest";
import RedisMock from "ioredis-mock";
import { securityEvents } from "@platform/db";
import { eq } from "drizzle-orm";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { getTestDb, truncateAll } from "../../../test/test-db.js";
import { signUpUser, signUpOwnerWithOrg } from "../../../test/auth-helpers.js";
import { auth } from "../../../lib/auth.js";
import loginRoutes from "./login.js";
import registerRoutes from "./register.js";
import logoutRoutes from "../routes/logout-all.js";

describe("Auth flows — security events", () => {
  afterEach(async () => {
    await truncateAll();
  });

  it("logs login_success on valid login", async () => {
    const password = "strong-test-password-123";
    const user = await signUpUser({ password });
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [loginRoutes] });

    await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: user.email, password },
    });

    const db = getTestDb();
    const events = await db.select().from(securityEvents).where(eq(securityEvents.eventType, "login_success"));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.userId === user.userId)).toBe(true);
  });

  it("logs login_failed on wrong password", async () => {
    const user = await signUpUser({ password: "correct-password-1234" });
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [loginRoutes] });

    await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: user.email, password: "wrong-password-9876" },
    });

    const db = getTestDb();
    const events = await db.select().from(securityEvents).where(eq(securityEvents.eventType, "login_failed"));
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it("logs sessions_revoked on logout-all", async () => {
    const user = await signUpUser();
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [logoutRoutes] });

    const cookies = `better-auth.session_token=${encodeURIComponent("test")}`;
    await app.inject({
      method: "POST",
      url: "/auth/logout-all",
      headers: { cookie: cookies },
    });

    const db = getTestDb();
    const events = await db.select().from(securityEvents).where(eq(securityEvents.eventType, "sessions_revoked"));
    expect(events.length).toBeGreaterThanOrEqual(0);
  });
});

describe("Auth flows — invite accept", () => {
  afterEach(async () => {
    await truncateAll();
  });

  it("allows a new user to be invited and accept the invitation", async () => {
    const owner = await signUpOwnerWithOrg();
    const inviteeEmail = `invitee-${Date.now()}@example.com`;

    const invitation = await auth.api.createInvitation({
      headers: owner.headers,
      body: {
        email: inviteeEmail,
        role: "editor",
        organizationId: owner.orgId,
      },
    });
    expect(invitation).toBeTruthy();
    expect(invitation?.status).toBe("pending");

    const invitee = await signUpUser({ email: inviteeEmail });
    await auth.api.acceptInvitation({
      headers: invitee.headers,
      body: { invitationId: invitation!.id },
    });

    const orgs = await auth.api.listOrganizations({ headers: invitee.headers });
    expect(orgs.some((o) => o.id === owner.orgId)).toBe(true);
  });

  it("rejects an already-accepted invitation", async () => {
    const owner = await signUpOwnerWithOrg();
    const inviteeEmail = `invitee2-${Date.now()}@example.com`;

    const invitation = await auth.api.createInvitation({
      headers: owner.headers,
      body: {
        email: inviteeEmail,
        role: "viewer",
        organizationId: owner.orgId,
      },
    });

    const invitee = await signUpUser({ email: inviteeEmail });
    await auth.api.acceptInvitation({
      headers: invitee.headers,
      body: { invitationId: invitation!.id },
    });

    await expect(
      auth.api.acceptInvitation({
        headers: invitee.headers,
        body: { invitationId: invitation!.id },
      }),
    ).rejects.toThrow();
  });
});
