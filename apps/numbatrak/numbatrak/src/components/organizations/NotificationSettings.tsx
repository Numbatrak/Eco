import { useEffect, useState } from "react";
import { Bell, Save } from "lucide-react";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  loadNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings as NotificationSettingsData,
} from "../../services/notificationSettings";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";

interface NotificationSettingsProps {
  organizationId: string;
}

export function NotificationSettings({ organizationId }: NotificationSettingsProps) {
  const [settings, setSettings] = useState<NotificationSettingsData>(DEFAULT_NOTIFICATION_SETTINGS);
  const [recipientsInput, setRecipientsInput] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadNotificationSettings(organizationId).then((loaded) => {
      if (!cancelled) {
        setSettings(loaded);
        setRecipientsInput(loaded.additionalRecipients ?? "");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const handleSave = async () => {
    const next = {
      ...settings,
      additionalRecipients: recipientsInput.trim() === "" ? null : recipientsInput.trim(),
    };
    const saved = await saveNotificationSettings(next);
    setSettings(saved);
    setRecipientsInput(saved.additionalRecipients ?? "");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="org-settings-section">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="w-5 h-5 text-primary" />
        <h2 className="org-settings-section-title mb-0">Notification settings</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Control the automated daily summary email sent to this organization's owner, and
        add any extra people who should also receive it.
      </p>

      <div className="org-settings-theme-toggle mb-4">
        <div className="org-settings-theme-info">
          <div>
            <h3 className="org-settings-theme-label">Daily summary email</h3>
            <p className="org-settings-theme-description">
              Send a daily order/delivery/profit summary to the organization owner
            </p>
          </div>
        </div>
        <Switch
          checked={settings.dailySummaryEnabled}
          onCheckedChange={(checked: boolean) => setSettings({ ...settings, dailySummaryEnabled: checked })}
        />
      </div>

      <label className="flex flex-col gap-1 text-sm max-w-md mb-4">
        <span className="text-muted-foreground">Additional recipients (comma-separated emails)</span>
        <input
          type="text"
          value={recipientsInput}
          onChange={(e) => setRecipientsInput(e.target.value)}
          placeholder="finance@example.com, ops@example.com"
          className="org-settings-text-input"
        />
      </label>

      <Button type="button" onClick={handleSave} className="gap-2">
        <Save className="w-4 h-4" />
        {saved ? "Saved" : "Save"}
      </Button>
    </div>
  );
}
