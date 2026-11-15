import { ArrowLeft, List, Lock, Plus, Trash2 } from "lucide-react";
import { FormField } from "../../../types/form";
import { PackageCatalog, PackageChoice } from "../../../utils/formPackages";
import { isRequiredField, getFieldLockReasons } from "../../../utils/formValidation";
import { generateSelectOptionNaming } from "../../../utils/formSchemaUtils";
import { RadioGroupOptionsEditor } from "./RadioGroupOptionsEditor";
import { OrderBumpEditor } from "./OrderBumpEditor";
import { getFieldIcon } from "./fieldIcons";
import { FIELD_TYPE_LABELS, fieldTypeLabel } from "./fieldTypes";

/** Order the type picker lists field types in: customer details, then ordering. */
const FIELD_TYPE_ORDER: FormField["type"][] = [
  "text",
  "email",
  "phone",
  "number",
  "textarea",
  "select",
  "state",
  "radio-group",
  "order-bump",
];

interface ProductsContext {
  productsLoading: boolean;
  /** Every active offer, as a pickable package. */
  packageCatalog: PackageCatalog;
}

interface PackageHandlers {
  onAddOption: (fieldIndex: number) => void;
  onRemoveOption: (fieldIndex: number, optionIndex: number) => void;
  onChoosePackage: (fieldIndex: number, optionIndex: number, choice: PackageChoice | null) => void;
  onChooseBumpPackage: (fieldIndex: number, choice: PackageChoice | null) => void;
}

interface FieldSettingsPanelProps {
  field: FormField;
  fieldIndex: number;
  allFields: FormField[];
  onUpdateField: (index: number, updates: Partial<FormField>, coalesceKey?: string | null) => void;
  onRemoveField: (index: number) => void;
  onClose: () => void;
  onError: (message: string) => void;
  productsContext: ProductsContext;
  packageHandlers: PackageHandlers;
}

function SelectOptionsEditor({
  field,
  fieldIndex,
  onUpdateField,
}: {
  field: FormField;
  fieldIndex: number;
  onUpdateField: (index: number, updates: Partial<FormField>, coalesceKey?: string | null) => void;
}) {
  const options = field.options ?? [];

  const updateOption = (optIndex: number, updates: Partial<{ value: string; label: string }>) => {
    const next = [...options];
    next[optIndex] = { ...next[optIndex], ...updates };
    onUpdateField(
      fieldIndex,
      { options: next },
      `select:${field.id}:${optIndex}:${Object.keys(updates).join(",")}`,
    );
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
            onUpdateField(fieldIndex, { options: [...options, generateSelectOptionNaming(options)] }, null)
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
                onClick={() =>
                  onUpdateField(fieldIndex, { options: options.filter((_, i) => i !== optIndex) }, null)
                }
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
  packageHandlers,
}: FieldSettingsPanelProps) {
  const required = isRequiredField(field, allFields);
  const lockReasons = getFieldLockReasons(field, allFields);
  const lockHint = required
    ? `Every order form needs a field for the ${lockReasons
        .map((r) => r.label)
        .join(" and ")}, and this is the only one.`
    : undefined;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} className="btn-icon" title="Back to field list">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="field-badge">
          {getFieldIcon(field.type)}
          <span>{fieldTypeLabel(field.type)}</span>
        </div>
        {required && (
          <div
            className="field-badge bg-blue-100 text-blue-800 border-blue-300 ml-auto"
            title={lockHint}
          >
            <Lock className="w-3 h-3" />
            <span>Always needed</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => onRemoveField(fieldIndex)}
          disabled={required}
          className={`btn-icon ${required ? "cursor-not-allowed opacity-40" : "btn-icon-danger"} ${required ? "" : "ml-auto"}`}
          title={required ? lockHint : `Delete "${field.label || field.name}"`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {required && <p className="field-lock-note">{lockHint}</p>}

      <div>
        <label className="form-label text-xs" htmlFor={`${field.id}-type`}>
          Field type {required && <Lock className="inline w-3 h-3 align-[-1px]" aria-hidden />}
        </label>
        <select
          id={`${field.id}-type`}
          value={field.type}
          onChange={(e) => {
            if (required) {
              onError(`${lockHint} Its type has to stay as it is so orders come through correctly.`);
              return;
            }
            onUpdateField(fieldIndex, { type: e.target.value as FormField["type"] });
          }}
          className={`form-input text-sm ${required ? "bg-muted cursor-not-allowed" : ""}`}
          disabled={required}
          title={required ? lockHint : undefined}
        >
          {FIELD_TYPE_ORDER.map((type) => (
            <option key={type} value={type}>
              {FIELD_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {/* A locked field is required by definition - showing an editable
          "Required" box let merchants make First Name optional while it stayed
          undeletable, which is incoherent and breaks order intake. */}
      <label
        className={`flex items-start gap-2 px-3 py-2 bg-muted rounded-lg border-2 border-border transition-colors ${
          required ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:bg-accent"
        }`}
        title={required ? "Required for every order form" : undefined}
      >
        <input
          type="checkbox"
          checked={required ? true : field.required}
          disabled={required}
          onChange={(e) => onUpdateField(fieldIndex, { required: e.target.checked })}
          className="w-4 h-4 mt-0.5"
        />
        <span>
          <span className="text-sm font-semibold text-foreground block">
            Customers must fill this in
          </span>
          {required && (
            <span className="text-xs text-muted-foreground">Required for every order form</span>
          )}
        </span>
      </label>

      <div>
        <label className="form-label text-xs" htmlFor={`${field.id}-label`}>
          Label customers see
        </label>
        <input
          id={`${field.id}-label`}
          type="text"
          value={field.label}
          onChange={(e) => onUpdateField(fieldIndex, { label: e.target.value })}
          placeholder="e.g. Your full name"
          className="form-input text-sm"
        />
      </div>

      <div>
        <label className="form-label text-xs" htmlFor={`${field.id}-name`}>
          Answer key {required && <Lock className="inline w-3 h-3 align-[-1px]" aria-hidden />}
        </label>
        <input
          id={`${field.id}-name`}
          type="text"
          value={field.name}
          onChange={(e) => {
            if (required) {
              onError(`${lockHint} Its answer key has to stay as it is so orders come through correctly.`);
              return;
            }
            onUpdateField(fieldIndex, { name: e.target.value });
          }}
          placeholder="field_name"
          className={`form-input text-sm font-mono ${required ? "bg-muted cursor-not-allowed" : ""}`}
          disabled={required}
          title={required ? lockHint : undefined}
          aria-describedby={`${field.id}-name-help`}
        />
        <p id={`${field.id}-name-help`} className="text-xs text-muted-foreground mt-1">
          The key this answer is saved under. Changing it can break integrations already pointing at it.
        </p>
      </div>

      {field.type !== "radio-group" && field.type !== "order-bump" && field.type !== "select" && field.type !== "state" && (
        <div>
          <label className="form-label text-xs" htmlFor={`${field.id}-placeholder`}>
            Hint text inside the box
          </label>
          <input
            id={`${field.id}-placeholder`}
            type="text"
            value={field.placeholder || ""}
            onChange={(e) => onUpdateField(fieldIndex, { placeholder: e.target.value })}
            placeholder="Enter placeholder..."
            className="form-input text-sm"
          />
        </div>
      )}

      <div>
        <label className="form-label text-xs" htmlFor={`${field.id}-showwhen`}>
          Only show this field when
        </label>
        <select
          id={`${field.id}-showwhen`}
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
          <label className="form-label text-xs" htmlFor={`${field.id}-equals`}>
            ...is exactly
          </label>
          <input
            id={`${field.id}-equals`}
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
          <OrderBumpEditor
            field={field}
            fieldIndex={fieldIndex}
            catalog={productsContext.packageCatalog}
            productsLoading={productsContext.productsLoading}
            onChoosePackage={packageHandlers.onChooseBumpPackage}
          />
        </div>
      )}

      {field.type === "radio-group" && (
        <div className="pt-4 border-t-2 border-border">
          <RadioGroupOptionsEditor
            field={field}
            fieldIndex={fieldIndex}
            catalog={productsContext.packageCatalog}
            productsLoading={productsContext.productsLoading}
            onAddOption={packageHandlers.onAddOption}
            onRemoveOption={packageHandlers.onRemoveOption}
            onChoosePackage={packageHandlers.onChoosePackage}
          />
        </div>
      )}
    </div>
  );
}
