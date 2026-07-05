import { SignJWT, jwtVerify } from "jose";

const secretCache = new Map<string, Uint8Array>();

function getSecret(name: string): Uint8Array {
  let secret = secretCache.get(name);
  if (!secret) {
    const value = process.env[name];
    if (!value) {
      throw new Error(`${name} is not set. Copy .env.example to .env and configure it.`);
    }
    secret = new TextEncoder().encode(value);
    secretCache.set(name, secret);
  }
  return secret;
}

function ttlSeconds(envVar: string, fallback: number): number {
  const raw = process.env[envVar];
  return raw ? Number(raw) : fallback;
}

export interface AccessTokenClaims {
  sub: string;
}

export interface RefreshTokenClaims {
  sub: string;
  jti: string;
}

export interface MfaChallengeClaims {
  sub: string;
  jti: string;
}

export function getMfaChallengeTtlSeconds(): number {
  return ttlSeconds("MFA_CHALLENGE_TTL_SECONDS", 300);
}

export async function signAccessToken(payload: AccessTokenClaims): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds("ACCESS_TOKEN_TTL_SECONDS", 900)}s`)
    .sign(getSecret("JWT_ACCESS_SECRET"));
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, getSecret("JWT_ACCESS_SECRET"));
  if (typeof payload.sub !== "string") {
    throw new Error("Invalid access token payload");
  }
  return { sub: payload.sub };
}

export async function signRefreshToken(payload: RefreshTokenClaims): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds("REFRESH_TOKEN_TTL_SECONDS", 2_592_000)}s`)
    .sign(getSecret("JWT_REFRESH_SECRET"));
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
  const { payload } = await jwtVerify(token, getSecret("JWT_REFRESH_SECRET"));
  if (typeof payload.sub !== "string" || typeof payload.jti !== "string") {
    throw new Error("Invalid refresh token payload");
  }
  return { sub: payload.sub, jti: payload.jti };
}

export async function signMfaChallengeToken(payload: MfaChallengeClaims): Promise<string> {
  return new SignJWT({ ...payload, purpose: "mfa_challenge" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${getMfaChallengeTtlSeconds()}s`)
    .sign(getSecret("MFA_CHALLENGE_SECRET"));
}

export async function verifyMfaChallengeToken(token: string): Promise<MfaChallengeClaims> {
  const { payload } = await jwtVerify(token, getSecret("MFA_CHALLENGE_SECRET"));
  if (
    payload.purpose !== "mfa_challenge" ||
    typeof payload.sub !== "string" ||
    typeof payload.jti !== "string"
  ) {
    throw new Error("Invalid MFA challenge token payload");
  }
  return { sub: payload.sub, jti: payload.jti };
}
