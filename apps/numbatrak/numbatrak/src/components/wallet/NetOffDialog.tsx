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
import { Textarea } from "../ui/textarea";
import { WalletRemittanceLine } from "../../types/wallet";
import { formatNaira } from "../../utils/currency";

interface NetOffDialogProps {
  line: WalletRemittanceLine | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (amount: number, note: string) => Promise<void>;
  saving?: boolean;
}

export function NetOffDialog({
  line,
  open,
  onOpenChange,
  onSubmit,
  saving,
}: NetOffDialogProps) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount("");
      setNote("");
      setError(null);
    }
  }, [line, open]);

  if (!line) return null;

  const handleSubmit = async () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    setError(null);
    await onSubmit(parsed, note);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add net-off</DialogTitle>
          <DialogDescription>
            Business owes {line.agent_name} — reduces expected remittance and
            creates an operational expense.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Current expected:{" "}
            <span className="font-medium text-foreground">
              {formatNaira(line.expected_remittance, { decimals: 0 })}
            </span>
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="netoff-amount">Amount business owes agent</Label>
            <Input
              id="netoff-amount"
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="netoff-note">Note (optional)</Label>
            <Textarea
              id="netoff-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Agent covered packaging cost"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
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
            {saving ? "Saving…" : "Add net-off & expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
