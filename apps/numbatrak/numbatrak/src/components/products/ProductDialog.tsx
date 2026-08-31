import { FormEvent, useRef } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { formatNaira } from "../../utils/currency";
import { Package } from "lucide-react";
import { ProductType } from "../../types/product";

export interface ProductFormValues {
  productName: string;
  basePrice: string;
  costPrice: string;
  sku: string;
  type: ProductType;
  category: string;
  subBrand: string;
  lowStockThreshold: string;
  allowsVariants: boolean;
  allowsBundles: boolean;
  allowsDiscounts: boolean;
  imageUrl: string | null;
}

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  values: ProductFormValues;
  onChange: (patch: Partial<ProductFormValues>) => void;
  error: string | null;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function ProductDialog({
  open,
  onOpenChange,
  mode,
  values,
  onChange,
  error,
  saving,
  onSubmit,
}: ProductDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const salesNum = parseFloat(values.basePrice || "0");
  const costNum = parseFloat(values.costPrice || "0");
  const showProfit =
    values.basePrice && values.costPrice && salesNum > 0 && costNum >= 0;
  const profit = salesNum - costNum;
  const margin = salesNum > 0 ? (profit / salesNum) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<Package className="h-7 w-7 text-primary-foreground" />}
          title={mode === "edit" ? "Edit Product" : "Create New Product"}
          description={
            mode === "edit"
              ? "Update product details and capabilities"
              : "Add a new product to your catalog"
          }
        />

        <div className="dialog-body-scroll max-h-standard">
          <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
            {error && <ErrorAlert message={error} />}

            <div className="space-y-2">
              <Label htmlFor="product-name" className="dialog-field-label">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="product-name"
                value={values.productName}
                onChange={(e) => onChange({ productName: e.target.value })}
                placeholder="e.g. Vacuum Sealer, Smart Tablet"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-image" className="dialog-field-label">
                Product image
              </Label>
              <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                {values.imageUrl && (
                  <img
                    src={values.imageUrl}
                    alt=""
                    className="mx-auto mb-2 h-24 w-24 rounded-md object-cover"
                  />
                )}
                <input
                  id="product-image"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) {
                      e.target.value = "";
                      window.alert("Image is too large - please use one under 2MB.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = (ev) => onChange({ imageUrl: ev.target?.result as string });
                    reader.readAsDataURL(file);
                  }}
                  className="mb-1 block w-full text-xs"
                />
                {values.imageUrl ? (
                  <button
                    type="button"
                    className="text-[11px] text-destructive hover:underline"
                    onClick={() => onChange({ imageUrl: null })}
                  >
                    Remove image
                  </button>
                ) : (
                  <span>Shown on the storefront listing - PNG, JPG or WebP, up to 2MB</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-sku" className="dialog-field-label">
                  SKU
                </Label>
                <Input
                  id="product-sku"
                  value={values.sku}
                  onChange={(e) => onChange({ sku: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-type" className="dialog-field-label">
                  Type
                </Label>
                <select
                  id="product-type"
                  value={values.type}
                  onChange={(e) =>
                    onChange({ type: e.target.value as ProductType })
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="INCENTIVE">Incentive</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-category" className="dialog-field-label">
                  Category
                </Label>
                <Input
                  id="product-category"
                  value={values.category}
                  onChange={(e) => onChange({ category: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-sub-brand" className="dialog-field-label">
                  Sub-brand
                </Label>
                <Input
                  id="product-sub-brand"
                  value={values.subBrand}
                  onChange={(e) => onChange({ subBrand: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="base-price" className="dialog-field-label">
                  Sales Price (₦) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="base-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={values.basePrice}
                  onChange={(e) => onChange({ basePrice: e.target.value })}
                  required
                />
                {salesNum > 0 && (
                  <p className="text-xs font-medium text-primary">
                    {formatNaira(salesNum)}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost-price" className="dialog-field-label">
                  Cost Price (₦) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cost-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={values.costPrice}
                  onChange={(e) => onChange({ costPrice: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="low-stock" className="dialog-field-label">
                  Low stock threshold
                </Label>
                <Input
                  id="low-stock"
                  type="number"
                  min="0"
                  value={values.lowStockThreshold}
                  onChange={(e) =>
                    onChange({ lowStockThreshold: e.target.value })
                  }
                  placeholder="Leave empty for no alert"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Capabilities</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.allowsVariants}
                  onChange={(e) =>
                    onChange({ allowsVariants: e.target.checked })
                  }
                  className="rounded border-border"
                />
                Variants (size, color, etc.)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.allowsBundles}
                  onChange={(e) =>
                    onChange({ allowsBundles: e.target.checked })
                  }
                  className="rounded border-border"
                />
                Bundles (cross-product offers)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.allowsDiscounts}
                  onChange={(e) =>
                    onChange({ allowsDiscounts: e.target.checked })
                  }
                  className="rounded border-border"
                />
                Discounts (tiers, buy-X-get-Y)
              </label>
            </div>

            {showProfit && (
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                <p className="text-sm font-semibold text-foreground">
                  Profit: {formatNaira(profit)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Margin: {margin.toFixed(1)}%
                </p>
              </div>
            )}
          </form>
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
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={
              saving ||
              !values.productName.trim() ||
              !values.basePrice ||
              !values.costPrice ||
              salesNum < 0 ||
              costNum < 0
            }
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {saving
              ? "Processing..."
              : mode === "edit"
                ? "Update Product"
                : "Create Product"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
