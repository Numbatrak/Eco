import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { WalletRemittanceLine } from "../../types/wallet";
import { formatNaira } from "../../utils/currency";

interface RecordRemittanceDialogProps {
  line: WalletRemittanceLine | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (actualAmount: number) => Promise<void>;
  saving?: boolean;
}

export function RecordRemittanceDialog({
  line,
  open,
  onOpenChange,
  onSubmit,
  saving,
}: RecordRemittanceDialogProps) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (line && open) {
      setAmount(String(Math.max(0, Math.round(line.expected_remittance))));
      setError(null);
    }
  }, [line, open]);

  if (!line) return null;

  const handleSubmit = async () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a valid amount.");
      return;
    }
    setError(null);
    await onSubmit(parsed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark remittance received</DialogTitle>
          <DialogDescription>
            {line.agent_name} · {line.remittance_date} · {line.order_count}{" "}
            order{line.order_count === 1 ? "" : "s"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivered value</span>
              <span>{formatNaira(line.total_delivered_value, { decimals: 0 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery fees (agent keeps)</span>
              <span>−{formatNaira(line.total_delivery_fees, { decimals: 0 })}</span>
            </div>
            {line.net_off_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net-offs</span>
                <span>−{formatNaira(line.net_off_amount, { decimals: 0 })}</span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-1 border-t border-border">
              <span>Expected remittance</span>
              <span>{formatNaira(line.expected_remittance, { decimals: 0 })}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="actual-amount">Actual amount received</Label>
            <Input
              id="actual-amount"
              type="number"
              min={0}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              If less than expected, the line stays <strong>Short</strong> until
              the balance is cleared.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Record remittance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
