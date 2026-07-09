import { describe, it, expect, afterEach } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { truncateAll } from "../../../test/test-db.js";
import { auth } from "../../../lib/auth.js";
import loginRoutes from "./login.js";

describe("POST /auth/login", () => {
  afterEach(async () => {
    await truncateAll();
  });

  it("issues a session cookie and sets the user's only org as active", async () => {
    const password = "correct horse battery staple";
    const signUp = await auth.api.signUpEmail({
      body: { email: `owner-${Date.now()}@example.com`, password, name: "Owner" },
      asResponse: true,
    });
    const cookies = signUp.headers.getSetCookie();
    const signUpHeaders = new Headers({ cookie: cookies.map((c) => c.split(";")[0]).join("; ") });
    const signUpUser = (await signUp.json()) as { user: { id: string; email: string } };
    await auth.api.createOrganization({
      headers: signUpHeaders,
      body: { name: "Login Org", slug: `login-org-${Date.now()}` },
    });

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [loginRoutes] });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: signUpUser.user.email, password },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.token).toBeTypeOf("string");
    expect(body.user.email).toBe(signUpUser.user.email);

    const setCookies = response.headers["set-cookie"];
    expect(setCookies).toBeDefined();

    const cookieHeader = Array.isArray(setCookies) ? setCookies.map((c) => c.split(";")[0]).join("; ") : String(setCookies);
    const session = await auth.api.getSession({ headers: new Headers({ cookie: cookieHeader }) });
    expect(session?.session.activeOrganizationId).toBeTruthy();
  });

  it("returns the same generic error for an unknown email and a wrong password", async () => {
    const email = `known-${Date.now()}@example.com`;
    await auth.api.signUpEmail({ body: { email, password: "the-real-password-123", name: "Known" } });

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [loginRoutes] });

    const unknownEmailResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "nobody@example.com", password: "whatever12345" },
    });
    const wrongPasswordResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "not-the-real-password" },
    });

    expect(unknownEmailResponse.statusCode).toBe(401);
    expect(wrongPasswordResponse.statusCode).toBe(401);
    expect(unknownEmailResponse.json()).toEqual(wrongPasswordResponse.json());
  });
});
