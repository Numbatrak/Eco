import { and, eq } from "drizzle-orm";
import { collections, type Database } from "@platform/db";
import type { Collection, CreateCollectionRequest, UpdateCollectionRequest } from "@platform/shared-types";

export type CollectionRow = typeof collections.$inferSelect;

export function serializeCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.imageUrl,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCollectionsForTenant(db: Database, tenantId: string): Promise<CollectionRow[]> {
  return db
    .select()
    .from(collections)
    .where(eq(collections.tenantId, tenantId))
    .orderBy(collections.sortOrder);
}

export async function findCollectionForTenant(
  db: Database,
  tenantId: string,
  collectionId: string,
): Promise<CollectionRow | null> {
  const [row] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.tenantId, tenantId), eq(collections.id, collectionId)))
    .limit(1);
  return row ?? null;
}

export async function createCollection(
  db: Database,
  tenantId: string,
  input: CreateCollectionRequest,
): Promise<CollectionRow> {
  const [row] = await db
    .insert(collections)
    .values({ tenantId, ...input })
    .returning();
  if (!row) {
    throw new Error("Failed to create collection");
  }
  return row;
}

export async function updateCollection(
  db: Database,
  tenantId: string,
  collectionId: string,
  patch: UpdateCollectionRequest,
): Promise<CollectionRow | null> {
  const [row] = await db
    .update(collections)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(collections.tenantId, tenantId), eq(collections.id, collectionId)))
    .returning();
  return row ?? null;
}

export async function deleteCollection(
  db: Database,
  tenantId: string,
  collectionId: string,
): Promise<boolean> {
  const result = await db
    .delete(collections)
    .where(and(eq(collections.tenantId, tenantId), eq(collections.id, collectionId)))
    .returning({ id: collections.id });
  return result.length > 0;
}
