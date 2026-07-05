import * as argon2 from "argon2";

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

// A pre-computed argon2id hash of a random value, used so that verifying a
// password against a nonexistent user takes the same time as a real user -
// otherwise the absence of this delay leaks which emails are registered.
const DUMMY_HASH = await argon2.hash("dummy-password-for-timing-parity", {
  type: argon2.argon2id,
});

export function verifyPasswordConstantTimeForUnknownUser(): Promise<boolean> {
  return argon2.verify(DUMMY_HASH, "irrelevant");
}
