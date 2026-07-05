import { describe, it, expect, vi } from "vitest";
import RedisMock from "ioredis-mock";
import type { RedisClient } from "../../../../lib/redis.js";
import { buildTestApp } from "../../../../test/build-test-app.js";
import { makeFakeUser } from "../../../../test/fixtures.js";
import verifyRoutes from "./verify.js";
import { signMfaChallengeToken } from "../../lib/jwt.js";
import { hashBackupCode } from "../lib/backup-codes.js";

interface FakeBackupCodeRow {
  id: string;
  codeHash: string;
  usedAt: Date | null;
}

vi.mock("../../lib/users.js", () => ({
  findUserById: vi.fn(),
}));
vi.mock("../../lib/security-events.js", () => ({
  logSecurityEvent: vi.fn(async () => {}),
}));
vi.mock("../../lib/refresh-tokens.js", () => ({
  issueRefreshToken: vi.fn(async () => ({ token: "fake-refresh-token", jti: "fake-refresh-jti" })),
}));

const backupCodeState: FakeBackupCodeRow[] = [];

vi.mock("../lib/backup-codes-store.js", () => ({
  listUnusedBackupCodes: vi.fn(async () => backupCodeState.filter((row) => !row.usedAt)),
  markBackupCodeUsed: vi.fn(async (_db, id: string) => {
    const row = backupCodeState.find((r) => r.id === id);
    if (row) row.usedAt = new Date();
  }),
}));

const { findUserById } = await import("../../lib/users.js");
const { logSecurityEvent } = await import("../../lib/security-events.js");

describe("backup code single-use", () => {
  it("accepts a backup code once and rejects it on second use", async () => {
    const userId = "44444444-4444-4444-4444-444444444444";
    const fakeUser = makeFakeUser({ id: userId });
    vi.mocked(findUserById).mockResolvedValue(fakeUser);

    const plainCode = "abcd1234ef";
    backupCodeState.push({ id: "bc-1", codeHash: await hashBackupCode(plainCode), usedAt: null });

    const redis = new RedisMock() as unknown as RedisClient;
    const app = await buildTestApp({ redis, routes: [verifyRoutes] });

    const firstChallenge = await signMfaChallengeToken({ sub: userId, jti: "bc-jti-1" });
    const first = await app.inject({
      method: "POST",
      url: "/auth/2fa/verify",
      payload: { challengeToken: firstChallenge, code: plainCode },
    });
    expect(first.statusCode).toBe(200);
    expect(
      vi.mocked(logSecurityEvent).mock.calls.some(([, params]) => params.eventType === "backup_code_used"),
    ).toBe(true);

    const secondChallenge = await signMfaChallengeToken({ sub: userId, jti: "bc-jti-2" });
    const second = await app.inject({
      method: "POST",
      url: "/auth/2fa/verify",
      payload: { challengeToken: secondChallenge, code: plainCode },
    });
    expect(second.statusCode).toBe(401);
  });
});
