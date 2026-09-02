import { FormEvent, useEffect, useState } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Settings2, X, Check } from "lucide-react";
import { sanitizeDecimalInput } from "../../utils/numericInput";
import type { PayStructure, UpsertPayStructureInput } from "../../services/payroll";
import type { Staff } from "../../types/staff";
import type { SpecRole } from "../../utils/specRoles";

const SPEC_ROLES: SpecRole[] = ["CRS", "Manager", "Admin", "Media", "Accountant", "Founder"];

export type PayStructureFormValues = UpsertPayStructureInput;

interface PayStructureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  structure: PayStructure | null;
  staff: Staff[];
  saving: boolean;
  error: string | null;
  onSubmit: (values: PayStructureFormValues) => Promise<void>;
}

function num(v: string): number {
  return parseFloat(v) || 0;
}

export function PayStructureDialog({
  open,
  onOpenChange,
  structure,
  staff,
  saving,
  error,
  onSubmit,
}: PayStructureDialogProps) {
  const [scopeType, setScopeType] = useState<"role" | "staff">("role");
  const [role, setRole] = useState<SpecRole>("CRS");
  const [staffId, setStaffId] = useState("");

  const [baseSalaryEnabled, setBaseSalaryEnabled] = useState(false);
  const [baseSalaryAmount, setBaseSalaryAmount] = useState("0");

  const [commissionEnabled, setCommissionEnabled] = useState(false);
  const [commissionBasis, setCommissionBasis] = useState<"flat_per_order" | "percentage_of_sale">("flat_per_order");
  const [commissionRate, setCommissionRate] = useState("0");
  const [commissionGateEnabled, setCommissionGateEnabled] = useState(false);
  const [commissionGateThresholdPercent, setCommissionGateThresholdPercent] = useState("0");

  const [upsellBonusEnabled, setUpsellBonusEnabled] = useState(false);
  const [upsellBonusAmount, setUpsellBonusAmount] = useState("0");

  const [sotmBonusEnabled, setSotmBonusEnabled] = useState(false);
  const [sotmBonusAmount, setSotmBonusAmount] = useState("0");

  const [managerBonusEnabled, setManagerBonusEnabled] = useState(false);
  const [managerBonusAmount, setManagerBonusAmount] = useState("0");
  const [managerGateEnabled, setManagerGateEnabled] = useState(false);
  const [managerGateTeamRatioPercent, setManagerGateTeamRatioPercent] = useState("50");
  const [managerGateKpiThresholdPercent, setManagerGateKpiThresholdPercent] = useState("0");

  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    if (structure) {
      setScopeType(structure.scope_type);
      setRole((structure.role as SpecRole) ?? "CRS");
      setStaffId(structure.staff_id ?? "");
      setBaseSalaryEnabled(structure.base_salary_enabled);
      setBaseSalaryAmount(String(structure.base_salary_amount));
      setCommissionEnabled(structure.commission_enabled);
      setCommissionBasis(structure.commission_basis ?? "flat_per_order");
      setCommissionRate(String(structure.commission_rate));
      setCommissionGateEnabled(structure.commission_gate_enabled);
      setCommissionGateThresholdPercent(String(structure.commission_gate_threshold_percent));
      setUpsellBonusEnabled(structure.upsell_bonus_enabled);
      setUpsellBonusAmount(String(structure.upsell_bonus_amount));
      setSotmBonusEnabled(structure.sotm_bonus_enabled);
      setSotmBonusAmount(String(structure.sotm_bonus_amount));
      setManagerBonusEnabled(structure.manager_bonus_enabled);
      setManagerBonusAmount(String(structure.manager_bonus_amount));
      setManagerGateEnabled(structure.manager_gate_enabled);
      setManagerGateTeamRatioPercent(String(structure.manager_gate_team_ratio_percent));
      setManagerGateKpiThresholdPercent(String(structure.manager_gate_kpi_threshold_percent));
    } else {
      setScopeType("role");
      setRole("CRS");
      setStaffId("");
      setBaseSalaryEnabled(false);
      setBaseSalaryAmount("0");
      setCommissionEnabled(false);
      setCommissionBasis("flat_per_order");
      setCommissionRate("0");
      setCommissionGateEnabled(false);
      setCommissionGateThresholdPercent("0");
      setUpsellBonusEnabled(false);
      setUpsellBonusAmount("0");
      setSotmBonusEnabled(false);
      setSotmBonusAmount("0");
      setManagerBonusEnabled(false);
      setManagerBonusAmount("0");
      setManagerGateEnabled(false);
      setManagerGateTeamRatioPercent("50");
      setManagerGateKpiThresholdPercent("0");
    }
  }, [open, structure]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    if (scopeType === "staff" && !staffId) {
      setLocalError("Select a staff member.");
      return;
    }
    if (commissionEnabled && !commissionBasis) {
      setLocalError("Choose a commission basis.");
      return;
    }

    try {
      await onSubmit({
        scopeType,
        role: scopeType === "role" ? role : null,
        staffId: scopeType === "staff" ? staffId : null,
        baseSalaryEnabled,
        baseSalaryAmount: num(baseSalaryAmount),
        commissionEnabled,
        commissionBasis: commissionEnabled ? commissionBasis : null,
        commissionRate: num(commissionRate),
        commissionGateEnabled,
        commissionGateThresholdPercent: num(commissionGateThresholdPercent),
        upsellBonusEnabled,
        upsellBonusAmount: num(upsellBonusAmount),
        sotmBonusEnabled,
        sotmBonusAmount: num(sotmBonusAmount),
        managerBonusEnabled,
        managerBonusAmount: num(managerBonusAmount),
        managerGateEnabled,
        managerGateTeamRatioPercent: num(managerGateTeamRatioPercent),
        managerGateKpiThresholdPercent: num(managerGateKpiThresholdPercent),
      });
      onOpenChange(false);
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : "Failed to save pay structure.");
    }
  };

  const displayError = localError || error;
  const activeStaff = staff.filter((s) => s.active !== false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<Settings2 className="h-7 w-7" aria-hidden />}
          title={structure ? "Edit pay structure" : "New pay structure"}
          description="Toggle which pay components apply and set their amounts"
        />

        <div className="dialog-body-scroll max-h-standard p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {displayError && <ErrorAlert message={displayError} />}

            <div className="dialog-form-field space-y-2">
              <Label className="dialog-field-label">Applies to *</Label>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={scopeType}
                  onValueChange={(v) => setScopeType(v as "role" | "staff")}
                  disabled={!!structure}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="role">A role (tier)</SelectItem>
                    <SelectItem value="staff">One staff member (override)</SelectItem>
                  </SelectContent>
                </Select>

                {scopeType === "role" ? (
                  <Select value={role} onValueChange={(v) => setRole(v as SpecRole)} disabled={!!structure}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPEC_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={staffId || "none"} onValueChange={(v) => setStaffId(v === "none" ? "" : v)} disabled={!!structure}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select staff" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select staff</SelectItem>
                      {activeStaff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.user_name ?? s.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Base salary */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="dialog-field-label">Base salary — always safe, no gate touches it</Label>
                <Switch checked={baseSalaryEnabled} onCheckedChange={setBaseSalaryEnabled} />
              </div>
              {baseSalaryEnabled && (
                <Input
                  type="text"
                  inputMode="decimal"
                  value={baseSalaryAmount}
                  onChange={(e) => setBaseSalaryAmount(sanitizeDecimalInput(e.target.value))}
                  placeholder="Monthly amount (₦)"
                />
              )}
            </div>

            {/* Commission */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="dialog-field-label">Commission</Label>
                <Switch checked={commissionEnabled} onCheckedChange={setCommissionEnabled} />
              </div>
              {commissionEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={commissionBasis} onValueChange={(v) => setCommissionBasis(v as typeof commissionBasis)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat_per_order">Flat per delivered order</SelectItem>
                        <SelectItem value="percentage_of_sale">Percentage of sale</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(sanitizeDecimalInput(e.target.value))}
                      placeholder={commissionBasis === "flat_per_order" ? "₦ per order" : "% of sale"}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <Label className="dialog-field-label text-sm">
                      Delivery-rate gate — optional. Missing it zeroes the whole month&apos;s commission
                    </Label>
                    <Switch checked={commissionGateEnabled} onCheckedChange={setCommissionGateEnabled} />
                  </div>
                  {commissionGateEnabled && (
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={commissionGateThresholdPercent}
                      onChange={(e) => setCommissionGateThresholdPercent(sanitizeDecimalInput(e.target.value))}
                      placeholder="Delivery-rate threshold (e.g. 65%)"
                    />
                  )}
                </>
              )}
            </div>

            {/* Upsell */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="dialog-field-label">Upsell bonus — never gated</Label>
                <Switch checked={upsellBonusEnabled} onCheckedChange={setUpsellBonusEnabled} />
              </div>
              {upsellBonusEnabled && (
                <Input
                  type="text"
                  inputMode="decimal"
                  value={upsellBonusAmount}
                  onChange={(e) => setUpsellBonusAmount(sanitizeDecimalInput(e.target.value))}
                  placeholder="₦ per upsell"
                />
              )}
            </div>

            {/* SOTM */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="dialog-field-label">Star of the Month bonus</Label>
                <Switch checked={sotmBonusEnabled} onCheckedChange={setSotmBonusEnabled} />
              </div>
              {sotmBonusEnabled && (
                <Input
                  type="text"
                  inputMode="decimal"
                  value={sotmBonusAmount}
                  onChange={(e) => setSotmBonusAmount(sanitizeDecimalInput(e.target.value))}
                  placeholder="₦ if awarded"
                />
              )}
            </div>

            {/* Manager bonus */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="dialog-field-label">Manager bonus</Label>
                <Switch checked={managerBonusEnabled} onCheckedChange={setManagerBonusEnabled} />
              </div>
              {managerBonusEnabled && (
                <>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={managerBonusAmount}
                    onChange={(e) => setManagerBonusAmount(sanitizeDecimalInput(e.target.value))}
                    placeholder="₦ per month"
                  />
                  <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <Label className="dialog-field-label text-sm">
                      Team-ratio gate — optional. Pays only if enough of the team hit their KPI
                    </Label>
                    <Switch checked={managerGateEnabled} onCheckedChange={setManagerGateEnabled} />
                  </div>
                  {managerGateEnabled && (
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={managerGateTeamRatioPercent}
                        onChange={(e) => setManagerGateTeamRatioPercent(sanitizeDecimalInput(e.target.value))}
                        placeholder="% of team required (default 50)"
                      />
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={managerGateKpiThresholdPercent}
                        onChange={(e) => setManagerGateKpiThresholdPercent(sanitizeDecimalInput(e.target.value))}
                        placeholder="KPI threshold (delivery rate %)"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button type="button" variant="secondary" className="gap-2" disabled={saving} onClick={() => onOpenChange(false)}>
                <X className="w-4 h-4" />
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                <Check className="w-4 h-4" />
                {saving ? "Saving…" : "Save pay structure"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
