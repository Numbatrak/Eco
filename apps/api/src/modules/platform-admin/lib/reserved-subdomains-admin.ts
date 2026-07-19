import { desc, eq } from "drizzle-orm";
import { reservedSubdomains, type Database } from "@platform/db";
import type { ReservedSubdomain } from "@platform/shared-types";

function serialize(row: typeof reservedSubdomains.$inferSelect): ReservedSubdomain {
  return {
    word: row.word,
    addedBy: row.addedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listReservedSubdomains(db: Database): Promise<ReservedSubdomain[]> {
  const rows = await db.select().from(reservedSubdomains).orderBy(desc(reservedSubdomains.createdAt));
  return rows.map(serialize);
}

export async function addReservedSubdomain(
  db: Database,
  params: { word: string; addedBy: string },
): Promise<ReservedSubdomain | "already_exists"> {
  const [existing] = await db
    .select({ word: reservedSubdomains.word })
    .from(reservedSubdomains)
    .where(eq(reservedSubdomains.word, params.word))
    .limit(1);
  if (existing) {
    return "already_exists";
  }
  const [created] = await db
    .insert(reservedSubdomains)
    .values({ word: params.word, addedBy: params.addedBy })
    .returning();
  if (!created) {
    throw new Error("Failed to create reserved subdomain");
  }
  return serialize(created);
}

export async function removeReservedSubdomain(db: Database, word: string): Promise<boolean> {
  const deleted = await db
    .delete(reservedSubdomains)
    .where(eq(reservedSubdomains.word, word))
    .returning({ word: reservedSubdomains.word });
  return deleted.length > 0;
}
