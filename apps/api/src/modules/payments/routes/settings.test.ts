import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import { truncateAll } from "../../../test/test-db.js";
import { signUpOwnerWithOrg } from "../../../test/auth-helpers.js";
import paymentSettingsRoutes from "./settings.js";

vi.mock("../lib/payment-settings-store.js", () => ({
  findPaymentSettings: vi.fn(async () => null),
  serializePaymentSettings: vi.fn(() => ({
    provider: null,
    mode: null,
    enabled: false,
    hasSecretKey: false,
    publicKey: null,
  })),
  upsertPaymentSettings: vi.fn(async () => {}),
}));
vi.mock("../lib/live-mode-reauth.js", () => ({
  verifyLiveModeReauth: vi.fn(),
}));

const { upsertPaymentSettings } = await import("../lib/payment-settings-store.js");
const { verifyLiveModeReauth } = await import("../lib/live-mode-reauth.js");

async function putSettings(cookie: string, body: Record<string, unknown>) {
  const redis = new RedisMock() as unknown as RedisClient;
  const app = await buildTestApp({ redis, routes: [paymentSettingsRoutes] });
  return app.inject({
    method: "PUT",
    url: "/org/payment-settings",
    headers: { cookie },
    payload: body,
  });
}

describe("PUT /org/payment-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await truncateAll();
  });

  it("saves test-mode credentials without requiring password/2FA re-auth", async () => {
    const owner = await signUpOwnerWithOrg();
    const response = await putSettings(owner.headers.get("cookie") ?? "", {
      provider: "paystack",
      publicKey: "pk_test_x",
      secretKey: "sk_test_x",
      mode: "test",
    });

    expect(response.statusCode).toBe(200);
    expect(verifyLiveModeReauth).not.toHaveBeenCalled();
    expect(upsertPaymentSettings).toHaveBeenCalledTimes(1);
  });

  it("rejects saving live-mode credentials when re-auth fails, without persisting anything", async () => {
    vi.mocked(verifyLiveModeReauth).mockResolvedValue({
      ok: false,
      status: 401,
      error: "Incorrect password",
    });
    const owner = await signUpOwnerWithOrg();

    const response = await putSettings(owner.headers.get("cookie") ?? "", {
      provider: "paystack",
      publicKey: "pk_live_x",
      secretKey: "sk_live_x",
      mode: "live",
      password: "wrong-password",
      code: "000000",
    });

    expect(response.statusCode).toBe(401);
    expect(upsertPaymentSettings).not.toHaveBeenCalled();
  });

  it("saves live-mode credentials once re-auth succeeds", async () => {
    vi.mocked(verifyLiveModeReauth).mockResolvedValue({ ok: true });
    const owner = await signUpOwnerWithOrg();

    const response = await putSettings(owner.headers.get("cookie") ?? "", {
      provider: "paystack",
      publicKey: "pk_live_x",
      secretKey: "sk_live_x",
      mode: "live",
      password: "correct-password",
      code: "123456",
    });

    expect(response.statusCode).toBe(200);
    expect(upsertPaymentSettings).toHaveBeenCalledTimes(1);
  });

  it("rejects a viewer-role caller (no payments.manage permission)", async () => {
    const owner = await signUpOwnerWithOrg();
    const { addUserToOrgWithRole } = await import("../../../test/auth-helpers.js");
    const viewer = await addUserToOrgWithRole(owner.orgId, "viewer");

    const response = await putSettings(viewer.activeHeaders.get("cookie") ?? "", {
      provider: "paystack",
      publicKey: "pk_test_x",
      secretKey: "sk_test_x",
      mode: "test",
    });

    expect(response.statusCode).toBe(403);
  });
});
