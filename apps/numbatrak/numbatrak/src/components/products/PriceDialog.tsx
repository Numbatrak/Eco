import { FormEvent, useRef, useState, useEffect } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { Product, ProductPrice } from "../../types/product";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ErrorAlert } from "../agents/ErrorAlert";
import { useConfirm, confirmDelete } from "../../contexts/ConfirmContext";
import { formatNaira } from "../../utils/currency";
import { X, Plus, Trash2, Banknote } from "lucide-react";

interface PriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  prices: ProductPrice[];
  onSave: (prices: Omit<ProductPrice, "id" | "created_at">[]) => Promise<void>;
  onDelete: (priceId: number | string) => Promise<void>;
  error: string | null;
  saving: boolean;
}

interface PriceFormData {
  date: string;
  quantity: number;
  offer: number;
  sales_price: number;
  unit_cost: number;
}

export function PriceDialog({
  open,
  onOpenChange,
  product,
  prices,
  onSave,
  onDelete,
  error,
  saving,
}: PriceDialogProps) {
  const { confirm } = useConfirm();
  const [priceEntries, setPriceEntries] = useState<PriceFormData[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (open && product) {
      setPriceEntries([
        {
          date: new Date().toISOString().split("T")[0],
          quantity: 1,
          offer: 0,
          sales_price: 0,
          unit_cost: 0,
        },
      ]);
    }
  }, [open, product]);

  const handleAddEntry = () => {
    setPriceEntries([
      ...priceEntries,
      {
        date: new Date().toISOString().split("T")[0],
        quantity: 1,
        offer: 0,
        sales_price: 0,
        unit_cost: 0,
      },
    ]);
  };

  const handleRemoveEntry = (index: number) => {
    setPriceEntries(priceEntries.filter((_, i) => i !== index));
  };

  const handleUpdateEntry = (
    index: number,
    field: keyof PriceFormData,
    value: string | number
  ) => {
    const updated = [...priceEntries];
    updated[index] = {
      ...updated[index],
      [field]: field === "date" ? value : Number(value),
    };
    setPriceEntries(updated);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!product) return;

    const pricesToSave = priceEntries.map((entry) => ({
      product_id: product.id,
      date: entry.date,
      quantity: entry.quantity,
      offer: entry.offer,
      sales_price: entry.sales_price,
      unit_cost: entry.unit_cost,
    }));

    await onSave(pricesToSave);
    setPriceEntries([]);
  };

  const handleDeletePrice = async (priceId: number | string) => {
    if (!(await confirmDelete(confirm, "price entry"))) return;
    await onDelete(priceId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<Banknote className="h-7 w-7 text-primary-foreground" />}
          title={`Manage Prices: ${product?.name ?? ""}`}
          description="Add or update price entries for this product"
        />

        <div className="dialog-body-scroll max-h-tall">
          {error && <ErrorAlert message={error} />}

          {prices.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-lg font-semibold text-foreground">
                Existing Price Entries
              </h3>
              <div className="space-y-2">
                {prices.map((price) => {
                  const profit =
                    price.sales_price - price.unit_cost * price.quantity;
                  const isLoss = profit < 0;
                  return (
                    <div
                      key={price.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 p-3"
                    >
                      <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-5">
                        <div>
                          <span className="text-muted-foreground">Date:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            {new Date(price.date).toLocaleDateString("en-NG")}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Qty:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            {price.quantity.toLocaleString("en-NG")}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Sales:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            {formatNaira(price.sales_price)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cost:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            {formatNaira(price.unit_cost)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            {isLoss ? "Loss:" : "Profit:"}
                          </span>
                          <span
                            className={`ml-2 font-semibold ${
                              isLoss ? "text-destructive" : "text-primary"
                            }`}
                          >
                            {formatNaira(Math.abs(profit))}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePrice(price.id)}
                        className="shrink-0 rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                        title="Delete price entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Add New Price Entries
              </h3>
              <button
                type="button"
                onClick={handleAddEntry}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
              >
                <Plus className="h-5 w-5" />
                Add Entry
              </button>
            </div>

            {priceEntries.map((entry, index) => (
              <div
                key={index}
                className="space-y-4 rounded-lg border-2 border-border bg-muted/30 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    Entry #{index + 1}
                  </h4>
                  {priceEntries.length > 1 && (
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
                    <Label
                      htmlFor={`date-${index}`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Date
                    </Label>
                    <Input
                      id={`date-${index}`}
                      type="date"
                      value={entry.date}
                      onChange={(e) =>
                        handleUpdateEntry(index, "date", e.target.value)
                      }
                      className="w-full"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor={`quantity-${index}`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Quantity
                    </Label>
                    <Input
                      id={`quantity-${index}`}
                      type="number"
                      min="1"
                      value={entry.quantity}
                      onChange={(e) =>
                        handleUpdateEntry(index, "quantity", e.target.value)
                      }
                      className="w-full"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor={`offer-${index}`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Offer (₦)
                    </Label>
                    <Input
                      id={`offer-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.offer}
                      onChange={(e) =>
                        handleUpdateEntry(index, "offer", e.target.value)
                      }
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor={`sales-${index}`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Sales Price (₦)
                    </Label>
                    <Input
                      id={`sales-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.sales_price}
                      onChange={(e) =>
                        handleUpdateEntry(index, "sales_price", e.target.value)
                      }
                      className="w-full"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor={`cost-${index}`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Unit Cost (₦)
                    </Label>
                    <Input
                      id={`cost-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.unit_cost}
                      onChange={(e) =>
                        handleUpdateEntry(index, "unit_cost", e.target.value)
                      }
                      className="w-full"
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
            Cancel
          </button>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={saving || priceEntries.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Prices"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
