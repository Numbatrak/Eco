import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { Button } from "../ui/button";
import { FileSearch, X } from "lucide-react";
import type { PayrollTrace } from "../../services/payroll";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);
}

interface PayrollTraceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trace: PayrollTrace | null;
  loading: boolean;
}

export function PayrollTraceDialog({ open, onOpenChange, trace, loading }: PayrollTraceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<FileSearch className="h-7 w-7" aria-hidden />}
          title={trace ? `${trace.staff_name ?? trace.staff_id} — ${trace.month}` : "Calculation trace"}
          description="The full line-by-line breakdown of how this pay was built"
        />

        <div className="dialog-body-scroll max-h-standard p-6">
          {loading ? (
            <div className="text-muted-foreground text-sm">Loading trace…</div>
          ) : !trace ? (
            <div className="text-muted-foreground text-sm">No trace available for this line.</div>
          ) : (
            <div className="space-y-3">
              {trace.steps.map((step) => (
                <div
                  key={step.component}
                  className={`rounded-lg border p-4 ${step.enabled ? "border-border bg-card" : "border-border/50 bg-muted/20 opacity-70"}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-foreground">{step.label}</span>
                    <span className={`font-semibold tabular-nums ${step.amount < 0 ? "text-destructive" : "text-foreground"}`}>
                      {formatCurrency(step.amount)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{step.detail}</p>
                </div>
              ))}

              <div className="rounded-lg border-2 border-primary p-4 flex items-center justify-between">
                <span className="font-semibold text-foreground">Total pay</span>
                <span className="font-bold text-primary tabular-nums">{formatCurrency(trace.total_pay)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {trace.paid ? "Marked paid — this line stays editable and can be re-sent." : "Not yet marked paid."}
              </p>
            </div>
          )}

          <div className="flex justify-end pt-4 mt-4 border-t border-border">
            <Button type="button" variant="secondary" className="gap-2" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
