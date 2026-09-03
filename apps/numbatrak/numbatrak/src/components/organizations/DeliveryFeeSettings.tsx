import { useEffect, useState } from "react";
import {
  fetchDeliveryFeeRules,
  upsertDeliveryFeeRule,
  deleteDeliveryFeeRule,
  type DeliveryFeeRule,
} from "../../services/deliveryFees";
import { sanitizeDecimalInput } from "../../utils/numericInput";
import { Trash2, Plus } from "lucide-react";

interface DeliveryFeeSettingsProps {
  organizationId: string;
}

export function DeliveryFeeSettings({ organizationId }: DeliveryFeeSettingsProps) {
  const [rules, setRules] = useState<DeliveryFeeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaultFee, setDefaultFee] = useState("0");
  const [newState, setNewState] = useState("");
  const [newFee, setNewFee] = useState("0");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchDeliveryFeeRules();
      setRules(data);
      setDefaultFee(String(data.find((r) => r.state === null)?.fee ?? 0));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [organizationId]);

  const stateRules = rules.filter((r) => r.state !== null);

  const handleSaveDefault = async () => {
    await upsertDeliveryFeeRule(null, Number(defaultFee) || 0);
    void load();
  };

  const handleAddRule = async () => {
    if (!newState.trim()) return;
    await upsertDeliveryFeeRule(newState.trim(), Number(newFee) || 0);
    setNewState("");
    setNewFee("0");
    void load();
  };

  const handleDelete = async (ruleId: string) => {
    await deleteDeliveryFeeRule(ruleId);
    void load();
  };

  if (loading) return null;

  return (
    <div className="space-y-4 p-4 rounded-lg border border-border bg-card">
      <div>
        <h3 className="font-medium text-foreground">Delivery Fee by Location</h3>
        <p className="text-sm text-muted-foreground">
          Location captured on an Order Form drives the delivery fee automatically. Set a default and any state-specific overrides.
        </p>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Default fee (₦)</label>
          <input
            type="text"
            inputMode="decimal"
            value={defaultFee}
            onChange={(e) => setDefaultFee(sanitizeDecimalInput(e.target.value))}
            className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm w-32"
          />
        </div>
        <button
          onClick={handleSaveDefault}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          Save default
        </button>
      </div>

      <div className="pt-3 border-t border-border space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">State / location</label>
            <input
              type="text"
              value={newState}
              onChange={(e) => setNewState(e.target.value)}
              placeholder="e.g. Lagos"
              className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Fee (₦)</label>
            <input
              type="text"
              inputMode="decimal"
              value={newFee}
              onChange={(e) => setNewFee(sanitizeDecimalInput(e.target.value))}
              className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm w-28"
            />
          </div>
          <button
            onClick={handleAddRule}
            disabled={!newState.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add override
          </button>
        </div>

        {stateRules.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">State</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Fee</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stateRules.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 capitalize text-foreground">{r.state}</td>
                    <td className="px-3 py-2 text-right text-foreground">₦{r.fee.toLocaleString("en-NG")}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
