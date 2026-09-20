import { useCallback, useEffect, useState } from "react";
import { Wallet, Plus } from "lucide-react";
import { fetchStaff } from "../../services/staff";
import type { Staff } from "../../types/staff";
import {
  fetchPayStructures,
  upsertPayStructure,
  type PayStructure,
} from "../../services/payroll";
import { PayStructureDialog, type PayStructureFormValues } from "../payroll/PayStructureDialog";

interface PayrollSettingsProps {
  organizationId: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);
}

/**
 * Reuses the same pay-structure list/dialog/services as
 * components/payroll/PayrollPage.tsx - this is the same configuration, just
 * also reachable from Organization Settings (product owner asked for this in
 * both the Sept 10 and Sept 13 requirement reviews). Payroll runs/lines stay
 * on the dedicated Payroll page; only pay-structure configuration lives here.
 */
export function PayrollSettings({ organizationId }: PayrollSettingsProps) {
  const [structures, setStructures] = useState<PayStructure[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState<PayStructure | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [s, staffList] = await Promise.all([fetchPayStructures(), fetchStaff(organizationId)]);
      setStructures(s);
      setStaff(staffList);
    } catch (err) {
      console.error("Failed to load pay structures", err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditingStructure(null);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (structure: PayStructure) => {
    setEditingStructure(structure);
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async (values: PayStructureFormValues) => {
    setSaving(true);
    setError(null);
    try {
      await upsertPayStructure(values);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pay structure.");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="org-settings-section">
      <PayStructureDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        structure={editingStructure}
        staff={staff}
        saving={saving}
        error={error}
        onSubmit={handleSave}
      />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          <h2 className="org-settings-section-title mb-0">Payroll</h2>
        </div>
        <button onClick={openNew} className="org-settings-action-btn">
          <Plus className="w-4 h-4" />
          Add pay structure
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Pay structures configured here apply to running payroll on the Payroll page - toggle
        which pay components apply per role or per staff member.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : structures.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {structures.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => openEdit(s)}
              className="text-left p-4 rounded-lg border border-border bg-card hover:border-primary cursor-pointer"
            >
              <div className="font-medium text-foreground mb-2">
                {s.scope_type === "role" ? `Role: ${s.role}` : `Staff: ${s.staff_name ?? s.staff_id}`}
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                {s.base_salary_enabled && <div>Base: {formatCurrency(s.base_salary_amount)}</div>}
                {s.commission_enabled && (
                  <div>
                    Commission: {s.commission_basis === "flat_per_order" ? formatCurrency(s.commission_rate) + "/order" : s.commission_rate + "%"}
                    {s.commission_gate_enabled && ` (gate: ${s.commission_gate_threshold_percent}% delivery rate)`}
                  </div>
                )}
                {s.upsell_bonus_enabled && <div>Upsell: {formatCurrency(s.upsell_bonus_amount)}/upsell</div>}
                {s.sotm_bonus_enabled && <div>SOTM: {formatCurrency(s.sotm_bonus_amount)}</div>}
                {s.manager_bonus_enabled && (
                  <div>
                    Manager: {formatCurrency(s.manager_bonus_amount)}
                    {s.manager_gate_enabled && ` (gate: ${s.manager_gate_team_ratio_percent}% of team @ ${s.manager_gate_kpi_threshold_percent}% KPI)`}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-lg text-sm">
          No pay structures set — add one per role or staff member to start paying people through Payroll.
        </div>
      )}
    </div>
  );
}
