import type { UserRow } from "../modules/auth/lib/users.js";

export function makeFakeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    email: "user@example.com",
    passwordHash: "unused-in-these-tests",
    totpSecretEncrypted: null,
    totpEnabledAt: null,
    emailOtpEnabledAt: null,
    preferred2faMethod: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
