import { apiRequest } from "../lib/apiClient";

// Mirrors apps/api's @platform/shared-types numbatrakNotificationSettingsSchema
// shape locally rather than importing it - this app doesn't depend on
// @platform/shared-types (see lib/authApi.ts for the same convention).
export interface NotificationSettings {
  dailySummaryEnabled: boolean;
  additionalRecipients: string | null;
}

interface NotificationSettingsRow extends NotificationSettings {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailySummaryEnabled: true,
  additionalRecipients: null,
};

function toSettings(row: NotificationSettingsRow): NotificationSettings {
  return {
    dailySummaryEnabled: row.dailySummaryEnabled,
    additionalRecipients: row.additionalRecipients,
  };
}

export async function loadNotificationSettings(
  organizationId: string | null | undefined
): Promise<NotificationSettings> {
  if (!organizationId) return { ...DEFAULT_NOTIFICATION_SETTINGS };
  try {
    const row = await apiRequest<NotificationSettingsRow>("/org/numbatrak/dashboard/notification-settings");
    return toSettings(row);
  } catch {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }
}

export async function saveNotificationSettings(
  settings: NotificationSettings
): Promise<NotificationSettings> {
  const row = await apiRequest<NotificationSettingsRow>("/org/numbatrak/dashboard/notification-settings", {
    method: "PATCH",
    body: settings,
  });
  return toSettings(row);
}
