import { useEffect, useState } from "react";
import { Truck, Save } from "lucide-react";
import {
  DEFAULT_DELIVERY_AGENT_SETTINGS,
  loadDeliveryAgentSettings,
  saveDeliveryAgentSettings,
  type DeliveryAgentSettings as DeliveryAgentSettingsData,
} from "../../services/deliveryAgentSettings";
import { Button } from "../ui/button";
import { sanitizeDecimalInput } from "../../utils/numericInput";

interface DeliveryAgentSettingsProps {
  organizationId: string;
}

export function DeliveryAgentSettings({ organizationId }: DeliveryAgentSettingsProps) {
  const [settings, setSettings] = useState<DeliveryAgentSettingsData>(DEFAULT_DELIVERY_AGENT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadDeliveryAgentSettings(organizationId).then((loaded) => {
      if (!cancelled) setSettings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const handleSave = async () => {
    await saveDeliveryAgentSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="org-settings-section">
      <div className="flex items-center gap-2 mb-2">
        <Truck className="w-5 h-5 text-primary" />
        <h2 className="org-settings-section-title mb-0">Delivery agent settings</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Default delivery fee for agents that don't have their own override (Agents →
        edit agent). An agent's own override always takes priority over this default.
        Not yet wired into remittance calculations, which still use each order's own
        delivery fee — this is a stored default only.
      </p>

      <label className="flex flex-col gap-1 text-sm max-w-xs mb-4">
        <span className="text-muted-foreground">Default delivery fee (₦)</span>
        <input
          type="text"
          inputMode="decimal"
          value={settings.defaultAgentDeliveryFee}
          onChange={(e) => {
            const v = sanitizeDecimalInput(e.target.value);
            setSettings({ defaultAgentDeliveryFee: v === "" ? 0 : Number(v) });
          }}
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
