import { ArrowLeft, List, Plus, Trash2 } from "lucide-react";
import { Product, ProductOffer, ProductVariant } from "../../../types/product";
import { FormField, RadioOption, RadioOptionProduct } from "../../../types/form";
import { isRequiredField } from "../../../utils/formValidation";
import { RadioGroupOptionsEditor } from "./RadioGroupOptionsEditor";
import { OrderBumpEditor } from "./OrderBumpEditor";
import { getFieldIcon } from "./fieldIcons";

interface ProductsContext {
  products: Product[];
  offersByProduct: Record<string, ProductOffer[]>;
  variantsByProduct: Record<string, ProductVariant[]>;
  productsLoading: boolean;
}

interface RadioGroupHandlers {
  expandedRadioOptions: Set<string>;
  onToggleExpand: (optionId: string) => void;
  onAddOption: (fieldIndex: number) => void;
  onUpdateOption: (fieldIndex: number, optionIndex: number, updates: Partial<RadioOption>) => void;
  onRemoveOption: (fieldIndex: number, optionIndex: number) => void;
  onAddProduct: (fieldIndex: number, optionIndex: number) => void;
  onUpdateProduct: (
    fieldIndex: number,
    optionIndex: number,
    productIndex: number,
    updates: Partial<RadioOptionProduct>
  ) => void;
  onRemoveProduct: (fieldIndex: number, optionIndex: number, productIndex: number) => void;
  onApplyOffer: (fieldIndex: number, optionIndex: number, offerId: string | null) => void;
}

interface FieldSettingsPanelProps {
  field: FormField;
  fieldIndex: number;
  allFields: FormField[];
  onUpdateField: (index: number, updates: Partial<FormField>) => void;
  onRemoveField: (index: number) => void;
  onClose: () => void;
  onError: (message: string) => void;
  productsContext: ProductsContext;
  radioGroupHandlers: RadioGroupHandlers;
}

function SelectOptionsEditor({
  field,
  fieldIndex,
  onUpdateField,
}: {
  field: FormField;
  fieldIndex: number;
  onUpdateField: (index: number, updates: Partial<FormField>) => void;
}) {
  const options = field.options ?? [];

  const updateOption = (optIndex: number, updates: Partial<{ value: string; label: string }>) => {
    const next = [...options];
    next[optIndex] = { ...next[optIndex], ...updates };
    onUpdateField(fieldIndex, { options: next });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground">Options</span>
        </div>
        <button
          type="button"
          onClick={() =>
            onUpdateField(fieldIndex, {
              options: [...options, { value: `option_${options.length + 1}`, label: `Option ${options.length + 1}` }],
            })
          }
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Option
        </button>
      </div>
      {options.length === 0 ? (
        <p className="canvas-field-hint">No options yet — add at least one for this dropdown to be usable.</p>
      ) : (
        <div className="space-y-2">
          {options.map((opt, optIndex) => (
            <div key={optIndex} className="flex items-center gap-2">
              <input
                type="text"
                value={opt.label}
                onChange={(e) => updateOption(optIndex, { label: e.target.value })}
                placeholder="Label shown to customer"
                className="form-input text-sm flex-1"
              />
              <input
                type="text"
                value={opt.value}
                onChange={(e) => updateOption(optIndex, { value: e.target.value })}
                placeholder="stored_value"
                className="form-input text-sm flex-1 font-mono"
              />
              <button
                type="button"
                onClick={() => onUpdateField(fieldIndex, { options: options.filter((_, i) => i !== optIndex) })}
                className="btn-icon btn-icon-danger"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Settings panel for the currently-selected field — replaces the palette while a field is selected. */
export function FieldSettingsPanel({
  field,
  fieldIndex,
  allFields,
  onUpdateField,
  onRemoveField,
  onClose,
  onError,
  productsContext,
  radioGroupHandlers,
}: FieldSettingsPanelProps) {
  const required = isRequiredField(field);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} className="btn-icon" title="Back to field list">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="field-badge">
          {getFieldIcon(field.type)}
          <span>{field.type.toUpperCase().replace("-", " ")}</span>
        </div>
        {required && (
          <div className="field-badge bg-blue-100 text-blue-800 border-blue-300 ml-auto" title="Required for order processing">
            SYSTEM
          </div>
        )}
        <button
          type="button"
          onClick={() => onRemoveField(fieldIndex)}
          disabled={required}
          className={`btn-icon ${required ? "cursor-not-allowed opacity-40" : "btn-icon-danger"} ${required ? "" : "ml-auto"}`}
          title={required ? "Required fields can't be deleted, only moved" : "Delete field"}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className="form-label text-xs">
          Field Type {required && <span title="Locked for required system fields">🔒</span>}
        </label>
        <select
          value={field.type}
          onChange={(e) => {
            if (required) {
              onError("Cannot change field type for required system fields. This field type is needed for order processing.");
              return;
            }
            onUpdateField(fieldIndex, { type: e.target.value as FormField["type"] });
          }}
          className={`form-input text-sm ${required ? "bg-muted cursor-not-allowed" : ""}`}
          disabled={required}
        >
          <option value="text">Text</option>
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="number">Number</option>
          <option value="textarea">Textarea</option>
          <option value="select">Select</option>
          <option value="radio-group">Radio Group</option>
          <option value="order-bump">Order Bump</option>
        </select>
      </div>

      <label className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border-2 border-border cursor-pointer hover:bg-accent transition-colors">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onUpdateField(fieldIndex, { required: e.target.checked })}
          className="w-4 h-4"
        />
        <span className="text-sm font-semibold text-foreground">Required</span>
      </label>

      <div>
        <label className="form-label text-xs">Label</label>
        <input
          type="text"
          value={field.label}
          onChange={(e) => onUpdateField(fieldIndex, { label: e.target.value })}
          placeholder="Field Label"
          className="form-input text-sm"
        />
      </div>

      <div>
        <label className="form-label text-xs">
          Name {required && <span title="Locked for required system fields">🔒</span>}
        </label>
        <input
          type="text"
          value={field.name}
          onChange={(e) => {
            if (required) {
              onError("Cannot change field name for required system fields. This field name is needed for order processing.");
              return;
            }
            onUpdateField(fieldIndex, { name: e.target.value });
          }}
          placeholder="field_name"
          className={`form-input text-sm font-mono ${required ? "bg-muted cursor-not-allowed" : ""}`}
          disabled={required}
        />
      </div>

      {field.type !== "radio-group" && field.type !== "order-bump" && field.type !== "select" && (
        <div>
          <label className="form-label text-xs">Placeholder</label>
          <input
            type="text"
            value={field.placeholder || ""}
            onChange={(e) => onUpdateField(fieldIndex, { placeholder: e.target.value })}
            placeholder="Enter placeholder..."
            className="form-input text-sm"
          />
        </div>
      )}

      <div>
        <label className="form-label text-xs">Show when field</label>
        <select
          value={field.showWhen?.fieldName ?? ""}
          onChange={(e) => {
            const fieldName = e.target.value;
            if (!fieldName) {
              onUpdateField(fieldIndex, { showWhen: undefined });
              return;
            }
            onUpdateField(fieldIndex, { showWhen: { fieldName, equals: field.showWhen?.equals ?? "" } });
          }}
          className="form-input text-sm"
        >
          <option value="">Always visible</option>
          {allFields
            .filter((f) => f.id !== field.id)
            .map((f) => (
              <option key={f.id} value={f.name}>
                {f.label} ({f.name})
              </option>
            ))}
        </select>
      </div>
      {field.showWhen?.fieldName && (
        <div>
          <label className="form-label text-xs">Equals value</label>
          <input
            type="text"
            value={field.showWhen.equals}
            onChange={(e) =>
              onUpdateField(fieldIndex, { showWhen: { fieldName: field.showWhen!.fieldName, equals: e.target.value } })
            }
            placeholder="e.g. Lagos"
            className="form-input text-sm"
          />
        </div>
      )}

      {field.type === "select" && <SelectOptionsEditor field={field} fieldIndex={fieldIndex} onUpdateField={onUpdateField} />}

      {field.type === "order-bump" && (
        <div className="pt-4 border-t-2 border-border">
          <OrderBumpEditor field={field} fieldIndex={fieldIndex} products={productsContext.products} onUpdateField={onUpdateField} />
        </div>
      )}

      {field.type === "radio-group" && (
        <div className="pt-4 border-t-2 border-border">
          <RadioGroupOptionsEditor
            field={field}
            fieldIndex={fieldIndex}
            products={productsContext.products}
            offersByProduct={productsContext.offersByProduct}
            variantsByProduct={productsContext.variantsByProduct}
            productsLoading={productsContext.productsLoading}
            {...radioGroupHandlers}
          />
        </div>
      )}
    </div>
  );
}
