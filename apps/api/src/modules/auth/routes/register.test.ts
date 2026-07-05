import { describe, it, expect, vi } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { makeFakeUser } from "../../../test/fixtures.js";
import registerRoutes from "./register.js";

vi.mock("../lib/users.js", () => ({
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
}));
vi.mock("../lib/tenants.js", () => ({
  createTenantWithOwner: vi.fn(async () => ({ id: "tenant-1", name: "Acme" })),
}));
vi.mock("../lib/email.js", () => ({
  sendEmail: vi.fn(async () => {}),
}));

const { findUserByEmail, createUser } = await import("../lib/users.js");
const { createTenantWithOwner } = await import("../lib/tenants.js");
const { sendEmail } = await import("../lib/email.js");

describe("POST /auth/register", () => {
  it("creates a user + tenant for a new email and sends a verification link", async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(null);
    vi.mocked(createUser).mockResolvedValue({ id: "user-1", email: "new@example.com" });

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [registerRoutes] });

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "new@example.com",
        password: "a-strong-password-123",
        businessName: "Acme",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(createUser).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: "new@example.com" }),
    );
    expect(createTenantWithOwner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: "Acme", ownerUserId: "user-1" }),
    );

    const sentBody = vi.mocked(sendEmail).mock.calls[0]?.[1]?.body ?? "";
    expect(sentBody).toContain("verify-email?token=");
  });

  it("returns the identical response for a duplicate email without creating anything", async () => {
    const existing = makeFakeUser({ email: "taken@example.com" });
    vi.mocked(createUser).mockResolvedValue({ id: "user-2", email: "brand-new@example.com" });
    vi.mocked(findUserByEmail).mockImplementation(async (_db, email) =>
      email === "taken@example.com" ? existing : null,
    );

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [registerRoutes] });

    const newEmailResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "brand-new@example.com",
        password: "a-strong-password-123",
        businessName: "Acme",
      },
    });

    const duplicateResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "taken@example.com",
        password: "a-strong-password-123",
        businessName: "Acme",
      },
    });

    expect(duplicateResponse.statusCode).toBe(newEmailResponse.statusCode);
    expect(duplicateResponse.json()).toEqual(newEmailResponse.json());
    expect(createUser).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: "taken@example.com" }),
    );
  });
});
