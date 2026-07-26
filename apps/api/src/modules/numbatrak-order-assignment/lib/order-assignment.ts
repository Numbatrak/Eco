import { and, eq } from "drizzle-orm";
import {
  numbatrakOrderAssignmentSettings,
  numbatrakOrderAssignmentWeights,
  user,
  type Database,
} from "@platform/db";
import type {
  NumbatrakOrderAssignmentSettings,
  NumbatrakOrderAssignmentWeight,
} from "@platform/shared-types";

type SettingsRow = typeof numbatrakOrderAssignmentSettings.$inferSelect;
type WeightRow = typeof numbatrakOrderAssignmentWeights.$inferSelect;

function serializeSettings(row: SettingsRow): NumbatrakOrderAssignmentSettings {
  return {
    id: row.id,
    assignmentMethod: row.assignmentMethod as NumbatrakOrderAssignmentSettings["assignmentMethod"],
    lastAssignedUserId: row.lastAssignedUserId,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function serializeWeight(row: WeightRow, userName: string | null): NumbatrakOrderAssignmentWeight {
  return {
    id: row.id,
    userId: row.userId,
    userName,
    percentage: Number(row.percentage),
    isPaused: row.isPaused,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export async function getOrCreateSettings(db: Database, organizationId: string): Promise<NumbatrakOrderAssignmentSettings> {
  const [existing] = await db
    .select()
    .from(numbatrakOrderAssignmentSettings)
    .where(eq(numbatrakOrderAssignmentSettings.organizationId, organizationId))
    .limit(1);

  if (existing) return serializeSettings(existing);

  const [row] = await db
    .insert(numbatrakOrderAssignmentSettings)
    .values({ organizationId })
    .returning();
  return serializeSettings(row!);
}

export async function updateSettings(
  db: Database,
  organizationId: string,
  input: { assignmentMethod: string },
): Promise<NumbatrakOrderAssignmentSettings> {
  const current = await getOrCreateSettings(db, organizationId);
  const [row] = await db
    .update(numbatrakOrderAssignmentSettings)
    .set({ assignmentMethod: input.assignmentMethod, updatedAt: new Date() })
    .where(eq(numbatrakOrderAssignmentSettings.id, current.id))
    .returning();
  return serializeSettings(row!);
}

export async function listWeights(db: Database, organizationId: string): Promise<NumbatrakOrderAssignmentWeight[]> {
  const rows = await db
    .select({
      weight: numbatrakOrderAssignmentWeights,
      userName: user.name,
    })
    .from(numbatrakOrderAssignmentWeights)
    .innerJoin(user, eq(numbatrakOrderAssignmentWeights.userId, user.id))
    .where(eq(numbatrakOrderAssignmentWeights.organizationId, organizationId));

  return rows.map((r) => serializeWeight(r.weight, r.userName));
}

export async function upsertWeight(
  db: Database,
  organizationId: string,
  userId: string,
  percentage: number,
  isPaused?: boolean,
): Promise<NumbatrakOrderAssignmentWeight> {
  const [existing] = await db
    .select()
    .from(numbatrakOrderAssignmentWeights)
    .where(
      and(
        eq(numbatrakOrderAssignmentWeights.organizationId, organizationId),
        eq(numbatrakOrderAssignmentWeights.userId, userId),
      ),
    )
    .limit(1);

  if (existing) {
    const values: Partial<typeof numbatrakOrderAssignmentWeights.$inferInsert> = {
      percentage: String(percentage),
      updatedAt: new Date(),
    };
    if (isPaused !== undefined) values.isPaused = isPaused;
    const [row] = await db
      .update(numbatrakOrderAssignmentWeights)
      .set(values)
      .where(eq(numbatrakOrderAssignmentWeights.id, existing.id))
      .returning();
    return serializeWeight(row!, null);
  }

  const [row] = await db
    .insert(numbatrakOrderAssignmentWeights)
    .values({
      organizationId,
      userId,
      percentage: String(percentage),
      isPaused: isPaused ?? false,
    })
    .returning();
  return serializeWeight(row!, null);
}

export async function deleteWeight(db: Database, organizationId: string, weightId: string): Promise<boolean> {
  const result = await db
    .delete(numbatrakOrderAssignmentWeights)
    .where(
      and(
        eq(numbatrakOrderAssignmentWeights.id, weightId),
        eq(numbatrakOrderAssignmentWeights.organizationId, organizationId),
      ),
    );
  return (result.rowCount ?? 0) > 0;
}
