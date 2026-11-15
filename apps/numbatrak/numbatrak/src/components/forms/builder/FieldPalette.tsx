import { CheckSquare, FileText, Hash, List, Lock, Mail, MapPin, Phone, Radio, Type } from "lucide-react";
import { FormField } from "../../../types/form";

interface PaletteEntry {
  type: FormField["type"];
  label: string;
  /** Plain-language note — what this field is for, not what it is called. */
  hint: string;
  icon: React.ReactElement;
}

const GENERAL_FIELDS: PaletteEntry[] = [
  { type: "text", label: "Text", hint: "Short answer", icon: <Type className="w-4 h-4" /> },
  { type: "email", label: "Email", hint: "Email address", icon: <Mail className="w-4 h-4" /> },
  { type: "phone", label: "Phone", hint: "Phone or WhatsApp", icon: <Phone className="w-4 h-4" /> },
  { type: "number", label: "Number", hint: "Digits only", icon: <Hash className="w-4 h-4" /> },
  { type: "textarea", label: "Long text", hint: "Notes, address", icon: <FileText className="w-4 h-4" /> },
  { type: "select", label: "Dropdown", hint: "Pick one from a list", icon: <List className="w-4 h-4" /> },
  { type: "state", label: "State", hint: "Nigerian states", icon: <MapPin className="w-4 h-4" /> },
];

const ORDER_FIELDS: PaletteEntry[] = [
  { type: "radio-group", label: "Package picker", hint: "The packages they choose from", icon: <Radio className="w-4 h-4" /> },
  { type: "order-bump", label: "Order bump", hint: "Optional add-on at checkout", icon: <CheckSquare className="w-4 h-4" /> },
];

/** Reason a field type can't be added right now, keyed by type. */
export type PaletteUnavailable = Partial<Record<FormField["type"], string>>;

interface FieldPaletteProps {
  /** Appends to the end — the click path. Dragging onto the canvas inserts at a position instead. */
  onAddField: (type: FormField["type"]) => void;
  /**
   * Types that would add a field the merchant can't finish configuring — a
   * package picker with no packages to pick, say. Shown as unavailable rather
   * than quietly producing a dead end.
   */
  unavailable?: PaletteUnavailable;
  /** Called when someone taps an unavailable tile, so the reason can be surfaced. */
  onUnavailable?: (type: FormField["type"], reason: string) => void;
}

function PaletteGrid({
  entries,
  onAddField,
  unavailable,
  onUnavailable,
}: {
  entries: PaletteEntry[];
  onAddField: (type: FormField["type"]) => void;
  unavailable: PaletteUnavailable;
  onUnavailable?: (type: FormField["type"], reason: string) => void;
}) {
  return (
    <div className="palette-grid">
      {entries.map((entry) => {
        const reason = unavailable[entry.type];

        // Deliberately not a `disabled` button: a disabled control swallows
        // pointer events, so neither its tooltip nor a tap would ever explain
        // why it can't be used. This stays reachable and says why.
        return (
          <button
            key={entry.type}
            type="button"
            draggable={!reason}
            aria-disabled={reason ? true : undefined}
            onDragStart={(e) => {
              if (reason) {
                e.preventDefault();
                return;
              }
              // The canvas distinguishes a palette insert from a reorder by this type.
              e.dataTransfer.setData("application/x-numbatrak-field", entry.type);
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => (reason ? onUnavailable?.(entry.type, reason) : onAddField(entry.type))}
            className={`palette-item ${reason ? "palette-item-unavailable" : ""}`}
            title={reason ?? `${entry.label} — ${entry.hint}`}
          >
            <span className="palette-item-icon">{reason ? <Lock className="w-4 h-4" /> : entry.icon}</span>
            <span className="palette-item-text">
              <span className="palette-item-label">{entry.label}</span>
              <span className="palette-item-hint">{reason ? "Not ready yet — tap to see why" : entry.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Field-type palette. Always reachable — adding a field never requires deselecting one first. */
export function FieldPalette({ onAddField, unavailable = {}, onUnavailable }: FieldPaletteProps) {
  return (
    <div className="space-y-5">
      <p className="palette-intro">Drag one onto the form to place it, or click to add it at the end.</p>
      <div>
        <div className="palette-category-title">Customer details</div>
        <PaletteGrid
          entries={GENERAL_FIELDS}
          onAddField={onAddField}
          unavailable={unavailable}
          onUnavailable={onUnavailable}
        />
      </div>
      <div>
        <div className="palette-category-title">What they&apos;re buying</div>
        <PaletteGrid
          entries={ORDER_FIELDS}
          onAddField={onAddField}
          unavailable={unavailable}
          onUnavailable={onUnavailable}
        />
      </div>
    </div>
  );
}
