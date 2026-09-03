import { and, eq, isNull } from "drizzle-orm";
import { numbatrakDeliveryFeeRules, type Database, type Queryable } from "@platform/db";
import type { NumbatrakDeliveryFeeRule } from "@platform/shared-types";

type RuleRow = typeof numbatrakDeliveryFeeRules.$inferSelect;

function serializeRule(row: RuleRow): NumbatrakDeliveryFeeRule {
  return {
    id: row.id,
    state: row.state,
    fee: Number(row.fee),
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

function normalizeState(state: string | null): string | null {
  const trimmed = state?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export async function listDeliveryFeeRules(db: Database, organizationId: string): Promise<NumbatrakDeliveryFeeRule[]> {
  const rows = await db
    .select()
    .from(numbatrakDeliveryFeeRules)
    .where(eq(numbatrakDeliveryFeeRules.organizationId, organizationId));
  return rows.map(serializeRule);
}

export async function upsertDeliveryFeeRule(
  db: Database,
  organizationId: string,
  input: { state: string | null; fee: number },
): Promise<NumbatrakDeliveryFeeRule> {
  const state = normalizeState(input.state);

  const condition = state
    ? and(eq(numbatrakDeliveryFeeRules.organizationId, organizationId), eq(numbatrakDeliveryFeeRules.state, state))
    : and(eq(numbatrakDeliveryFeeRules.organizationId, organizationId), isNull(numbatrakDeliveryFeeRules.state));

  const [existing] = await db.select().from(numbatrakDeliveryFeeRules).where(condition).limit(1);
  if (existing) {
    const [row] = await db
      .update(numbatrakDeliveryFeeRules)
      .set({ fee: String(input.fee), updatedAt: new Date() })
      .where(eq(numbatrakDeliveryFeeRules.id, existing.id))
      .returning();
    return serializeRule(row!);
  }

  const [row] = await db
    .insert(numbatrakDeliveryFeeRules)
    .values({ organizationId, state, fee: String(input.fee) })
    .returning();
  return serializeRule(row!);
}

export async function deleteDeliveryFeeRule(db: Database, organizationId: string, ruleId: string): Promise<boolean> {
  const result = await db
    .delete(numbatrakDeliveryFeeRules)
    .where(and(eq(numbatrakDeliveryFeeRules.id, ruleId), eq(numbatrakDeliveryFeeRules.organizationId, organizationId)))
    .returning({ id: numbatrakDeliveryFeeRules.id });
  return result.length > 0;
}

/**
 * Fee for a form-submitted order's captured location - exact state match
 * first, falling back to the org's default rule, falling back to 0 if
 * nothing is configured (preserves the pre-existing "always 0" behavior for
 * orgs that haven't set this up).
 */
export async function getDeliveryFeeForLocation(
  db: Queryable,
  organizationId: string,
  state: string | null,
): Promise<number> {
  const normalized = normalizeState(state);
  const rows = await db
    .select({ state: numbatrakDeliveryFeeRules.state, fee: numbatrakDeliveryFeeRules.fee })
    .from(numbatrakDeliveryFeeRules)
    .where(eq(numbatrakDeliveryFeeRules.organizationId, organizationId));

  if (normalized) {
    const match = rows.find((r) => r.state === normalized);
    if (match) return Number(match.fee);
  }
  const fallback = rows.find((r) => r.state === null);
  return fallback ? Number(fallback.fee) : 0;
}
