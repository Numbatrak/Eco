import { FormEvent, useEffect, useState } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { sanitizeDecimalInput } from "../../utils/numericInput";
import { XCircle } from "lucide-react";

interface FailedDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAmount: number;
  saving: boolean;
  error?: string | null;
  onConfirm: (expenseAmount: number) => Promise<void>;
}

export function FailedDeliveryDialog({
  open,
  onOpenChange,
  defaultAmount,
  saving,
  error,
  onConfirm,
}: FailedDeliveryDialogProps) {
  const [amount, setAmount] = useState(String(defaultAmount));

  useEffect(() => {
    if (open) setAmount(String(defaultAmount));
  }, [open, defaultAmount]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    await onConfirm(Number.isFinite(parsed) ? parsed : 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<XCircle className="h-7 w-7" aria-hidden />}
          title="Mark failed delivery"
          description="Sets status to failed and logs the loss as an expense"
        />
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <ErrorAlert message={error} />}
          <div className="dialog-form-field space-y-2">
            <Label htmlFor="failed-delivery-amount" className="dialog-field-label">
              Loss amount (₦)
            </Label>
            <Input
              id="failed-delivery-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value))}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Defaults to product cost + delivery fee. Edit if the real loss (e.g.
              including ad spend) is different.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={saving}>
              {saving ? "Saving…" : "Mark failed"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
