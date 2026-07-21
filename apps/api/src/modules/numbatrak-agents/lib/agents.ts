import { and, desc, eq } from "drizzle-orm";
import { numbatrakAgents, type Database } from "@platform/db";
import type { Agent, CreateAgentRequest, UpdateAgentRequest } from "@platform/shared-types";

export type AgentRow = typeof numbatrakAgents.$inferSelect;

/** Route params arrive as strings; the id column is bigint/number. */
export function parseAgentId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

function parseLocations(locations: string | null): string[] {
  if (!locations) return [];
  return locations
    .split(",")
    .map((loc) => loc.trim())
    .filter(Boolean);
}

export function serializeAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    locations: parseLocations(row.locations),
    active: row.active,
    isWarehouse: row.isWarehouse,
    canDeliver: row.canDeliver,
    contactPerson: row.contactPerson,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAgentsForOrg(db: Database, organizationId: string): Promise<AgentRow[]> {
  return db
    .select()
    .from(numbatrakAgents)
    .where(eq(numbatrakAgents.organizationId, organizationId))
    .orderBy(desc(numbatrakAgents.createdAt));
}

export async function createAgent(
  db: Database,
  organizationId: string,
  input: CreateAgentRequest,
): Promise<AgentRow> {
  const [row] = await db
    .insert(numbatrakAgents)
    .values({
      organizationId,
      name: input.name,
      locations: input.locations.join(", "),
      contactPerson: input.contactPerson ?? null,
      contactPhone: input.contactPhone ?? null,
      contactEmail: input.contactEmail ?? null,
    })
    .returning();
  if (!row) {
    throw new Error("Failed to create agent");
  }
  return row;
}

export async function updateAgent(
  db: Database,
  organizationId: string,
  agentId: number,
  patch: UpdateAgentRequest,
): Promise<AgentRow | null> {
  const { locations, ...rest } = patch;
  const [row] = await db
    .update(numbatrakAgents)
    .set({
      ...rest,
      ...(locations !== undefined ? { locations: locations.join(", ") } : {}),
    })
    .where(and(eq(numbatrakAgents.organizationId, organizationId), eq(numbatrakAgents.id, agentId)))
    .returning();
  return row ?? null;
}

export async function setAgentActive(
  db: Database,
  organizationId: string,
  agentId: number,
  active: boolean,
): Promise<AgentRow | null> {
  const [row] = await db
    .update(numbatrakAgents)
    .set({ active })
    .where(and(eq(numbatrakAgents.organizationId, organizationId), eq(numbatrakAgents.id, agentId)))
    .returning();
  return row ?? null;
}

export async function deleteAgent(db: Database, organizationId: string, agentId: number): Promise<boolean> {
  const result = await db
    .delete(numbatrakAgents)
    .where(and(eq(numbatrakAgents.organizationId, organizationId), eq(numbatrakAgents.id, agentId)))
    .returning({ id: numbatrakAgents.id });
  return result.length > 0;
}
