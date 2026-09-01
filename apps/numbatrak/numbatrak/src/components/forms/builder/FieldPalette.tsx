import { CheckSquare, FileText, Hash, List, Mail, Phone, Radio, Type } from "lucide-react";
import { FormField } from "../../../types/form";

interface PaletteEntry {
  type: FormField["type"];
  label: string;
  icon: React.ReactElement;
}

const GENERAL_FIELDS: PaletteEntry[] = [
  { type: "text", label: "Text", icon: <Type className="w-4 h-4" /> },
  { type: "email", label: "Email", icon: <Mail className="w-4 h-4" /> },
  { type: "phone", label: "Phone", icon: <Phone className="w-4 h-4" /> },
  { type: "number", label: "Number", icon: <Hash className="w-4 h-4" /> },
  { type: "textarea", label: "Textarea", icon: <FileText className="w-4 h-4" /> },
  { type: "select", label: "Select", icon: <List className="w-4 h-4" /> },
];

const ORDER_FIELDS: PaletteEntry[] = [
  { type: "radio-group", label: "Radio Group", icon: <Radio className="w-4 h-4" /> },
  { type: "order-bump", label: "Order Bump", icon: <CheckSquare className="w-4 h-4" /> },
];

interface FieldPaletteProps {
  onAddField: (type: FormField["type"]) => void;
}

function PaletteGrid({ entries, onAddField }: { entries: PaletteEntry[]; onAddField: (type: FormField["type"]) => void }) {
  return (
    <div className="palette-grid">
      {entries.map((entry) => (
        <button key={entry.type} type="button" onClick={() => onAddField(entry.type)} className="palette-item">
          <span className="palette-item-icon">{entry.icon}</span>
          <span className="palette-item-label">{entry.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Click-to-add field-type palette shown when no field is selected. */
export function FieldPalette({ onAddField }: FieldPaletteProps) {
  return (
    <div className="space-y-6">
      <div>
        <div className="palette-category-title">General Fields</div>
        <PaletteGrid entries={GENERAL_FIELDS} onAddField={onAddField} />
      </div>
      <div>
        <div className="palette-category-title">Order Fields</div>
        <PaletteGrid entries={ORDER_FIELDS} onAddField={onAddField} />
      </div>
    </div>
  );
}
