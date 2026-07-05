import { describe, it, expect, vi } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { makeFakeUser } from "../../../test/fixtures.js";
import meRoutes from "./me.js";
import { signAccessToken } from "../lib/jwt.js";

vi.mock("../lib/users.js", () => ({
  findUserById: vi.fn(),
}));
vi.mock("../lib/tenants.js", () => ({
  listTenantsForUser: vi.fn(),
}));

const { findUserById } = await import("../lib/users.js");
const { listTenantsForUser } = await import("../lib/tenants.js");

describe("GET /auth/me", () => {
  it("returns the current user and their tenant memberships", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    vi.mocked(findUserById).mockResolvedValue(makeFakeUser({ id: userId, email: "owner@example.com" }));
    vi.mocked(listTenantsForUser).mockResolvedValue([
      { id: "tenant-1", name: "Acme", subdomain: "acme", role: "owner" },
    ]);

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [meRoutes] });
    const accessToken = await signAccessToken({ sub: userId });

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: userId,
      email: "owner@example.com",
      tenants: [{ id: "tenant-1", name: "Acme", subdomain: "acme", role: "owner" }],
    });
  });

  it("rejects a request without a bearer token", async () => {
    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [meRoutes] });

    const response = await app.inject({ method: "GET", url: "/auth/me" });

    expect(response.statusCode).toBe(401);
  });
});
