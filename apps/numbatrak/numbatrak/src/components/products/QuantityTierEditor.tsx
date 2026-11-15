import { Plus, Trash2, TrendingDown } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { formatNaira } from "../../utils/currency";
import { sanitizeIntegerInput, sanitizeDecimalInput } from "../../utils/numericInput";

/**
 * Quantity-tier ladder: the same product at several quantities, each with its
 * own set price — "1 for ₦10,000 · 2 for ₦18,000 · 4 for ₦35,000".
 *
 * Each rung saves as its own product_offers row (offer_type "quantity_tier",
 * min_quantity = the rung's quantity). That is already how the pricing engine
 * reads a tier, so this is an input affordance over the existing model, not a
 * new one — a merchant should not have to add three separate offers by hand
 * and remember to keep their labels consistent.
 *
 * The per-unit column is the point of the whole feature: a tier only earns its
 * place if it is cheaper per unit than the rung below it, and showing that
 * makes a mispriced ladder obvious while it is being typed.
 */

export interface QuantityTier {
  /** Units the customer receives at this rung. */
  quantity: number;
  /** Total price for the whole rung, not per unit. */
  price: number;
}

interface QuantityTierEditorProps {
  tiers: QuantityTier[];
  onChange: (tiers: QuantityTier[]) => void;
  /** Per-unit cost of goods, shared by every rung — used for the margin read-out. */
  unitCost: number;
}

/** Price per unit at this rung, which is what the pricing engine stores. */
export function unitPriceOf(tier: QuantityTier): number {
  return tier.quantity > 0 ? tier.price / tier.quantity : 0;
}

export function QuantityTierEditor({ tiers, onChange, unitCost }: QuantityTierEditorProps) {
  // The cheapest single unit on the ladder is the yardstick every other rung is
  // measured against. Falling back to the first rung keeps the column sensible
  // while a ladder is still half-typed.
  const singleTier = tiers.find((t) => t.quantity === 1) ?? tiers[0];
  const baselineUnitPrice = singleTier ? unitPriceOf(singleTier) : 0;

  const update = (index: number, patch: Partial<QuantityTier>) => {
    onChange(tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  };

  const addTier = () => {
    const last = tiers[tiers.length - 1];
    // Guess the next rung rather than starting from zero: doubling the quantity
    // and applying the ladder's current per-unit rate is nearly always closer
    // to what's wanted than a blank row.
    const nextQuantity = last ? last.quantity * 2 : 1;
    const nextPrice = last && last.quantity > 0 ? Math.round(unitPriceOf(last) * nextQuantity) : 0;
    onChange([...tiers, { quantity: nextQuantity, price: nextPrice }]);
  };

  const removeTier = (index: number) => {
    onChange(tiers.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-bold text-foreground">Price ladder</Label>
          <p className="text-xs text-muted-foreground">
            Each row is sold as its own option. Buying more should cost less per unit.
          </p>
        </div>
        <button
          type="button"
          onClick={addTier}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add tier
        </button>
      </div>

      {tiers.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No tiers yet — add one for each quantity you want to sell.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[5rem_1fr_auto_2rem] items-center gap-2 px-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Qty</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Total price (₦)
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Per unit
            </span>
            <span />
          </div>

          {tiers.map((tier, index) => {
            const perUnit = unitPriceOf(tier);
            const margin = tier.price - unitCost * tier.quantity;
            // Only meaningful once there is a baseline other than this row itself.
            const savingPct =
              baselineUnitPrice > 0 && perUnit > 0 && tier !== singleTier
                ? ((baselineUnitPrice - perUnit) / baselineUnitPrice) * 100
                : null;

            return (
              <div key={index} className="space-y-1">
                <div className="grid grid-cols-[5rem_1fr_auto_2rem] items-center gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    aria-label={`Tier ${index + 1} quantity`}
                    value={tier.quantity}
                    onChange={(e) =>
                      update(index, { quantity: parseInt(sanitizeIntegerInput(e.target.value)) || 0 })
                    }
                  />
                  <Input
                    type="text"
                    inputMode="decimal"
                    aria-label={`Tier ${index + 1} total price`}
                    value={tier.price}
                    onChange={(e) => update(index, { price: Number(sanitizeDecimalInput(e.target.value)) })}
                  />
                  <span className="w-24 text-right text-sm font-semibold tabular-nums text-foreground">
                    {perUnit > 0 ? formatNaira(perUnit) : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeTier(index)}
                    className="rounded p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                    aria-label={`Remove tier ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-1 text-[11px]">
                  <span className="text-muted-foreground">
                    Sells as <span className="font-medium text-foreground">{tierLabel(tier)}</span>
                  </span>
                  {savingPct !== null && savingPct > 0 && (
                    <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                      <TrendingDown className="h-3 w-3" />
                      {savingPct.toFixed(0)}% cheaper per unit
                    </span>
                  )}
                  {savingPct !== null && savingPct <= 0 && (
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      No cheaper per unit than buying singles
                    </span>
                  )}
                  <span className={margin < 0 ? "font-medium text-destructive" : "text-muted-foreground"}>
                    Margin {formatNaira(margin)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** The customer-facing name of a rung, e.g. "2 for ₦18,000". */
export function tierLabel(tier: QuantityTier): string {
  return `${tier.quantity} for ${formatNaira(tier.price)}`;
}
