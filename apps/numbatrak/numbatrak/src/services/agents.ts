import { apiRequest } from "../lib/apiClient";
import type { Agent } from "../types/agent";
import { emptyWithoutOrg } from "./orgQuery";

export type { Agent };

export type FetchAgentsOptions = {
  /** When true, only agents with active = true are returned. */
  activeOnly?: boolean;
};

/** Wire shape returned by GET/POST/PATCH /org/numbatrak/agents* (camelCase, per apps/api convention). */
interface AgentDto {
  id: number;
  name: string;
  locations: string[];
  active: boolean;
  isWarehouse: boolean;
  canDeliver: boolean;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  createdAt: string | null;
}

function fromDto(dto: AgentDto): Agent {
  return {
    id: dto.id,
    name: dto.name,
    locations: dto.locations,
    active: dto.active,
    is_warehouse: dto.isWarehouse,
    can_deliver: dto.canDeliver,
    contact_person: dto.contactPerson,
    contact_phone: dto.contactPhone,
    contact_email: dto.contactEmail,
    created_at: dto.createdAt,
  };
}

/**
 * Read all agents for the caller's active organization (implicit via
 * session - the org-facing routes never take an org id in the request).
 * `organizationId` is kept as a parameter purely as the existing
 * "has an org been selected yet" guard (see emptyWithoutOrg/useCachedData).
 */
export async function fetchAgents(
  organizationId: string | null,
  options?: FetchAgentsOptions
): Promise<Agent[]> {
  const empty = emptyWithoutOrg<Agent>(organizationId);
  if (empty) return empty;

  const { agents } = await apiRequest<{ agents: AgentDto[] }>("/org/numbatrak/agents");
  const mapped = agents.map(fromDto);
  return options?.activeOnly ? mapped.filter((a) => a.active) : mapped;
}

export function normalizeAgentContact(input: {
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
}): {
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
} {
  const trimOrNull = (value: string | null | undefined) => {
    const t = value?.trim();
    return t ? t : null;
  };
  const contact_email = trimOrNull(input.contact_email);
  if (contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
    throw new Error("Enter a valid email address or leave email blank.");
  }
  return {
    contact_person: trimOrNull(input.contact_person),
    contact_phone: trimOrNull(input.contact_phone),
    contact_email,
  };
}

export async function createAgent(input: {
  name: string;
  locations: string[];
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
}): Promise<Agent> {
  const contact = normalizeAgentContact(input);
  const dto = await apiRequest<AgentDto>("/org/numbatrak/agents", {
    method: "POST",
    body: {
      name: input.name,
      locations: input.locations,
      contactPerson: contact.contact_person,
      contactPhone: contact.contact_phone,
      contactEmail: contact.contact_email,
    },
  });
  return fromDto(dto);
}

export async function updateAgent(
  agentId: number,
  input: {
    name: string;
    locations: string[];
    active?: boolean;
    contact_person?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
  }
): Promise<Agent> {
  const contact = normalizeAgentContact(input);
  const dto = await apiRequest<AgentDto>(`/org/numbatrak/agents/${agentId}`, {
    method: "PATCH",
    body: {
      name: input.name,
      locations: input.locations,
      contactPerson: contact.contact_person,
      contactPhone: contact.contact_phone,
      contactEmail: contact.contact_email,
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
  return fromDto(dto);
}

/** Activate or deactivate an agent without deleting history. */
export async function setAgentActive(agentId: number, active: boolean): Promise<Agent> {
  const dto = await apiRequest<AgentDto>(`/org/numbatrak/agents/${agentId}/active`, {
    method: "PATCH",
    body: { active },
  });
  return fromDto(dto);
}

export async function removeAgent(agentId: number): Promise<void> {
  await apiRequest<void>(`/org/numbatrak/agents/${agentId}`, { method: "DELETE" });
}
