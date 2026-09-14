import { useEffect, useState } from "react";
import { Boxes, Save } from "lucide-react";
import {
  DEFAULT_INVENTORY_SETTINGS,
  loadInventorySettings,
  saveInventorySettings,
  type InventorySettings as InventorySettingsData,
} from "../../services/inventorySettings";
import { Button } from "../ui/button";
import { sanitizeIntegerInput } from "../../utils/numericInput";

interface InventorySettingsProps {
  organizationId: string;
}

export function InventorySettings({ organizationId }: InventorySettingsProps) {
  const [settings, setSettings] = useState<InventorySettingsData>(DEFAULT_INVENTORY_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadInventorySettings(organizationId).then((loaded) => {
      if (!cancelled) setSettings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const handleSave = async () => {
    await saveInventorySettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="org-settings-section">
      <div className="flex items-center gap-2 mb-2">
        <Boxes className="w-5 h-5 text-primary" />
        <h2 className="org-settings-section-title mb-0">Inventory settings</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Default low-stock threshold used for any product that doesn't have its own
        threshold set (Products → edit product). A product's own value always takes
        priority over this default.
      </p>

      <label className="flex flex-col gap-1 text-sm max-w-xs mb-4">
        <span className="text-muted-foreground">Default low-stock threshold (units)</span>
        <input
          type="text"
          inputMode="numeric"
          value={settings.defaultLowStockThreshold}
          onChange={(e) => {
            const v = sanitizeIntegerInput(e.target.value);
            setSettings({ defaultLowStockThreshold: v === "" ? 0 : Number(v) });
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
