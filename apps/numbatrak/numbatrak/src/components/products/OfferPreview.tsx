import { ProductOfferBundleItem, ProductOfferType, ProductWithDetails } from "../../types/product";
import { formatNaira } from "../../utils/currency";
import { AlertTriangle, Gift } from "lucide-react";

/**
 * Live "what the customer actually gets" preview for an offer being configured.
 *
 * Mirrors the server's own pricing rules (resolveLinePricing in
 * numbatrak-forms/lib/offer-pricing.ts) for ONE sale of the offer, so the
 * numbers shown here are the numbers the order will be written with:
 *   single         revenue = price            · ships 1 unit
 *   quantity_tier  revenue = price            · ships min_quantity units
 *   buy_x_get_y    revenue = price            · ships X + Y units  <- free units still cost
 *   bundle         revenue = price            · ships 1 unit + every attached component
 * Cost of goods always counts the FREE units too (the "true unit count" rule).
 */

/** Above this many units, drawing one box each stops being readable. */
const MAX_BOXES = 24;

export interface OfferPreviewInput {
  offer_type: ProductOfferType;
  min_quantity: number;
  free_quantity: number;
  price: number;
  unit_cost: number;
  bundle_items?: ProductOfferBundleItem[];
}

interface OfferPreviewProps {
  offer: OfferPreviewInput;
  allProducts: ProductWithDetails[];
  /** Single-line version for the saved-offers list. */
  compact?: boolean;
}

interface Derived {
  paidUnits: number;
  freeUnits: number;
  shippedUnits: number;
  revenue: number;
  componentCost: number;
  cogs: number;
  margin: number;
  marginPct: number | null;
}

function derive(offer: OfferPreviewInput, allProducts: ProductWithDetails[]): Derived {
  const price = offer.price || 0;
  const unitCost = offer.unit_cost || 0;

  let paidUnits = 1;
  let freeUnits = 0;
  if (offer.offer_type === "quantity_tier") {
    paidUnits = Math.max(offer.min_quantity || 1, 1);
  } else if (offer.offer_type === "buy_x_get_y") {
    paidUnits = Math.max(offer.min_quantity || 1, 1);
    freeUnits = Math.max(offer.free_quantity || 0, 0);
  }

  const componentCost =
    offer.offer_type === "bundle"
      ? (offer.bundle_items ?? []).reduce((sum, item) => {
          const p = allProducts.find((ap) => ap.id === item.product_id);
          return sum + (p?.cost_price ?? 0) * (item.quantity || 1);
        }, 0)
      : 0;

  const shippedUnits = paidUnits + freeUnits;
  const cogs = unitCost * shippedUnits + componentCost;
  const margin = price - cogs;

  return {
    paidUnits,
    freeUnits,
    shippedUnits,
    revenue: price,
    componentCost,
    cogs,
    margin,
    marginPct: price > 0 ? (margin / price) * 100 : null,
  };
}

function UnitBox({ free }: { free?: boolean }) {
  return free ? (
    <span className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-dashed border-amber-500 bg-amber-500/10 text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
      Free
    </span>
  ) : (
    <span className="h-9 w-9 rounded-md border border-primary/40 bg-primary/20" />
  );
}

/** Row of unit boxes, or a counted summary when there are too many to draw. */
function UnitRow({ paidUnits, freeUnits }: { paidUnits: number; freeUnits: number }) {
  if (paidUnits + freeUnits > MAX_BOXES) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/20 px-3 py-2 text-xs font-semibold text-foreground">
          <span className="h-4 w-4 rounded border border-primary/40 bg-primary/30" />
          {paidUnits} paid
        </span>
        {freeUnits > 0 && (
          <span className="flex items-center gap-2 rounded-md border-2 border-dashed border-amber-500 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Gift className="h-4 w-4" />
            {freeUnits} free
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Array.from({ length: paidUnits }, (_, i) => (
        <UnitBox key={`paid-${i}`} />
      ))}
      {freeUnits > 0 && <span className="px-1 text-sm font-semibold text-muted-foreground">+</span>}
      {Array.from({ length: freeUnits }, (_, i) => (
        <UnitBox key={`free-${i}`} free />
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-sm font-bold tabular-nums ${
          tone === "good"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "bad"
              ? "text-destructive"
              : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function OfferPreview({ offer, allProducts, compact }: OfferPreviewProps) {
  const d = derive(offer, allProducts);
  const freeUnitCost = (offer.unit_cost || 0) * d.freeUnits;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <UnitRow paidUnits={Math.min(d.paidUnits, MAX_BOXES)} freeUnits={d.freeUnits} />
        <span className="text-muted-foreground">
          ships {d.shippedUnits} {d.shippedUnits === 1 ? "unit" : "units"} ·{" "}
          <span
            className={
              d.margin >= 0
                ? "font-semibold text-emerald-600 dark:text-emerald-400"
                : "font-semibold text-destructive"
            }
          >
            margin {formatNaira(d.margin)}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        What the customer gets
      </div>

      <UnitRow paidUnits={d.paidUnits} freeUnits={d.freeUnits} />

      {offer.offer_type === "bundle" && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(offer.bundle_items ?? []).filter((i) => i.product_id).length === 0 ? (
            <span className="text-xs text-muted-foreground">
              Plus whichever products you attach below.
            </span>
          ) : (
            <>
              <span className="px-1 text-sm font-semibold text-muted-foreground">+</span>
              {(offer.bundle_items ?? [])
                .filter((i) => i.product_id)
                .map((item, i) => {
                  const p = allProducts.find((ap) => ap.id === item.product_id);
                  return (
                    <span
                      key={i}
                      className="rounded-md border border-border bg-muted px-2 py-1.5 text-xs font-medium text-foreground"
                    >
                      {item.quantity || 1} × {p?.name ?? "Select a product"}
                    </span>
                  );
                })}
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 sm:grid-cols-4">
        <Stat label="Customer pays" value={formatNaira(d.revenue)} />
        <Stat
          label="You ship"
          value={`${d.shippedUnits} ${d.shippedUnits === 1 ? "unit" : "units"}`}
        />
        <Stat label="Cost of goods" value={formatNaira(d.cogs)} />
        <Stat
          label="Margin"
          value={
            d.marginPct === null
              ? formatNaira(d.margin)
              : `${formatNaira(d.margin)} (${d.marginPct.toFixed(0)}%)`
          }
          tone={d.margin >= 0 ? "good" : "bad"}
        />
      </div>

      {d.freeUnits > 0 && (
        <p className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
          <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            The {d.freeUnits} free {d.freeUnits === 1 ? "unit" : "units"} still leave your
            warehouse — they add {formatNaira(freeUnitCost)} to cost of goods and earn nothing.
          </span>
        </p>
      )}

      {d.margin < 0 && d.revenue > 0 && (
        <p className="flex items-start gap-2 text-xs font-semibold text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>This offer sells at a loss of {formatNaira(Math.abs(d.margin))} per sale.</span>
        </p>
      )}
    </div>
  );
}
