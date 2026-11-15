import { Package, Plus, Trash2 } from "lucide-react";
import { FormField, RadioOption } from "../../../types/form";
import { PackageCatalog, PackageChoice, isOfferBackedOption } from "../../../utils/formPackages";
import { PackagePicker } from "./PackagePicker";

interface RadioGroupOptionsEditorProps {
  field: FormField;
  fieldIndex: number;
  catalog: PackageCatalog;
  productsLoading: boolean;
  onAddOption: (fieldIndex: number) => void;
  onRemoveOption: (fieldIndex: number, optionIndex: number) => void;
  /** Points an option at a package, preserving its id and answer value. */
  onChoosePackage: (fieldIndex: number, optionIndex: number, choice: PackageChoice | null) => void;
}

/**
 * The choices in a package picker.
 *
 * Each choice is a product offer, selected from a dropdown. Nothing about a
 * package is editable here - title, price, products, variants and cost all
 * live on the offer under Products, so there is exactly one place a price can
 * be changed and no way for two copies to disagree.
 */
export function RadioGroupOptionsEditor({
  field,
  fieldIndex,
  catalog,
  productsLoading,
  onAddOption,
  onRemoveOption,
  onChoosePackage,
}: RadioGroupOptionsEditorProps) {
  const options = field.radioOptions ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground">Packages customers can choose</span>
          <span className="text-xs text-muted-foreground">({options.length})</span>
        </div>
        <button
          type="button"
          onClick={() => onAddOption(fieldIndex)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Add package
        </button>
      </div>

      {options.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-border rounded-lg bg-muted">
          <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-muted-foreground mb-1">No packages added yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Customers can’t order until there’s at least one.
          </p>
          <button
            type="button"
            onClick={() => onAddOption(fieldIndex)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            Add the first package
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {options.map((option, optIndex) => (
            <PackageOptionCard
              key={option.id}
              option={option}
              position={optIndex + 1}
              catalog={catalog}
              loading={productsLoading}
              idPrefix={`${field.id}-${option.id}`}
              onChoose={(choice) => onChoosePackage(fieldIndex, optIndex, choice)}
              onRemove={() => onRemoveOption(fieldIndex, optIndex)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PackageOptionCard({
  option,
  position,
  catalog,
  loading,
  idPrefix,
  onChoose,
  onRemove,
}: {
  option: RadioOption;
  position: number;
  catalog: PackageCatalog;
  loading: boolean;
  idPrefix: string;
  onChoose: (choice: PackageChoice | null) => void;
  onRemove: () => void;
}) {
  // Options written before packages moved to Products carry no `source` and a
  // hand-assembled product list. Picking a package replaces them in place,
  // keeping the option's id and answer value so a live form keeps working.
  const legacy = !isOfferBackedOption(option) && (option.products?.length ?? 0) > 0;
  const chosen = option.offer_id ? catalog.byOfferId.get(option.offer_id) : undefined;

  return (
    <div className="radio-option-card">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="package-card-title">
              {chosen?.label || option.title || `Package ${position}`}
            </p>
            <p className="package-card-value">Answer value: {option.value}</p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="btn-icon btn-icon-danger shrink-0"
            title={`Remove ${chosen?.label || option.title || `package ${position}`} from this form`}
            aria-label={`Remove ${chosen?.label || option.title || `package ${position}`}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {legacy && (
          <p className="package-warning">
            <span>
              This package was built by hand before packages moved to Products, so its price isn’t
              linked to anything. Choose a package below to replace it — customers who already
              picked it keep their orders.
            </span>
          </p>
        )}

        <PackagePicker
          catalog={catalog}
          loading={loading}
          offerId={option.offer_id}
          onChange={onChoose}
          idPrefix={idPrefix}
          label={`Package ${position}`}
        />

        {!option.offer_id && !legacy && (
          <p className="package-card-hint">
            Pick a package above — until you do, customers can’t choose this option.
          </p>
        )}
      </div>
    </div>
  );
}
