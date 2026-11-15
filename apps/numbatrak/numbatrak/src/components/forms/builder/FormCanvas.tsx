import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, GripVertical, Lock, Package, Plus, Sparkles, Trash2 } from "lucide-react";
import { FormField } from "../../../types/form";
import { isRequiredField } from "../../../utils/formValidation";
import { nigeriaStates } from "../../../constants/nigeriaStates";

/**
 * WYSIWYG form canvas.
 *
 * At rest this reads as the form a customer will actually see — no badges, no
 * chrome. Controls appear on hover or selection, so the builder looks like the
 * thing being built rather than a list of config rows.
 *
 * Reordering is offered three ways on purpose: drag for speed, the ↑/↓ buttons
 * for precision (and for touch and keyboard, where HTML5 drag doesn't work),
 * and the field list order itself. Insert points sit between fields so a new
 * field can land where it's wanted instead of always at the end.
 */

interface FormCanvasProps {
  fields: FormField[];
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onMoveField: (fromIndex: number, toIndex: number) => void;
  onRemoveField: (index: number) => void;
  onDuplicateField: (index: number) => void;
  /** Drop/click target for adding a field at a specific position. */
  onInsertAt: (index: number, type?: FormField["type"]) => void;
}

function FieldPreviewControl({ field }: { field: FormField }) {
  if (field.type === "radio-group") {
    const options = field.radioOptions ?? [];
    if (options.length === 0) {
      return (
        <p className="canvas-field-hint">
          No packages yet — select this field to choose some. Customers can&apos;t order without one.
        </p>
      );
    }
    return (
      <div className="space-y-2">
        {options.map((option) => (
          <label key={option.id} className="preview-radio-option">
            <input type="radio" disabled className="mt-1 w-4 h-4" />
            <div className="preview-radio-content">
              <div className="preview-radio-title">
                {option.title || "Choose a package…"}
                {option.price > 0 && (
                  <span className="ml-2 text-sm font-bold text-primary">
                    ₦{option.price.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              {!option.offer_id && (
                <div className="preview-radio-products">
                  <Package className="w-3 h-3 inline mr-1" />
                  No package chosen yet
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
          {!bump?.offer_id && (
            <div className="preview-radio-products">
              <Package className="w-3 h-3 inline mr-1" />
              No package chosen yet
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

  if (field.type === "state") {
    return (
      <select disabled className="form-input">
        <option>{field.placeholder || "Select a state"}</option>
        {nigeriaStates.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    );
  }

  return <input type={field.type} disabled placeholder={field.placeholder} className="form-input" />;
}

/**
 * The gap between two fields. Shows a drop line while something is being
 * dragged over it, and an "add here" affordance on hover otherwise.
 */
function InsertPoint({
  index,
  isDropTarget,
  onInsert,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  index: number;
  isDropTarget: boolean;
  onInsert: (index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className={`canvas-insert-point ${isDropTarget ? "canvas-insert-point-active" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <span className="canvas-insert-line" aria-hidden />
      <button
        type="button"
        className="canvas-insert-button"
        onClick={() => onInsert(index)}
        aria-label={`Add a field at position ${index + 1}`}
        title="Add a field here"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

export function FormCanvas({
  fields,
  selectedFieldId,
  onSelectField,
  onMoveField,
  onRemoveField,
  onDuplicateField,
  onInsertAt,
}: FormCanvasProps) {
  // Index of the field being dragged from within the canvas; null when the drag
  // originated in the palette (or nothing is being dragged).
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // Only a mousedown on the grip arms the drag, so selecting text in a field
  // label doesn't start one.
  const dragArmed = useRef(false);

  const endDrag = () => {
    setDraggedIndex(null);
    setDropIndex(null);
    dragArmed.current = false;
  };

  /** A palette entry sets this MIME type; a canvas reorder does not. */
  const paletteTypeFrom = (e: React.DragEvent): FormField["type"] | null => {
    const raw = e.dataTransfer.getData("application/x-numbatrak-field");
    return raw ? (raw as FormField["type"]) : null;
  };

  const handleDropAt = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const paletteType = paletteTypeFrom(e);
    if (paletteType) {
      onInsertAt(index, paletteType);
    } else if (draggedIndex !== null) {
      // Removing the dragged field shifts everything after it up by one.
      const target = draggedIndex < index ? index - 1 : index;
      if (target !== draggedIndex) onMoveField(draggedIndex, target);
    }
    endDrag();
  };

  const handleDragOverAt = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedIndex === null ? "copy" : "move";
    setDropIndex(index);
  };

  if (fields.length === 0) {
    return (
      <div
        className="empty-state"
        onDragOver={(e) => {
          e.preventDefault();
          setDropIndex(0);
        }}
        onDrop={handleDropAt(0)}
      >
        <div className="empty-state-icon">
          <Sparkles className="w-8 h-8" />
        </div>
        <h3 className="empty-state-title">Start building your form</h3>
        <p className="empty-state-description">
          Drag a field in from the right, or click one to add it.
        </p>
      </div>
    );
  }

  return (
    <div className="canvas-stack" onDragEnd={endDrag}>
      <InsertPoint
        index={0}
        isDropTarget={dropIndex === 0}
        onInsert={onInsertAt}
        onDragOver={handleDragOverAt(0)}
        onDragLeave={() => setDropIndex(null)}
        onDrop={handleDropAt(0)}
      />

      {fields.map((field, index) => {
        const selected = field.id === selectedFieldId;
        // Locked only while this field is the last one covering a requirement.
        const systemField = isRequiredField(field, fields);
        return (
          <div key={field.id}>
            <div
              draggable
              // The whole card is a drop target, not just the thin gaps between
              // cards. Dropping on the top half inserts above, the bottom half
              // below. Previously only an ~18px strip accepted a drop, so a
              // palette tile dragged onto a field simply did nothing and read
              // as "this field type can't be dragged in".
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = draggedIndex === null ? "copy" : "move";
                const box = e.currentTarget.getBoundingClientRect();
                const after = e.clientY > box.top + box.height / 2;
                setDropIndex(after ? index + 1 : index);
              }}
              onDrop={(e) => {
                const box = e.currentTarget.getBoundingClientRect();
                const after = e.clientY > box.top + box.height / 2;
                handleDropAt(after ? index + 1 : index)(e);
              }}
              onDragStart={(e) => {
                if (!dragArmed.current) {
                  e.preventDefault();
                  return;
                }
                // Marks this as a reorder rather than a palette insert.
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", field.id);
                setDraggedIndex(index);
              }}
              onClick={() => onSelectField(field.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectField(field.id);
                }
              }}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${field.label || field.type} field, position ${index + 1} of ${fields.length}`}
              className={`canvas-field-card ${selected ? "canvas-field-card-selected" : ""} ${
                draggedIndex === index ? "canvas-field-card-dragging" : ""
              } ${dropIndex === index ? "canvas-field-card-drop-before" : ""} ${
                dropIndex === index + 1 ? "canvas-field-card-drop-after" : ""
              }`}
            >
              {/* Floating controls — revealed on hover, focus-within or selection. */}
              <div className="canvas-field-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onMouseDown={() => {
                    dragArmed.current = true;
                  }}
                  onMouseUp={() => {
                    dragArmed.current = false;
                  }}
                  className="canvas-action cursor-grab active:cursor-grabbing"
                  title="Drag to reorder"
                  aria-label="Drag to reorder"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveField(index, index - 1)}
                  disabled={index === 0}
                  className="canvas-action"
                  title="Move up"
                  aria-label="Move up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveField(index, index + 1)}
                  disabled={index === fields.length - 1}
                  className="canvas-action"
                  title="Move down"
                  aria-label="Move down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicateField(index)}
                  className="canvas-action"
                  title="Duplicate"
                  aria-label="Duplicate field"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveField(index)}
                  disabled={systemField}
                  className={`canvas-action ${systemField ? "" : "canvas-action-danger"}`}
                  title={
                    systemField
                      ? "Every order form needs this field — you can move it, but not remove it"
                      : "Delete field"
                  }
                  aria-label={
                    systemField
                      ? `${field.label || field.type}: every order form needs this field, so it can't be removed`
                      : `Delete ${field.label || field.type}`
                  }
                >
                  {systemField ? <Lock className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
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

            <InsertPoint
              index={index + 1}
              isDropTarget={dropIndex === index + 1}
              onInsert={onInsertAt}
              onDragOver={handleDragOverAt(index + 1)}
              onDragLeave={() => setDropIndex(null)}
              onDrop={handleDropAt(index + 1)}
            />
          </div>
        );
      })}
    </div>
  );
}
