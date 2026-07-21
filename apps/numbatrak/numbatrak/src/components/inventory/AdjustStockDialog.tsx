import { FormEvent, useEffect, useRef, useState } from "react";
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
import { AlertTriangle, X, Check } from "lucide-react";
import type { ShrinkageMovementType } from "../../types/stockMovement";
import { filterStockHolders } from "../../utils/agentFilters";

export type AdjustStockFormValues = {
  movement_type: ShrinkageMovementType;
  agent_id: number;
  product_id: string;
  quantity: number;
  notes: string;
};

interface AdjustStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  products: Product[];
  onHandByAgentProduct: Map<number, Map<string, number>>;
  error: string | null;
  saving: boolean;
  onSubmit: (values: AdjustStockFormValues) => Promise<void>;
}

export function AdjustStockDialog({
  open,
  onOpenChange,
  agents,
  products,
  onHandByAgentProduct,
  error,
  saving,
  onSubmit,
}: AdjustStockDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [movementType, setMovementType] =
    useState<ShrinkageMovementType>("damaged");
  const [agentId, setAgentId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const holders = filterStockHolders(agents);
  const activeProducts = products.filter((p) => p.active !== false);

  const availableQty =
    agentId && productId
      ? onHandByAgentProduct.get(Number(agentId))?.get(productId) ?? 0
      : 0;

  useEffect(() => {
    if (!open) return;
    setMovementType("damaged");
    setAgentId("");
    setProductId(activeProducts[0]?.id ?? "");
    setQuantity("1");
    setNotes("");
    setLocalError(null);
  }, [open, activeProducts]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    const qty = parseInt(quantity, 10);
    if (!agentId || !productId) {
      setLocalError("Select agent and product.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setLocalError("Enter a valid quantity.");
      return;
    }
    if (qty > availableQty) {
      setLocalError(`Cannot exceed on-hand quantity (${availableQty}).`);
      return;
    }
    if (!notes.trim()) {
      setLocalError("Reason is required.");
      return;
    }

    try {
      await onSubmit({
        movement_type: movementType,
        agent_id: Number(agentId),
        product_id: productId,
        quantity: qty,
        notes: notes.trim(),
      });
      onOpenChange(false);
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : "Failed to save.");
    }
  };

  const displayError = localError || error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<AlertTriangle className="h-7 w-7" aria-hidden />}
          title="Mark damaged / missing"
          description="Records shrinkage on the stock ledger — does not post to expenses"
        />

        <div className="dialog-body-scroll max-h-standard p-6">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            {displayError && <ErrorAlert message={displayError} />}

            <div className="dialog-form-field space-y-2">
              <Label className="dialog-field-label">Type *</Label>
              <Select
                value={movementType}
                onValueChange={(v) =>
                  setMovementType(v as ShrinkageMovementType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="missing">Missing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="dialog-form-field space-y-2">
              <Label className="dialog-field-label">Agent *</Label>
              <Select value={agentId || "none"} onValueChange={(v) => setAgentId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select agent</SelectItem>
                  {holders.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                      {a.is_warehouse ? " (Warehouse)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="dialog-form-field space-y-2">
              <Label className="dialog-field-label">Product *</Label>
              <Select
                value={productId || "none"}
                onValueChange={(v) => setProductId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {activeProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {agentId && productId && (
                <p className="text-xs text-muted-foreground">
                  On hand:{" "}
                  <span className="font-semibold text-foreground">{availableQty}</span>
                </p>
              )}
            </div>

            <div className="dialog-form-field space-y-2">
              <Label htmlFor="adj-qty" className="dialog-field-label">
                Quantity *
              </Label>
              <Input
                id="adj-qty"
                type="number"
                min={1}
                max={availableQty || undefined}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <div className="dialog-form-field space-y-2">
              <Label htmlFor="adj-notes" className="dialog-field-label">
                Reason *
              </Label>
              <Textarea
                id="adj-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Describe what happened…"
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
                {saving ? "Saving…" : "Record shrinkage"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
