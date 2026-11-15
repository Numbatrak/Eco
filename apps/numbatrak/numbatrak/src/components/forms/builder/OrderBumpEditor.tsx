import { CheckSquare } from "lucide-react";
import { FormField } from "../../../types/form";
import { PackageCatalog, PackageChoice, isOfferBackedOption } from "../../../utils/formPackages";
import { PackagePicker } from "./PackagePicker";

interface OrderBumpEditorProps {
  field: FormField;
  fieldIndex: number;
  catalog: PackageCatalog;
  productsLoading: boolean;
  /** Points the bump at a package, preserving its answer value. */
  onChoosePackage: (fieldIndex: number, choice: PackageChoice | null) => void;
}

/**
 * The optional add-on offered at checkout.
 *
 * A bump is the same shape as a package choice, so it's chosen the same way -
 * from the offers set up under Products. That also closes a gap in the old
 * editor: the runtime reads `orderBump.offer_id` and the line's variant when
 * building order items, but no UI could ever set either of them.
 */
export function OrderBumpEditor({
  field,
  fieldIndex,
  catalog,
  productsLoading,
  onChoosePackage,
}: OrderBumpEditorProps) {
  const bump = field.orderBump;
  if (!bump) return null;

  const legacy = !isOfferBackedOption(bump) && (bump.products?.length ?? 0) > 0;
  const chosen = bump.offer_id ? catalog.byOfferId.get(bump.offer_id) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CheckSquare className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-bold text-foreground">Add-on offered at checkout</span>
      </div>

      <p className="text-xs text-muted-foreground">
        A tick-box customers can add to their order. {chosen ? `Shown as “${chosen.label}”.` : ""}
      </p>

      {legacy && (
        <p className="package-warning">
          <span>
            This add-on was built by hand before packages moved to Products. Choose a package below
            to replace it.
          </span>
        </p>
      )}

      <PackagePicker
        catalog={catalog}
        loading={productsLoading}
        offerId={bump.offer_id}
        onChange={(choice) => onChoosePackage(fieldIndex, choice)}
        idPrefix={`${field.id}-bump`}
        label="Add-on package"
      />

      {!bump.offer_id && !legacy && (
        <p className="package-card-hint">
          Pick a package above — until you do, this add-on won’t show on the form.
        </p>
      )}
    </div>
  );
}
