import { useEffect, useState } from "react";
import { Gauge, RotateCcw, Save } from "lucide-react";
import {
  DEFAULT_DASHBOARD_ALERT_THRESHOLDS,
  DASHBOARD_WATCHERS,
  WATCHER_LABELS,
  type DashboardAlertThresholds,
} from "../../constants/dashboardAlerts";
import {
  loadDashboardAlertThresholds,
  saveDashboardAlertThresholds,
  resetDashboardAlertThresholds,
} from "../../services/dashboardAlertSettings";
import { Button } from "../ui/button";
import { sanitizeDecimalInput, sanitizeIntegerInput } from "../../utils/numericInput";

interface DashboardAlertThresholdsSettingsProps {
  organizationId: string;
  onSaved?: () => void;
}

type ThresholdField = {
  key: keyof DashboardAlertThresholds;
  label: string;
  step?: number;
  suffix?: string;
};

const FIELDS: ThresholdField[] = [
  { key: "deliveryRateGreen", label: "Delivery rate — green from (%)", step: 1, suffix: "%" },
  { key: "deliveryRateAmber", label: "Delivery rate — amber from (%)", step: 1, suffix: "%" },
  { key: "deliveryRateAlert", label: "Delivery rate — alert below (%)", step: 1, suffix: "%" },
  { key: "roasGreen", label: "ROAS — green from (×)", step: 0.1, suffix: "×" },
  { key: "roasAmber", label: "ROAS — amber from (×)", step: 0.1, suffix: "×" },
  { key: "profitPerOrderGreen", label: "Profit/order — green above (₦)", step: 100 },
  { key: "profitPerOrderAmber", label: "Profit/order — amber from (₦)", step: 100 },
  { key: "businessRoiGreen", label: "Business ROI — green from (×)", step: 0.05, suffix: "×" },
  { key: "businessRoiAmber", label: "Business ROI — amber from (×)", step: 0.05, suffix: "×" },
  { key: "realCpaAovGreen", label: "Real CPA ÷ AOV — green up to (ratio)", step: 0.05 },
  { key: "realCpaAovAmber", label: "Real CPA ÷ AOV — amber up to (ratio)", step: 0.05 },
  { key: "minUndeliveredForAlert", label: "Undelivered loss — min orders", step: 1 },
  { key: "minWouldBeSalesForAlert", label: "Undelivered loss — min would-be sales (₦)", step: 1000 },
  { key: "cpaWeekOnWeekIncreasePct", label: "Real CPA — week-on-week alert (%)", step: 1, suffix: "%" },
];

export function DashboardAlertThresholdsSettings({
  organizationId,
  onSaved,
}: DashboardAlertThresholdsSettingsProps) {
  const [thresholds, setThresholds] = useState<DashboardAlertThresholds>(
    DEFAULT_DASHBOARD_ALERT_THRESHOLDS
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadDashboardAlertThresholds(organizationId).then((loaded) => {
      if (!cancelled) setThresholds(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const handleSave = async () => {
    await saveDashboardAlertThresholds(thresholds);
    setSaved(true);
    onSaved?.();
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = async () => {
    const reset = await resetDashboardAlertThresholds();
    setThresholds(reset);
    onSaved?.();
  };

  return (
    <div className="org-settings-section">
      <div className="flex items-center gap-2 mb-2">
        <Gauge className="w-5 h-5 text-primary" />
        <h2 className="org-settings-section-title mb-0">
          Dashboard alert thresholds
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Six watchers ({DASHBOARD_WATCHERS.map((w) => WATCHER_LABELS[w]).join(", ")})
        use these values for colour tonation and the notification bell. Shared
        across everyone in this organization.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {FIELDS.map(({ key, label, step = 1, suffix }) => {
          const isDecimal = !Number.isInteger(step);
          const sanitize = isDecimal ? sanitizeDecimalInput : sanitizeIntegerInput;
          return (
          <label key={key} className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode={isDecimal ? "decimal" : "numeric"}
                value={thresholds[key]}
                onChange={(e) => {
                  const v = sanitize(e.target.value);
                  setThresholds((prev) => ({
                    ...prev,
                    [key]: v === "" ? 0 : Number(v),
                  }));
                }}
                className="org-settings-text-input flex-1"
              />
              {suffix && (
                <span className="text-muted-foreground text-xs shrink-0">
                  {suffix}
                </span>
              )}
            </div>
          </label>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleSave} className="gap-2">
          <Save className="w-4 h-4" />
          {saved ? "Saved" : "Save thresholds"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset defaults
        </Button>
      </div>
    </div>
  );
}
