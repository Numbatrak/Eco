import { FormEvent, useRef, useState, useEffect } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Agent } from "../../types/agent";
import { Product } from "../../types/product";
import { ArrowRightLeft, X, Check } from "lucide-react";
import { filterStockHolders } from "../../utils/agentFilters";

export type TransferFormValues = {
  from_agent_id: number;
  to_agent_id: number;
  product_id: string;
  quantity: number;
  notes: string;
};

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  products: Product[];
  onHandByAgentProduct: Map<number, Map<string, number>>;
  error: string | null;
  saving: boolean;
  onSubmit: (values: TransferFormValues) => Promise<void>;
}

export function TransferDialog({
  open,
  onOpenChange,
  agents,
  products,
  onHandByAgentProduct,
  error,
  saving,
  onSubmit,
}: TransferDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [fromAgentId, setFromAgentId] = useState("");
  const [toAgentId, setToAgentId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const holders = filterStockHolders(agents);
  const activeProducts = products.filter((p) => p.active !== false);

  const availableQuantity =
    fromAgentId && productId
      ? onHandByAgentProduct.get(Number(fromAgentId))?.get(productId) ?? 0
      : 0;

  useEffect(() => {
    if (!open) return;
    setFromAgentId("");
    setToAgentId("");
    setProductId(activeProducts[0]?.id ?? "");
    setQuantity("1");
    setNotes("");
    setLocalError(null);
  }, [open, activeProducts]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    const qty = parseInt(quantity, 10);
    if (!fromAgentId || !toAgentId || !productId) {
      setLocalError("Select source, destination, and product.");
      return;
    }
    if (fromAgentId === toAgentId) {
      setLocalError("Source and destination must differ.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setLocalError("Enter a valid quantity.");
      return;
    }
    if (qty > availableQuantity) {
      setLocalError(`Cannot exceed on-hand (${availableQuantity}).`);
      return;
    }
    if (!notes.trim()) {
      setLocalError("Transfer reason is required.");
      return;
    }

    try {
      await onSubmit({
        from_agent_id: Number(fromAgentId),
        to_agent_id: Number(toAgentId),
        product_id: productId,
        quantity: qty,
        notes: notes.trim(),
      });
      onOpenChange(false);
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : "Transfer failed.");
    }
  };

  const displayError = localError || error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<ArrowRightLeft className="h-7 w-7" aria-hidden />}
          title="Transfer stock"
          description="Move holdings between agents on the stock ledger"
        />

        <div className="dialog-body-scroll max-h-standard p-6">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            {displayError && <ErrorAlert message={displayError} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="dialog-form-field space-y-2">
                <Label className="dialog-field-label">From agent *</Label>
                <Select
                  value={fromAgentId || "none"}
                  onValueChange={(v) => setFromAgentId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select source</SelectItem>
                    {holders.map((agent) => (
                      <SelectItem key={agent.id} value={String(agent.id)}>
                        {agent.name}
                        {agent.is_warehouse ? " (Warehouse)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="dialog-form-field space-y-2">
                <Label className="dialog-field-label">To agent *</Label>
                <Select
                  value={toAgentId || "none"}
                  onValueChange={(v) => setToAgentId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Destination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select destination</SelectItem>
                    {holders.map((agent) => (
                      <SelectItem
                        key={agent.id}
                        value={String(agent.id)}
                        disabled={String(agent.id) === fromAgentId}
                      >
                        {agent.name}
                        {agent.is_warehouse ? " (Warehouse)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="dialog-form-field space-y-2">
              <Label className="dialog-field-label">Product *</Label>
              <Select
                value={productId || "none"}
                onValueChange={(v) => setProductId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Product" />
                </SelectTrigger>
                <SelectContent>
                  {activeProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="dialog-form-field space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="transfer-qty" className="dialog-field-label">
                  Quantity *
                </Label>
                {fromAgentId && productId && (
                  <span className="text-xs text-muted-foreground">
                    On hand:{" "}
                    <span className="font-semibold text-primary">
                      {availableQuantity}
                    </span>
                  </span>
                )}
              </div>
              <Input
                id="transfer-qty"
                type="number"
                min={1}
                max={availableQuantity || undefined}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <div className="dialog-form-field space-y-2">
              <Label htmlFor="transfer-reason" className="dialog-field-label">
                Reason *
              </Label>
              <Textarea
                id="transfer-reason"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Why is this stock being moved?"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                disabled={saving}
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                <Check className="w-4 h-4" />
                {saving ? "Transferring…" : "Transfer stock"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
