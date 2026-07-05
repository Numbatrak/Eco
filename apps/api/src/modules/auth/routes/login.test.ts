import { describe, it, expect, vi } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { makeFakeUser } from "../../../test/fixtures.js";
import loginRoutes from "./login.js";
import { hashPassword } from "../lib/password.js";

vi.mock("../lib/users.js", () => ({
  findUserByEmail: vi.fn(),
}));
vi.mock("../lib/security-events.js", () => ({
  logSecurityEvent: vi.fn(async () => {}),
}));
vi.mock("../lib/refresh-tokens.js", () => ({
  issueRefreshToken: vi.fn(async () => ({ token: "fake-refresh-token", jti: "fake-refresh-jti" })),
}));

const { findUserByEmail } = await import("../lib/users.js");

describe("POST /auth/login", () => {
  it("issues an access token in the body and the refresh token only as an httpOnly cookie", async () => {
    const email = "user@example.com";
    const password = "correct horse battery staple";
    const fakeUser = makeFakeUser({ email, passwordHash: await hashPassword(password) });
    vi.mocked(findUserByEmail).mockResolvedValue(fakeUser);

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [loginRoutes] });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("authenticated");
    expect(body.accessToken).toBeTypeOf("string");
    expect(body.refreshToken).toBeUndefined();

    const cookie = response.cookies.find((c) => c.name === "refresh_token");
    expect(cookie?.value).toBe("fake-refresh-token");
    expect(cookie?.httpOnly).toBe(true);
  });

  it("returns the same generic error for an unknown email and a wrong password", async () => {
    vi.mocked(findUserByEmail).mockResolvedValueOnce(null);

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [loginRoutes] });

    const unknownEmailResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "nobody@example.com", password: "whatever12345" },
    });

    const fakeUser = makeFakeUser({ passwordHash: await hashPassword("the-real-password") });
    vi.mocked(findUserByEmail).mockResolvedValueOnce(fakeUser);
    const wrongPasswordResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: fakeUser.email, password: "not-the-real-password" },
    });

    expect(unknownEmailResponse.statusCode).toBe(401);
    expect(wrongPasswordResponse.statusCode).toBe(401);
    expect(unknownEmailResponse.json()).toEqual(wrongPasswordResponse.json());
  });
});
