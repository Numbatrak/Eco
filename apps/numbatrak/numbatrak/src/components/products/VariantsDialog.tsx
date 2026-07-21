import { FormEvent, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { Product, ProductVariant } from "../../types/product";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ErrorAlert } from "../agents/ErrorAlert";
import { useConfirm, confirmDelete } from "../../contexts/ConfirmContext";
import { formatNaira } from "../../utils/currency";
import { Layers, Plus, Trash2, X } from "lucide-react";

interface VariantFormData {
  name: string;
  sku: string;
  base_price: number;
  cost_price: number;
}

interface VariantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  variants: ProductVariant[];
  onSave: (
    variants: Omit<
      ProductVariant,
      "id" | "organization_id" | "product_id" | "created_at" | "updated_at" | "active" | "display_order"
    >[]
  ) => Promise<void>;
  onDelete: (variantId: string) => Promise<void>;
  onToggleActive: (variant: ProductVariant, active: boolean) => Promise<void>;
  error: string | null;
  saving: boolean;
}

const defaultEntry = (): VariantFormData => ({
  name: "",
  sku: "",
  base_price: 0,
  cost_price: 0,
});

export function VariantsDialog({
  open,
  onOpenChange,
  product,
  variants,
  onSave,
  onDelete,
  onToggleActive,
  error,
  saving,
}: VariantsDialogProps) {
  const { confirm } = useConfirm();
  const [entries, setEntries] = useState<VariantFormData[]>([defaultEntry()]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (open) setEntries([defaultEntry()]);
  }, [open, product?.id]);

  const handleAddEntry = () => {
    setEntries([...entries, defaultEntry()]);
  };

  const handleRemoveEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleUpdateEntry = (
    index: number,
    field: keyof VariantFormData,
    value: string | number
  ) => {
    const updated = [...entries];
    updated[index] = {
      ...updated[index],
      [field]:
        field === "name" || field === "sku" ? value : Number(value),
    };
    setEntries(updated);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!product) return;

    const toSave = entries
      .filter((entry) => entry.name.trim())
      .map((entry) => ({
        name: entry.name.trim(),
        sku: entry.sku.trim() || null,
        base_price: entry.base_price,
        cost_price: entry.cost_price,
      }));

    if (toSave.length === 0) return;
    await onSave(toSave);
    setEntries([defaultEntry()]);
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!(await confirmDelete(confirm, "variant"))) return;
    await onDelete(variantId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<Layers className="h-7 w-7 text-primary-foreground" />}
          title={`Variants: ${product?.name ?? ""}`}
          description="Sellable SKUs with their own price, cost, and stock line"
        />

        <div className="dialog-body-scroll max-h-tall">
          {error && <ErrorAlert message={error} />}

          {variants.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-lg font-semibold text-foreground">
                Existing variants
              </h3>
              <div className="space-y-2">
                {variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 p-3"
                  >
                    <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                      <div>
                        <span className="text-muted-foreground">Name:</span>
                        <span className="ml-2 font-semibold">{variant.name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">SKU:</span>
                        <span className="ml-2 font-semibold">
                          {variant.sku || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Price:</span>
                        <span className="ml-2 font-semibold">
                          {formatNaira(variant.base_price)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <span
                          className={`ml-2 font-semibold ${
                            variant.active ? "text-emerald-600" : "text-muted-foreground"
                          }`}
                        >
                          {variant.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleActive(variant, !variant.active)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                      >
                        {variant.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVariant(variant.id)}
                        className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Add variants</h3>
              <button
                type="button"
                onClick={handleAddEntry}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
              >
                <Plus className="h-5 w-5" />
                Add variant
              </button>
            </div>

            {entries.map((entry, index) => (
              <div
                key={index}
                className="space-y-4 rounded-lg border-2 border-border bg-muted/30 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    Variant #{index + 1}
                  </h4>
                  {entries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEntry(index)}
                      className="rounded p-1 text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Name
                    </Label>
                    <Input
                      value={entry.name}
                      onChange={(e) =>
                        handleUpdateEntry(index, "name", e.target.value)
                      }
                      placeholder="e.g. Large / Red"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">
                      SKU (optional)
                    </Label>
                    <Input
                      value={entry.sku}
                      onChange={(e) =>
                        handleUpdateEntry(index, "sku", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Sales price (₦)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.base_price}
                      onChange={(e) =>
                        handleUpdateEntry(index, "base_price", e.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Cost price (₦)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.cost_price}
                      onChange={(e) =>
                        handleUpdateEntry(index, "cost_price", e.target.value)
                      }
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </form>
        </div>

        <div className="dialog-footer-bar">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="dialog-cancel-button"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={saving || entries.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save variants"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
