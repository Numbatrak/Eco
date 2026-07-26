import { FormEvent, useState } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { Product, ProductVariant } from "../../types/product";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Package } from "lucide-react";
import { formatNaira } from "../../utils/currency";

interface ReceiveStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  variants?: ProductVariant[];
  organizationId: string | null;
  onSave: (params: {
    product_id: string;
    variant_id?: string | null;
    quantity_remaining: number;
    unit_cost: number;
  }) => Promise<void>;
  error: string | null;
  saving: boolean;
}

export function ReceiveStockDialog({
  open,
  onOpenChange,
  product,
  variants = [],
  organizationId,
  onSave,
  error,
  saving,
}: ReceiveStockDialogProps) {
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [variantId, setVariantId] = useState("");

  const activeVariants = variants.filter((v) => v.active);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!product || !organizationId) return;
    const qty = parseInt(quantity, 10);
    const cost = parseFloat(unitCost);
    if (isNaN(qty) || qty < 1) return;
    if (isNaN(cost) || cost < 0) return;
    await onSave({
      product_id: product.id,
      variant_id: variantId || null,
      quantity_remaining: qty,
      unit_cost: cost,
    });
    setQuantity("");
    setUnitCost("");
    setVariantId("");
    onOpenChange(false);
  };

  const costNum = parseFloat(unitCost);
  const qtyNum = parseInt(quantity, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<Package className="h-6 w-6 text-primary-foreground" />}
          title="Receive Stock (FIFO)"
          description={`${product?.name ?? "Product"}: consumed oldest lot first`}
        />

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="dialog-body-scroll max-h-standard space-y-4">
            {error && <ErrorAlert message={error} />}

            {activeVariants.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="receive-variant" className="dialog-field-label">
                  Variant (optional)
                </Label>
                <select
                  id="receive-variant"
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Parent product (no variant)</option>
                  {activeVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="receive-qty" className="dialog-field-label">
                  Quantity received
                </Label>
                <Input
                  id="receive-qty"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 100"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="receive-cost" className="dialog-field-label">
                  Unit cost (₦)
                </Label>
                <Input
                  id="receive-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="e.g. 500"
                  required
                />
                {!Number.isNaN(costNum) && costNum >= 0 && unitCost && (
                  <p className="dialog-field-hint">
                    {formatNaira(costNum)} per unit
                  </p>
                )}
              </div>
            </div>

            {!Number.isNaN(qtyNum) &&
              !Number.isNaN(costNum) &&
              qtyNum > 0 &&
              costNum >= 0 &&
              quantity &&
              unitCost && (
                <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">
                  Lot value:{" "}
                  <span className="font-semibold">
                    {formatNaira(qtyNum * costNum)}
                  </span>
                </div>
              )}
          </div>

          <div className="dialog-footer-bar">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="dialog-cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !quantity || !unitCost}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? "Saving..." : "Receive stock"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
