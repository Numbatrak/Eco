import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { refreshTokens, type Database } from "@platform/db";
import { signRefreshToken } from "./jwt.js";
import { sha256Hex } from "./tokens.js";

export interface RefreshTokenMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface IssuedRefreshToken {
  token: string;
  jti: string;
}

function refreshTtlSeconds(): number {
  const raw = process.env.REFRESH_TOKEN_TTL_SECONDS;
  return raw ? Number(raw) : 2_592_000;
}

export async function issueRefreshToken(
  db: Database,
  userId: string,
  meta: RefreshTokenMeta,
): Promise<IssuedRefreshToken> {
  const jti = randomUUID();
  const token = await signRefreshToken({ sub: userId, jti });
  const expiresAt = new Date(Date.now() + refreshTtlSeconds() * 1000);
  await db.insert(refreshTokens).values({
    id: jti,
    userId,
    tokenHash: sha256Hex(token),
    expiresAt,
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });
  return { token, jti };
}

/**
 * Looks up the presented refresh token by its hash (the caller must already
 * have verified the JWT signature/expiry before calling this - this only
 * checks the DB-side revocation/expiry state, which is the source of truth
 * for rotation and logout).
 */
export async function findActiveRefreshTokenRow(db: Database, presentedToken: string) {
  const hash = sha256Hex(presentedToken);
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.tokenHash, hash), isNull(refreshTokens.revokedAt)))
    .limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) {
    return null;
  }
  return row;
}

export async function revokeRefreshTokenRow(db: Database, id: string): Promise<void> {
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, id));
}

export async function revokeAllRefreshTokens(db: Database, userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}
