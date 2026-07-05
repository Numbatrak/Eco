import { describe, it, expect, vi, beforeEach } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../lib/redis.js";
import { buildTestApp } from "../../../test/build-test-app.js";
import paymentSettingsRoutes from "./settings.js";
import { signAccessToken } from "../../auth/lib/jwt.js";

vi.mock("../../permissions/lib/membership.js", () => ({
  findTenantMembership: vi.fn(async () => ({ tenantMemberId: "member-1", role: "owner" })),
  memberHasPermission: vi.fn(async () => true),
}));
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

const tenantId = "tenant-1";
const userId = "11111111-1111-1111-1111-111111111111";

async function putSettings(body: Record<string, unknown>) {
  const redis = new RedisMock() as unknown as RedisClient;
  const app = await buildTestApp({ redis, routes: [paymentSettingsRoutes] });
  const accessToken = await signAccessToken({ sub: userId });
  return app.inject({
    method: "PUT",
    url: `/tenants/${tenantId}/payment-settings`,
    headers: { authorization: `Bearer ${accessToken}` },
    payload: body,
  });
}

describe("PUT /tenants/:tenantId/payment-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves test-mode credentials without requiring password/2FA re-auth", async () => {
    const response = await putSettings({
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

    const response = await putSettings({
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

    const response = await putSettings({
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
});
