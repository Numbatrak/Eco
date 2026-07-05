import { and, eq, isNull } from "drizzle-orm";
import { backupCodes, type Database } from "@platform/db";

export type BackupCodeRow = typeof backupCodes.$inferSelect;

export async function listUnusedBackupCodes(db: Database, userId: string): Promise<BackupCodeRow[]> {
  return db
    .select()
    .from(backupCodes)
    .where(and(eq(backupCodes.userId, userId), isNull(backupCodes.usedAt)));
}

export async function insertBackupCodeHashes(
  db: Database,
  userId: string,
  codeHashes: string[],
): Promise<void> {
  await db.insert(backupCodes).values(codeHashes.map((codeHash) => ({ userId, codeHash })));
}

export async function markBackupCodeUsed(db: Database, id: string): Promise<void> {
  await db.update(backupCodes).set({ usedAt: new Date() }).where(eq(backupCodes.id, id));
}

export async function deleteUnusedBackupCodes(db: Database, userId: string): Promise<void> {
  await db
    .delete(backupCodes)
    .where(and(eq(backupCodes.userId, userId), isNull(backupCodes.usedAt)));
}
