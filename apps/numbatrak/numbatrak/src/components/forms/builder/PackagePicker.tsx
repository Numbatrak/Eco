import { ExternalLink, Package, TriangleAlert } from "lucide-react";
import { PackageCatalog, PackageChoice } from "../../../utils/formPackages";

/** ₦ with no stray decimals on whole amounts. */
function naira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

interface PackagePickerProps {
  catalog: PackageCatalog;
  loading: boolean;
  /** The offer this option currently points at, if any. */
  offerId: string | null | undefined;
  onChange: (choice: PackageChoice | null) => void;
  /** Distinguishes the two selects when a bump and a package sit on one screen. */
  idPrefix: string;
  label?: string;
}

/**
 * Choose a package for a form option.
 *
 * Packages are product offers, created under Products. The form only ever
 * selects one, so price, contents and cost all come from the offer and are
 * shown read-only here - there is no second place for a price to drift.
 */
export function PackagePicker({
  catalog,
  loading,
  offerId,
  onChange,
  idPrefix,
  label = "Package",
}: PackagePickerProps) {
  const selected = offerId ? catalog.byOfferId.get(offerId) : undefined;
  const selectId = `${idPrefix}-package`;

  // An offer that was picked and has since been deleted or switched off.
  const missing = offerId && !selected;

  if (!loading && catalog.choices.length === 0) {
    return (
      <div className="package-empty">
        <Package className="w-5 h-5 text-muted-foreground" aria-hidden />
        <div>
          <p className="package-empty-title">No packages yet</p>
          <p className="package-empty-body">
            Packages are the offers and bundles you set up on a product — a single item, a quantity
            deal like “2 for ₦18,000”, a bundle of several products, or buy-2-get-1. Create one under
            Products, then come back and pick it here.
          </p>
          <a
            href="/products"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary mt-2 inline-flex"
            // Opens in a new tab on purpose: navigating away mid-build would
            // throw away everything not yet saved.
            title="Opens Products in a new tab so you don't lose this form"
          >
            <ExternalLink className="w-4 h-4" />
            Set up a package
          </a>
        </div>
      </div>
    );
  }

  // Group by product so a long list stays readable.
  const groups: { product: string; choices: PackageChoice[] }[] = [];
  for (const choice of catalog.choices) {
    const last = groups[groups.length - 1];
    if (last && last.product === choice.productName) last.choices.push(choice);
    else groups.push({ product: choice.productName, choices: [choice] });
  }

  return (
    <div className="space-y-2">
      <label className="form-label text-xs" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        value={offerId ?? ""}
        disabled={loading}
        onChange={(e) => onChange(catalog.byOfferId.get(e.target.value) ?? null)}
        className="form-input text-sm"
        title={loading ? "Loading your packages…" : undefined}
      >
        <option value="">{loading ? "Loading your packages…" : "Choose a package…"}</option>
        {groups.map((group) => (
          <optgroup key={group.product} label={group.product}>
            {group.choices.map((choice) => (
              <option key={choice.offer.id} value={choice.offer.id}>
                {choice.label} — {naira(choice.price)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {missing && (
        <p className="package-warning">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0" aria-hidden />
          <span>
            The package this option used has been deleted or switched off under Products. Pick
            another one, or this option won’t be able to take orders.
          </span>
        </p>
      )}

      {selected && <PackageSummary choice={selected} />}
    </div>
  );
}

/** Read-only facts about the chosen package. The offer is the source of truth. */
export function PackageSummary({ choice }: { choice: PackageChoice }) {
  const loss = choice.estimatedProfit < 0;

  return (
    <div className="package-summary">
      <dl>
        <div>
          <dt>Customer pays</dt>
          <dd className="package-summary-price">{naira(choice.price)}</dd>
        </div>
        <div>
          <dt>They get</dt>
          <dd>{choice.contents}</dd>
        </div>
        <div>
          <dt>Cost estimate</dt>
          <dd>{naira(choice.estimatedCost)}</dd>
        </div>
        <div>
          <dt>Profit estimate</dt>
          <dd className={loss ? "package-summary-loss" : "package-summary-profit"}>
            {naira(choice.estimatedProfit)}
            {loss && " — you'd lose money on this"}
          </dd>
        </div>
      </dl>

      {choice.unavailableReason && (
        <p className="package-warning">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0" aria-hidden />
          <span>{choice.unavailableReason}</span>
        </p>
      )}

      <p className="package-summary-note">
        {/* Honest about precision: the server costs stock FIFO at order time. */}
        Cost and profit are estimates from current cost prices — the real figures are worked out
        from stock when an order comes in. To change the price or what’s included, edit this package
        under Products.
      </p>
    </div>
  );
}
