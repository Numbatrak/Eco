import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Agent } from "../../types/agent";
import { ProductWithDetails } from "../../types/product";
import { AlertTriangle, X, Check } from "lucide-react";
import type { ShrinkageMovementType } from "../../types/stockMovement";
import { filterStockHolders } from "../../utils/agentFilters";
import { sanitizeIntegerInput } from "../../utils/numericInput";
import { onHandKey } from "../../services/agentStock";

export type AdjustStockFormValues = {
  movement_type: ShrinkageMovementType;
  agent_id: number;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  notes: string;
  flag_as_loss: boolean;
};

interface AdjustStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  products: ProductWithDetails[];
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
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [flagAsLoss, setFlagAsLoss] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const holders = useMemo(() => filterStockHolders(agents), [agents]);
  const activeProducts = useMemo(() => products.filter((p) => p.active !== false), [products]);
  const selectedProduct = useMemo(() => activeProducts.find((p) => p.id === productId) ?? null, [activeProducts, productId]);
  const variants = useMemo(
    () => (selectedProduct?.allows_variants ? (selectedProduct.variants ?? []).filter((v) => v.active !== false) : []),
    [selectedProduct]
  );

  const availableQty =
    agentId && productId
      ? onHandByAgentProduct.get(Number(agentId))?.get(onHandKey(productId, variantId || null)) ?? 0
      : 0;

  useEffect(() => {
    if (!open) return;
    setMovementType("damaged");
    setAgentId("");
    setProductId(activeProducts[0]?.id ?? "");
    setVariantId("");
    setQuantity("");
    setNotes("");
    setFlagAsLoss(false);
    setLocalError(null);
  }, [open, activeProducts]);

  useEffect(() => {
    setVariantId("");
  }, [productId]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    const qty = parseInt(quantity, 10);
    if (!agentId || !productId) {
      setLocalError("Select agent and product.");
      return;
    }
    if (variants.length > 0 && !variantId) {
      setLocalError("Select a variant.");
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
        variant_id: variantId || null,
        quantity: qty,
        notes: notes.trim(),
        flag_as_loss: flagAsLoss,
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
          description="Records shrinkage on the stock ledger — optionally flag as a loss expense"
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
              {agentId && productId && (variants.length === 0 || variantId) && (
                <p className="text-xs text-muted-foreground">
                  On hand:{" "}
                  <span className="font-semibold text-foreground">{availableQty}</span>
                </p>
              )}
            </div>

            {variants.length > 0 && (
              <div className="dialog-form-field space-y-2">
                <Label className="dialog-field-label">Variant *</Label>
                <Select
                  value={variantId || "none"}
                  onValueChange={(v) => setVariantId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select variant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select variant</SelectItem>
                    {variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="dialog-form-field space-y-2">
              <Label htmlFor="adj-qty" className="dialog-field-label">
                Quantity *
              </Label>
              <Input
                id="adj-qty"
                type="text"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(sanitizeIntegerInput(e.target.value))}
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

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={flagAsLoss}
                onCheckedChange={(checked) => setFlagAsLoss(checked === true)}
              />
              Flag as loss (posts a cost-price × quantity expense for this agent)
            </label>

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
