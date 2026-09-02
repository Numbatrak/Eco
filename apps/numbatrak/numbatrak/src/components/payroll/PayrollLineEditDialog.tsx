import { FormEvent, useEffect, useState } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { PenLine, X, Check, RotateCcw } from "lucide-react";
import { sanitizeDecimalInput, sanitizeSignedDecimalInput } from "../../utils/numericInput";
import type { PayrollLine } from "../../services/payroll";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);
}

export interface PayrollLineEditValues {
  overrideBaseSalary: number | null;
  overrideCommission: number | null;
  manualAdjustment: number;
  manualAdjustmentNote: string | null;
}

interface PayrollLineEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line: PayrollLine | null;
  saving: boolean;
  error: string | null;
  onSubmit: (values: PayrollLineEditValues) => Promise<void>;
}

export function PayrollLineEditDialog({ open, onOpenChange, line, saving, error, onSubmit }: PayrollLineEditDialogProps) {
  const [overrideBase, setOverrideBase] = useState("");
  const [overrideCommission, setOverrideCommission] = useState("");
  const [adjustment, setAdjustment] = useState("0");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !line) return;
    setLocalError(null);
    setOverrideBase(line.override_base_salary != null ? String(line.override_base_salary) : "");
    setOverrideCommission(line.override_commission != null ? String(line.override_commission) : "");
    setAdjustment(String(line.manual_adjustment ?? 0));
    setAdjustmentNote(line.manual_adjustment_note ?? "");
  }, [open, line]);

  if (!line) return null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    const adjustmentValue = parseFloat(adjustment) || 0;
    if (adjustmentValue !== 0 && !adjustmentNote.trim()) {
      setLocalError("A note is required for a manual adjustment.");
      return;
    }

    try {
      await onSubmit({
        overrideBaseSalary: overrideBase.trim() === "" ? null : parseFloat(overrideBase) || 0,
        overrideCommission: overrideCommission.trim() === "" ? null : parseFloat(overrideCommission) || 0,
        manualAdjustment: adjustmentValue,
        manualAdjustmentNote: adjustmentValue !== 0 ? adjustmentNote.trim() : null,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : "Failed to save changes.");
    }
  };

  const displayError = localError || error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<PenLine className="h-7 w-7" aria-hidden />}
          title={`Edit line — ${line.staff_name ?? line.staff_id}`}
          description="Overrides stick through a re-run but are always reversible"
        />

        <div className="dialog-body-scroll max-h-standard p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {displayError && <ErrorAlert message={displayError} />}

            <div className="dialog-form-field space-y-2">
              <div className="flex items-center justify-between">
                <Label className="dialog-field-label">
                  Base salary override (calculated: {formatCurrency(line.calculated_base_salary)})
                </Label>
                {overrideBase !== "" && (
                  <button
                    type="button"
                    onClick={() => setOverrideBase("")}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>
              <Input
                type="text"
                inputMode="decimal"
                value={overrideBase}
                onChange={(e) => setOverrideBase(sanitizeDecimalInput(e.target.value))}
                placeholder="Leave blank to use the calculated figure"
              />
            </div>

            <div className="dialog-form-field space-y-2">
              <div className="flex items-center justify-between">
                <Label className="dialog-field-label">
                  Commission override (calculated: {formatCurrency(line.calculated_commission)})
                </Label>
                {overrideCommission !== "" && (
                  <button
                    type="button"
                    onClick={() => setOverrideCommission("")}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>
              <Input
                type="text"
                inputMode="decimal"
                value={overrideCommission}
                onChange={(e) => setOverrideCommission(sanitizeDecimalInput(e.target.value))}
                placeholder="Leave blank to use the calculated figure"
              />
            </div>

            <div className="dialog-form-field space-y-2 pt-2 border-t border-border">
              <Label className="dialog-field-label">Manual adjustment (+/-)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={adjustment}
                onChange={(e) => setAdjustment(sanitizeSignedDecimalInput(e.target.value))}
                placeholder="e.g. -5000 for a deduction, 5000 for a reimbursement"
              />
            </div>

            <div className="dialog-form-field space-y-2">
              <Label className="dialog-field-label">Adjustment note {parseFloat(adjustment) !== 0 && "*"}</Label>
              <Textarea
                value={adjustmentNote}
                onChange={(e) => setAdjustmentNote(e.target.value)}
                rows={2}
                placeholder="Why is this adjustment being made?"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button type="button" variant="secondary" className="gap-2" disabled={saving} onClick={() => onOpenChange(false)}>
                <X className="w-4 h-4" />
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                <Check className="w-4 h-4" />
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
