import { FormResponseFieldValues } from "../../utils/formResponseHelpers";
import { FormSchema } from "../../types/form";

interface FormFieldRendererProps {
  fieldValues: FormResponseFieldValues;
  formSchema?: FormSchema | null;
}

export function FormFieldRenderer({ fieldValues, formSchema }: FormFieldRendererProps) {
  if (!fieldValues || Object.keys(fieldValues).length === 0) {
    return (
      <div className="text-sm text-gray-500 italic p-4">
        No form data available
      </div>
    );
  }

  // Get field definitions from schema if available
  const fieldMap = new Map<string, { label: string; type: string }>();
  if (formSchema?.fields) {
    formSchema.fields.forEach((field) => {
      fieldMap.set(field.name.toLowerCase(), {
        label: field.label,
        type: field.type,
      });
    });
  }

  // Group fields by type for better organization
  const fields = Object.entries(fieldValues)
    .filter(([key]) => {
      // Skip internal/system fields
      return !key.startsWith('_') && key !== 'page_url';
    })
    .map(([key, value]) => {
      const fieldDef = fieldMap.get(key.toLowerCase());
      return {
        key,
        value,
        label: fieldDef?.label || formatFieldName(key),
        type: fieldDef?.type || 'text',
      };
    });

  // Group by common field types
  const groupedFields = {
    contact: fields.filter((f) => 
      ['phone', 'email', 'tel'].some(t => f.type.includes(t) || f.key.toLowerCase().includes(t))
    ),
    location: fields.filter((f) => 
      ['location', 'address', 'state', 'city', 'delivery'].some(t => f.key.toLowerCase().includes(t))
    ),
    package: fields.filter((f) => 
      ['package', 'product', 'item'].some(t => f.key.toLowerCase().includes(t))
    ),
    other: fields.filter((f) => 
      !['phone', 'email', 'tel', 'location', 'address', 'state', 'city', 'delivery', 'package', 'product', 'item'].some(t => 
        f.type.includes(t) || f.key.toLowerCase().includes(t)
      )
    ),
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return "N/A";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  };

  const renderFieldGroup = (title: string, fields: typeof groupedFields.contact) => {
    if (fields.length === 0) return null;
    
    return (
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
          {title}
        </h4>
        <div className="space-y-2">
          {fields.map((field) => (
            <div key={field.key} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700 mb-1">
                  {field.label}
                </div>
                <div className="text-sm text-gray-900 break-words">
                  {formatValue(field.value)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="form-field-renderer p-4 bg-gray-50 rounded-lg">
      {renderFieldGroup("Contact Information", groupedFields.contact)}
      {renderFieldGroup("Location", groupedFields.location)}
      {renderFieldGroup("Package & Products", groupedFields.package)}
      {renderFieldGroup("Additional Information", groupedFields.other)}
    </div>
  );
}

/**
 * Format field name to readable label
 */
function formatFieldName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
