import { apiRequest } from "../lib/apiClient";

// Mirrors apps/api's @platform/shared-types numbatrakInventorySettingsSchema
// shape locally rather than importing it - this app doesn't depend on
// @platform/shared-types (see lib/authApi.ts for the same convention).
export interface InventorySettings {
  defaultLowStockThreshold: number;
}

interface InventorySettingsRow extends InventorySettings {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export const DEFAULT_INVENTORY_SETTINGS: InventorySettings = {
  defaultLowStockThreshold: 5,
};

function toSettings(row: InventorySettingsRow): InventorySettings {
  return { defaultLowStockThreshold: row.defaultLowStockThreshold };
}

export async function loadInventorySettings(
  organizationId: string | null | undefined
): Promise<InventorySettings> {
  if (!organizationId) return { ...DEFAULT_INVENTORY_SETTINGS };
  try {
    const row = await apiRequest<InventorySettingsRow>("/org/numbatrak/inventory/settings");
    return toSettings(row);
  } catch {
    return { ...DEFAULT_INVENTORY_SETTINGS };
  }
}

export async function saveInventorySettings(settings: InventorySettings): Promise<InventorySettings> {
  const row = await apiRequest<InventorySettingsRow>("/org/numbatrak/inventory/settings", {
    method: "PATCH",
    body: settings,
  });
  return toSettings(row);
}
