/**
 * Form validation utilities
 * Ensures forms have minimum required fields for constant extraction
 */

import { FormSchema, FormField } from "../types/form";

/**
 * Required field names for every form (canonical).
 * All forms must have: first_name, last_name, whatsapp_number, phone, state, address.
 */
export const REQUIRED_FORM_FIELD_NAMES = [
  "first_name",
  "last_name",
  "whatsapp_number",
  "phone",
  "state",
  "address",
] as const;

/**
 * Minimum required field names for constant extraction (legacy + canonical)
 * These are the field names that will be checked when extracting constants
 */
export const REQUIRED_FIELD_NAMES = {
  // Customer name - first_name + last_name required; aliases accepted
  customerName: [
    "customer_name",
    "name",
    "first_name",
    "last_name",
  ],
  // Phone number - at least one of these must exist
  phoneNumber: [
    "customer_phone",
    "phone_number",
    "whatsapp_number",
    "whatsapp",
    "phone",
  ],
  // Package name - at least one of these must exist (or radio group)
  packageName: [
    "package_name",
    "selected_package",
    "package",
    "package_type",
  ],
  // State and address - required on every form
  state: ["state", "state_region", "region"],
  address: ["address", "delivery_address", "address_line", "full_address"],
} as const;

/**
 * Check if a form schema has the minimum required fields
 * Every form must have: first_name, last_name, whatsapp_number, phone, state, address
 */
export function validateFormSchema(schema: FormSchema): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  const fieldNames = schema.fields.map((f) => f.name.toLowerCase());

  // Required on every form: first_name, last_name, whatsapp_number, phone, state, address
  if (!fieldNames.includes("first_name")) {
    missingFields.push("first_name (First Name)");
  }
  if (!fieldNames.includes("last_name")) {
    missingFields.push("last_name (Last Name)");
  }
  const hasWhatsApp = fieldNames.includes("whatsapp_number") || fieldNames.includes("whatsapp");
  if (!hasWhatsApp) {
    missingFields.push("whatsapp_number (WhatsApp Number)");
  }
  const hasPhone = fieldNames.some((n) =>
    ["phone", "customer_phone", "phone_number"].includes(n)
  );
  if (!hasPhone) {
    missingFields.push("phone (Phone Number)");
  }
  const hasState = fieldNames.some((n) => REQUIRED_FIELD_NAMES.state.includes(n));
  if (!hasState) {
    missingFields.push("state (State)");
  }
  const hasAddress = fieldNames.some((n) => REQUIRED_FIELD_NAMES.address.includes(n));
  if (!hasAddress) {
    missingFields.push("address (Address)");
  }

  // Package name or radio group (for order forms)
  const hasPackageName = fieldNames.some((name) =>
    REQUIRED_FIELD_NAMES.packageName.includes(name)
  );
  const hasRadioGroup = schema.fields.some((f) => f.type === "radio-group");
  if (!hasPackageName && !hasRadioGroup) {
    missingFields.push(
      `Package/offer field (one of: ${REQUIRED_FIELD_NAMES.packageName.join(", ")}) or radio group for package selection`
    );
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
  };
}

/**
 * Get suggested field names for a given constant type
 */
export function getSuggestedFieldNames(constantType: "customerName" | "phoneNumber" | "packageName"): string[] {
  return [...REQUIRED_FIELD_NAMES[constantType]];
}

/**
 * Check if a field name matches any of the required field name patterns
 */
export function isRequiredFieldName(fieldName: string): {
  type: "customerName" | "phoneNumber" | "packageName" | null;
  matches: string[];
} {
  const lowerName = fieldName.toLowerCase();
  const matches: string[] = [];
  let type: "customerName" | "phoneNumber" | "packageName" | null = null;

  // Check customer name fields
  if (REQUIRED_FIELD_NAMES.customerName.includes(lowerName)) {
    type = "customerName";
    matches.push(...REQUIRED_FIELD_NAMES.customerName);
  }

  // Check phone number fields
  if (REQUIRED_FIELD_NAMES.phoneNumber.includes(lowerName)) {
    if (!type) type = "phoneNumber";
    matches.push(...REQUIRED_FIELD_NAMES.phoneNumber);
  }

  // Check package name fields
  if (REQUIRED_FIELD_NAMES.packageName.includes(lowerName)) {
    if (!type) type = "packageName";
    matches.push(...REQUIRED_FIELD_NAMES.packageName);
  }

  return { type, matches };
}

/**
 * Validate form before saving
 * Throws error if form is invalid
 */
export function validateFormBeforeSave(schema: FormSchema, formName: string): void {
  const validation = validateFormSchema(schema);

  if (!validation.isValid) {
    throw new Error(
      `Form "${formName}" is missing required fields:\n${validation.missingFields.map((f) => `- ${f}`).join("\n")}`
    );
  }

  if (validation.warnings.length > 0) {
    console.warn(
      `Form "${formName}" has warnings:\n${validation.warnings.map((w) => `- ${w}`).join("\n")}`
    );
  }
}

/**
 * Get field mapping suggestions for a form
 * Suggests which fields map to which constants
 */
export function getFieldMappingSuggestions(schema: FormSchema): {
  customerName?: FormField;
  phoneNumber?: FormField;
  packageName?: FormField | { type: "radio-group"; field: FormField };
} {
  const suggestions: {
    customerName?: FormField;
    phoneNumber?: FormField;
    packageName?: FormField | { type: "radio-group"; field: FormField };
  } = {};

  for (const field of schema.fields) {
    const lowerName = field.name.toLowerCase();

    // Check customer name
    if (!suggestions.customerName) {
      if (REQUIRED_FIELD_NAMES.customerName.includes(lowerName)) {
        suggestions.customerName = field;
      } else if (lowerName === "first_name" || lowerName === "last_name") {
        // If we have first_name or last_name, suggest it (even if incomplete)
        suggestions.customerName = field;
      }
    }

    // Check phone number
    if (!suggestions.phoneNumber && REQUIRED_FIELD_NAMES.phoneNumber.includes(lowerName)) {
      suggestions.phoneNumber = field;
    }

    // Check package name
    if (!suggestions.packageName) {
      if (REQUIRED_FIELD_NAMES.packageName.includes(lowerName)) {
        suggestions.packageName = field;
      } else if (field.type === "radio-group") {
        // Radio groups can represent package selection
        suggestions.packageName = { type: "radio-group", field };
      }
    }
  }

  return suggestions;
}

/** Canonical required field names that cannot be deleted */
const REQUIRED_CANONICAL_NAMES = new Set([
  "first_name",
  "last_name",
  "whatsapp_number",
  "whatsapp",
  "phone",
  "customer_phone",
  "phone_number",
  ...REQUIRED_FIELD_NAMES.state,
  ...REQUIRED_FIELD_NAMES.address,
  ...REQUIRED_FIELD_NAMES.packageName,
]);

/**
 * Check if a field is a required field (cannot be deleted)
 * Every form must keep: first_name, last_name, whatsapp_number, phone, state, address + package/radio
 */
export function isRequiredField(field: FormField): boolean {
  const lowerName = field.name.toLowerCase();
  return (
    REQUIRED_CANONICAL_NAMES.has(lowerName) ||
    field.type === "radio-group"
  );
}

/**
 * Get default required fields for a new form
 * Every form must have: first_name, last_name, whatsapp_number, phone, state, address + package selection
 */
export function getDefaultRequiredFields(): FormField[] {
  const ts = Date.now();
  return [
    {
      id: `field_first_name_${ts}`,
      type: "text",
      label: "First Name",
      name: "first_name",
      required: true,
      placeholder: "Enter your first name",
    },
    {
      id: `field_last_name_${ts}`,
      type: "text",
      label: "Last Name",
      name: "last_name",
      required: true,
      placeholder: "Enter your last name",
    },
    {
      id: `field_whatsapp_number_${ts}`,
      type: "phone",
      label: "WhatsApp Number",
      name: "whatsapp_number",
      required: true,
      placeholder: "+2348012345678",
    },
    {
      id: `field_phone_${ts}`,
      type: "phone",
      label: "Phone Number",
      name: "phone",
      required: true,
      placeholder: "+2348012345678",
    },
    {
      id: `field_state_${ts}`,
      type: "text",
      label: "State",
      name: "state",
      required: true,
      placeholder: "e.g. Lagos, Abuja",
    },
    {
      id: `field_address_${ts}`,
      type: "textarea",
      label: "Address",
      name: "address",
      required: true,
      placeholder: "Enter your full delivery address",
    },
    {
      id: `field_package_selection_${ts}`,
      type: "radio-group",
      label: "Select Package",
      name: "package_selection",
      required: true,
      radioOptions: [],
    },
  ];
}

/**
 * Ensure required fields exist in schema
 * Every form must have: first_name, last_name, whatsapp_number, phone, state, address + package/radio
 */
export function ensureRequiredFields(schema: FormSchema): FormSchema {
  const existingFieldNames = schema.fields.map((f) => f.name.toLowerCase());
  const requiredFields: FormField[] = [];
  const ts = Date.now();

  if (!existingFieldNames.includes("first_name")) {
    requiredFields.push({
      id: `field_first_name_${ts}`,
      type: "text",
      label: "First Name",
      name: "first_name",
      required: true,
      placeholder: "Enter your first name",
    });
  }
  if (!existingFieldNames.includes("last_name")) {
    requiredFields.push({
      id: `field_last_name_${ts}`,
      type: "text",
      label: "Last Name",
      name: "last_name",
      required: true,
      placeholder: "Enter your last name",
    });
  }
  const hasWhatsApp = existingFieldNames.includes("whatsapp_number") || existingFieldNames.includes("whatsapp");
  if (!hasWhatsApp) {
    requiredFields.push({
      id: `field_whatsapp_number_${ts}`,
      type: "phone",
      label: "WhatsApp Number",
      name: "whatsapp_number",
      required: true,
      placeholder: "+2348012345678",
    });
  }
  const hasPhone = existingFieldNames.some((n) => ["phone", "customer_phone", "phone_number"].includes(n));
  if (!hasPhone) {
    requiredFields.push({
      id: `field_phone_${ts}`,
      type: "phone",
      label: "Phone Number",
      name: "phone",
      required: true,
      placeholder: "+2348012345678",
    });
  }
  const hasState = existingFieldNames.some((n) => REQUIRED_FIELD_NAMES.state.includes(n));
  if (!hasState) {
    requiredFields.push({
      id: `field_state_${ts}`,
      type: "text",
      label: "State",
      name: "state",
      required: true,
      placeholder: "e.g. Lagos, Abuja",
    });
  }
  const hasAddress = existingFieldNames.some((n) => REQUIRED_FIELD_NAMES.address.includes(n));
  if (!hasAddress) {
    requiredFields.push({
      id: `field_address_${ts}`,
      type: "textarea",
      label: "Address",
      name: "address",
      required: true,
      placeholder: "Enter your full delivery address",
    });
  }

  const hasPackageName = existingFieldNames.some((name) =>
    REQUIRED_FIELD_NAMES.packageName.includes(name)
  );
  const hasRadioGroup = schema.fields.some((f) => f.type === "radio-group");
  if (!hasPackageName && !hasRadioGroup) {
    requiredFields.push({
      id: `field_package_selection_${ts}`,
      type: "radio-group",
      label: "Select Package",
      name: "package_selection",
      required: true,
      radioOptions: [],
    });
  }

  if (requiredFields.length > 0) {
    return {
      ...schema,
      fields: [...requiredFields, ...schema.fields],
    };
  }

  return schema;
}
