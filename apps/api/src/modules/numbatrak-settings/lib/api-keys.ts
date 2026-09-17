import { randomBytes, createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { numbatrakApiKeys, type Database } from "@platform/db";

export type ApiKeyRow = typeof numbatrakApiKeys.$inferSelect;

const KEY_PREFIX_LENGTH = 8;

function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export interface CreatedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  /** Only ever returned once, at creation time - never persisted or retrievable again. */
  plaintextKey: string;
  createdAt: string | null;
}

export function serializeApiKey(row: ApiKeyRow) {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt?.toISOString() ?? null,
  };
}

export async function listApiKeys(db: Database, organizationId: string): Promise<ReturnType<typeof serializeApiKey>[]> {
  const rows = await db
    .select()
    .from(numbatrakApiKeys)
    .where(eq(numbatrakApiKeys.organizationId, organizationId))
    .orderBy(desc(numbatrakApiKeys.createdAt));
  return rows.map(serializeApiKey);
}

export async function createApiKey(
  db: Database,
  organizationId: string,
  createdBy: string,
  name: string,
): Promise<CreatedApiKey> {
  const secret = randomBytes(24).toString("base64url");
  const plaintextKey = `ntk_live_${secret}`;
  const keyPrefix = plaintextKey.slice(0, KEY_PREFIX_LENGTH);
  const keyHash = hashKey(plaintextKey);

  const [created] = await db
    .insert(numbatrakApiKeys)
    .values({ organizationId, name, keyPrefix, keyHash, createdBy })
    .returning();

  return { id: created!.id, name: created!.name, keyPrefix, plaintextKey, createdAt: created!.createdAt?.toISOString() ?? null };
}

export async function revokeApiKey(db: Database, organizationId: string, keyId: string): Promise<boolean> {
  const result = await db
    .update(numbatrakApiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(numbatrakApiKeys.organizationId, organizationId), eq(numbatrakApiKeys.id, keyId), isNull(numbatrakApiKeys.revokedAt)))
    .returning({ id: numbatrakApiKeys.id });
  return result.length > 0;
}

/** Resolves a plaintext bearer key to its owning organization, if valid and not revoked. Updates lastUsedAt on success. */
export async function resolveApiKey(db: Database, plaintextKey: string): Promise<{ organizationId: string } | null> {
  const keyHash = hashKey(plaintextKey);
  const [row] = await db
    .select({ id: numbatrakApiKeys.id, organizationId: numbatrakApiKeys.organizationId, revokedAt: numbatrakApiKeys.revokedAt })
    .from(numbatrakApiKeys)
    .where(eq(numbatrakApiKeys.keyHash, keyHash))
    .limit(1);
  if (!row || row.revokedAt) return null;

  await db.update(numbatrakApiKeys).set({ lastUsedAt: new Date() }).where(eq(numbatrakApiKeys.id, row.id));
  return { organizationId: row.organizationId };
}
