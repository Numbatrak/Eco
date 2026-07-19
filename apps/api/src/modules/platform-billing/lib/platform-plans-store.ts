import { eq } from "drizzle-orm";
import { platformPlans, type Database } from "@platform/db";

export type PlatformPlanRow = typeof platformPlans.$inferSelect;

export async function listPlatformPlans(db: Database): Promise<PlatformPlanRow[]> {
  return db
    .select()
    .from(platformPlans)
    .where(eq(platformPlans.isActive, true))
    .orderBy(platformPlans.priceMonthlyCents);
}

export async function findPlatformPlan(db: Database, id: string): Promise<PlatformPlanRow | null> {
  const [row] = await db.select().from(platformPlans).where(eq(platformPlans.id, id));
  return row ?? null;
}

export async function findPlatformPlanByName(
  db: Database,
  name: string,
): Promise<PlatformPlanRow | null> {
  const [row] = await db.select().from(platformPlans).where(eq(platformPlans.name, name));
  return row ?? null;
}
