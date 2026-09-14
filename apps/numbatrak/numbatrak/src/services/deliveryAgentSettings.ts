import { apiRequest } from "../lib/apiClient";

// Mirrors apps/api's @platform/shared-types numbatrakDeliveryAgentSettingsSchema
// shape locally rather than importing it - this app doesn't depend on
// @platform/shared-types (see lib/authApi.ts for the same convention).
export interface DeliveryAgentSettings {
  defaultAgentDeliveryFee: number;
}

interface DeliveryAgentSettingsRow extends DeliveryAgentSettings {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export const DEFAULT_DELIVERY_AGENT_SETTINGS: DeliveryAgentSettings = {
  defaultAgentDeliveryFee: 0,
};

function toSettings(row: DeliveryAgentSettingsRow): DeliveryAgentSettings {
  return { defaultAgentDeliveryFee: row.defaultAgentDeliveryFee };
}

export async function loadDeliveryAgentSettings(
  organizationId: string | null | undefined
): Promise<DeliveryAgentSettings> {
  if (!organizationId) return { ...DEFAULT_DELIVERY_AGENT_SETTINGS };
  try {
    const row = await apiRequest<DeliveryAgentSettingsRow>("/org/numbatrak/agents/settings");
    return toSettings(row);
  } catch {
    return { ...DEFAULT_DELIVERY_AGENT_SETTINGS };
  }
}

export async function saveDeliveryAgentSettings(
  settings: DeliveryAgentSettings
): Promise<DeliveryAgentSettings> {
  const row = await apiRequest<DeliveryAgentSettingsRow>("/org/numbatrak/agents/settings", {
    method: "PATCH",
    body: settings,
  });
  return toSettings(row);
}
