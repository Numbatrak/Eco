import type { Agent } from "../types/agent";

/** Agents eligible for new assignments (active only, can deliver, not warehouse). */
export function filterActiveAgents(agents: Agent[]): Agent[] {
  return agents.filter(
    (agent) =>
      agent.active !== false &&
      agent.can_deliver !== false &&
      agent.is_warehouse !== true
  );
}

/** Agents that can hold stock for transfers (includes warehouse). */
export function filterStockHolders(agents: Agent[]): Agent[] {
  return agents.filter((agent) => agent.active !== false);
}

/** Delivering agents only — excludes warehouse and can_deliver=false. */
export function filterDeliveringAgents(agents: Agent[]): Agent[] {
  return filterActiveAgents(agents);
}

/**
 * Active agents plus the currently assigned agent (if deactivated),
 * so existing records remain editable without exposing all inactive agents.
 */
export function agentsForAssignment(
  agents: Agent[],
  currentAgentId?: number | null
): Agent[] {
  const active = filterActiveAgents(agents);
  if (currentAgentId == null) {
    return active;
  }
  if (active.some((agent) => agent.id === currentAgentId)) {
    return active;
  }
  const current = agents.find((agent) => agent.id === currentAgentId);
  return current ? [current, ...active] : active;
}
