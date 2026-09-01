import { useRef, useState } from "react";
import { GripVertical, Package, Sparkles, Trash2 } from "lucide-react";
import { FormField } from "../../../types/form";
import { isRequiredField } from "../../../utils/formValidation";
import { getFieldIcon } from "./fieldIcons";

interface FormCanvasProps {
  fields: FormField[];
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onMoveField: (fromIndex: number, toIndex: number) => void;
  onRemoveField: (index: number) => void;
}

function FieldPreviewControl({ field }: { field: FormField }) {
  if (field.type === "radio-group") {
    const options = field.radioOptions ?? [];
    if (options.length === 0) {
      return <p className="canvas-field-hint">No options yet — configure this field to add some.</p>;
    }
    return (
      <div className="space-y-2">
        {options.map((option) => (
          <label key={option.id} className="preview-radio-option">
            <input type="radio" disabled className="mt-1 w-4 h-4" />
            <div className="preview-radio-content">
              <div className="preview-radio-title">
                {option.title || "Untitled option"}
                {option.price > 0 && (
                  <span className="ml-2 text-sm font-bold text-primary">
                    ₦{option.price.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              {option.products.length > 0 && (
                <div className="preview-radio-products">
                  <Package className="w-3 h-3 inline mr-1" />
                  {option.products.length} product{option.products.length === 1 ? "" : "s"} attached
                </div>
              )}
            </div>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "order-bump") {
    const bump = field.orderBump;
    return (
      <label className="preview-radio-option">
        <input type="checkbox" disabled className="mt-1 w-4 h-4" />
        <div className="preview-radio-content">
          <div className="preview-radio-title">
            {bump?.title || "Order bump"}
            {!!bump?.price && (
              <span className="ml-2 text-sm font-bold text-primary">
                ₦{bump.price.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
          {(bump?.products?.length ?? 0) > 0 && (
            <div className="preview-radio-products">
              <Package className="w-3 h-3 inline mr-1" />
              {bump!.products.length} product{bump!.products.length === 1 ? "" : "s"} attached
            </div>
          )}
        </div>
      </label>
    );
  }

  if (field.type === "textarea") {
    return <textarea disabled className="form-input" placeholder={field.placeholder} rows={3} />;
  }

  if (field.type === "select") {
    return (
      <select disabled className="form-input">
        <option>{field.placeholder || "Select an option..."}</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  return <input type={field.type} disabled placeholder={field.placeholder} className="form-input" />;
}

/** WYSIWYG list of form fields — click a block to edit it, drag the handle to reorder. */
export function FormCanvas({ fields, selectedFieldId, onSelectField, onMoveField, onRemoveField }: FormCanvasProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dragHandleActive = useRef(false);

  if (fields.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Sparkles className="w-8 h-8" />
        </div>
        <h3 className="empty-state-title">No fields yet</h3>
        <p className="empty-state-description">Add a field from the panel to start building your form.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fields.map((field, index) => {
        const selected = field.id === selectedFieldId;
        const required = isRequiredField(field);
        return (
          <div
            key={field.id}
            draggable
            onDragStart={(e) => {
              if (!dragHandleActive.current) {
                e.preventDefault();
                return;
              }
              setDraggedIndex(index);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggedIndex === null || draggedIndex === index) return;
              onMoveField(draggedIndex, index);
              setDraggedIndex(index);
            }}
            onDragEnd={() => {
              setDraggedIndex(null);
              dragHandleActive.current = false;
            }}
            onClick={() => onSelectField(field.id)}
            className={`canvas-field-card ${selected ? "canvas-field-card-selected" : ""} ${
              draggedIndex === index ? "opacity-50" : ""
            }`}
          >
            <div className="canvas-field-toolbar">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  dragHandleActive.current = true;
                }}
                onMouseUp={() => {
                  dragHandleActive.current = false;
                }}
                onClick={(e) => e.stopPropagation()}
                className="btn-icon cursor-grab active:cursor-grabbing"
                title="Drag to reorder"
              >
                <GripVertical className="w-4 h-4" />
              </button>
              <div className="field-badge">
                {getFieldIcon(field.type)}
                <span>{field.type.toUpperCase().replace("-", " ")}</span>
              </div>
              {field.required && <div className="field-badge field-badge-required">REQUIRED</div>}
              {required && (
                <div
                  className="field-badge bg-blue-100 text-blue-800 border-blue-300"
                  title="Required for order processing"
                >
                  SYSTEM
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveField(index);
                }}
                disabled={required}
                className={`btn-icon ml-auto ${required ? "cursor-not-allowed opacity-40" : "btn-icon-danger"}`}
                title={required ? "Required fields can't be deleted, only moved" : "Delete field"}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <label className="preview-label">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="canvas-field-preview">
              <FieldPreviewControl field={field} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
