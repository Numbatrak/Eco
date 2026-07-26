import { FormEvent, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import {
  OFFER_TYPE_LABELS,
  Product,
  ProductOffer,
  ProductOfferType,
  ProductVariant,
  computeBuyXGetYUnits,
} from "../../types/product";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ErrorAlert } from "../agents/ErrorAlert";
import { useConfirm, confirmDelete } from "../../contexts/ConfirmContext";
import { formatNaira } from "../../utils/currency";
import { Tag, Plus, Trash2, X } from "lucide-react";

interface OfferFormData {
  offer_type: ProductOfferType;
  label: string;
  min_quantity: number;
  free_quantity: number;
  price: number;
  unit_cost: number;
  variant_id: string;
}

interface OffersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  variants: ProductVariant[];
  offers: ProductOffer[];
  onSave: (
    offers: Omit<
      ProductOffer,
      "id" | "organization_id" | "created_at" | "updated_at" | "active"
    >[]
  ) => Promise<void>;
  onDelete: (offerId: string) => Promise<void>;
  onToggleActive: (offer: ProductOffer, active: boolean) => Promise<void>;
  error: string | null;
  saving: boolean;
}

const defaultEntry = (): OfferFormData => ({
  offer_type: "single",
  label: "",
  min_quantity: 1,
  free_quantity: 0,
  price: 0,
  unit_cost: 0,
  variant_id: "",
});

export function OffersDialog({
  open,
  onOpenChange,
  product,
  variants,
  offers,
  onSave,
  onDelete,
  onToggleActive,
  error,
  saving,
}: OffersDialogProps) {
  const { confirm } = useConfirm();
  const [entries, setEntries] = useState<OfferFormData[]>([defaultEntry()]);
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
    field: keyof OfferFormData,
    value: string | number
  ) => {
    const updated = [...entries];
    updated[index] = {
      ...updated[index],
      [field]:
        field === "label" || field === "offer_type" || field === "variant_id"
          ? value
          : Number(value),
    };
    setEntries(updated);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!product) return;

    const toSave = entries
      .filter((entry) => entry.label.trim())
      .map((entry) => ({
        product_id: product.id,
        variant_id: entry.variant_id || null,
        offer_type: entry.offer_type,
        label: entry.label.trim(),
        min_quantity: entry.min_quantity || 1,
        free_quantity:
          entry.offer_type === "buy_x_get_y" ? entry.free_quantity : 0,
        bundle_items: null,
        price: entry.price,
        unit_cost: entry.unit_cost,
        starts_at: null,
        ends_at: null,
        display_order: 0,
      }));

    if (toSave.length === 0) return;
    await onSave(toSave);
    setEntries([defaultEntry()]);
  };

  const handleDeleteOffer = async (offerId: string) => {
    if (!(await confirmDelete(confirm, "offer"))) return;
    await onDelete(offerId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<Tag className="h-7 w-7 text-primary-foreground" />}
          title={`Manage Offers: ${product?.name ?? ""}`}
          description="Typed offers — single, quantity tier, bundle, or buy-X-get-Y"
        />

        <div className="dialog-body-scroll max-h-tall">
          {error && <ErrorAlert message={error} />}

          {offers.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-lg font-semibold text-foreground">
                Active offers
              </h3>
              <div className="space-y-2">
                {offers.map((offer) => {
                  const accordPreview =
                    offer.offer_type === "buy_x_get_y"
                      ? computeBuyXGetYUnits(1, offer.min_quantity, offer.free_quantity)
                      : null;
                  return (
                    <div
                      key={offer.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 p-3"
                    >
                      <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                        <div>
                          <span className="text-muted-foreground">Label:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            {offer.label}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Type:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            {OFFER_TYPE_LABELS[offer.offer_type]}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Price:</span>
                          <span className="ml-2 font-semibold text-foreground">
                            {formatNaira(offer.price)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span>
                          <span
                            className={`ml-2 font-semibold ${
                              offer.active ? "text-emerald-600" : "text-muted-foreground"
                            }`}
                          >
                            {offer.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        {accordPreview && (
                          <div className="sm:col-span-4 text-xs text-muted-foreground">
                            Accord (1 bundle): {accordPreview.quantity_paid} paid +{" "}
                            {accordPreview.free_quantity} free ={" "}
                            {accordPreview.true_unit_count} units shipped/COGS
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => onToggleActive(offer, !offer.active)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                        >
                          {offer.active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOffer(offer.id)}
                          className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                          title="Delete offer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Add offers</h3>
              <button
                type="button"
                onClick={handleAddEntry}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
              >
                <Plus className="h-5 w-5" />
                Add offer
              </button>
            </div>

            {entries.map((entry, index) => (
              <div
                key={index}
                className="space-y-4 rounded-lg border-2 border-border bg-muted/30 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    Offer #{index + 1}
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
                      Label
                    </Label>
                    <Input
                      value={entry.label}
                      onChange={(e) =>
                        handleUpdateEntry(index, "label", e.target.value)
                      }
                      placeholder="e.g. Buy 2 Get 1 Free"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Offer type
                    </Label>
                    <select
                      value={entry.offer_type}
                      onChange={(e) =>
                        handleUpdateEntry(
                          index,
                          "offer_type",
                          e.target.value as ProductOfferType
                        )
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      {(Object.keys(OFFER_TYPE_LABELS) as ProductOfferType[]).map(
                        (type) => (
                          <option key={type} value={type}>
                            {OFFER_TYPE_LABELS[type]}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  {variants.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Variant (optional)
                      </Label>
                      <select
                        value={entry.variant_id}
                        onChange={(e) =>
                          handleUpdateEntry(index, "variant_id", e.target.value)
                        }
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      >
                        <option value="">All variants</option>
                        {variants
                          .filter((v) => v.active)
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  {(entry.offer_type === "quantity_tier" ||
                    entry.offer_type === "buy_x_get_y") && (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">
                        {entry.offer_type === "buy_x_get_y" ? "Buy (X)" : "Min qty"}
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        value={entry.min_quantity}
                        onChange={(e) =>
                          handleUpdateEntry(index, "min_quantity", e.target.value)
                        }
                        required
                      />
                    </div>
                  )}
                  {entry.offer_type === "buy_x_get_y" && (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Free (Y)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={entry.free_quantity}
                        onChange={(e) =>
                          handleUpdateEntry(index, "free_quantity", e.target.value)
                        }
                        required
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">
                      {entry.offer_type === "buy_x_get_y"
                        ? "Bundle price (₦)"
                        : "Price (₦)"}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.price}
                      onChange={(e) =>
                        handleUpdateEntry(index, "price", e.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Unit cost (₦)
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.unit_cost}
                      onChange={(e) =>
                        handleUpdateEntry(index, "unit_cost", e.target.value)
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
            Cancel
          </button>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={saving || entries.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save offers"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
