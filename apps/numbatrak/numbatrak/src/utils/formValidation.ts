/**
 * What every order form must collect, and which fields are locked because of it.
 *
 * A form that can't be turned into an order is worse than useless, so the
 * builder guarantees a minimum set of answers. Two rules follow from that:
 *
 *  - Saving is blocked while a requirement is unmet, or while two fields share
 *    a `name` (the key a submission arrives under - duplicates silently merge
 *    answers and break conditional logic and the Elementor mapping).
 *  - A field is locked from deletion only while it is the *last* field
 *    satisfying a requirement. A second package picker, or an `address` field
 *    alongside a `delivery_address` one, stays deletable; whichever is left
 *    standing becomes locked. Previously *every* radio group was undeletable,
 *    so one mistaken package picker could never be removed.
 */

import { FormSchema, FormField } from "../types/form";
import { createId } from "./formSchemaUtils";

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
];

/**
 * Accepted names per requirement (legacy aliases included, because forms
 * built before the canonical names existed are still live).
 */
export const REQUIRED_FIELD_NAMES = {
  // Customer name - first_name + last_name required; aliases accepted
  customerName: ["customer_name", "name", "first_name", "last_name"],
  // Phone number - at least one of these must exist
  phoneNumber: ["customer_phone", "phone_number", "whatsapp_number", "whatsapp", "phone"],
  // Package name - at least one of these must exist (or radio group)
  packageName: ["package_name", "selected_package", "package", "package_type"],
  // State and address - required on every form
  state: ["state", "state_region", "region"],
  address: ["address", "delivery_address", "address_line", "full_address"],
};

function fieldName(field: FormField): string {
  return field.name.trim().toLowerCase();
}

const named =
  (...names: string[]) =>
  (field: FormField): boolean =>
    names.includes(fieldName(field));

export type RequirementKey =
  | "firstName"
  | "lastName"
  | "whatsapp"
  | "phone"
  | "state"
  | "address"
  | "package";

export interface FieldRequirement {
  key: RequirementKey;
  /**
   * Plain-language name for the answer this collects, written to drop into
   * "the only field that collects the <label>". Sentence case.
   */
  label: string;
  /** Why the form needs it. Completes "Every order form needs it so <purpose>." */
  purpose: string;
  /** How to satisfy it, for the "this is missing" message. */
  howToFix: string;
  matches: (field: FormField) => boolean;
}

/** Everything an order form must collect before it can be saved. */
export const FIELD_REQUIREMENTS: FieldRequirement[] = [
  {
    key: "firstName",
    label: "first name",
    purpose: "you know who placed the order",
    howToFix: 'Add a Text field named "first_name".',
    matches: named("first_name"),
  },
  {
    key: "lastName",
    label: "last name",
    purpose: "you know who placed the order",
    howToFix: 'Add a Text field named "last_name".',
    matches: named("last_name"),
  },
  {
    key: "whatsapp",
    label: "WhatsApp number",
    purpose: "you can confirm the order on WhatsApp",
    howToFix: 'Add a Phone field named "whatsapp_number".',
    matches: named("whatsapp_number", "whatsapp"),
  },
  {
    key: "phone",
    label: "phone number",
    purpose: "your delivery team can reach the customer",
    howToFix: 'Add a Phone field named "phone".',
    matches: named("phone", "customer_phone", "phone_number"),
  },
  {
    key: "state",
    label: "state",
    purpose: "deliveries can be routed and priced",
    howToFix: 'Add a State field named "state".',
    matches: named(...REQUIRED_FIELD_NAMES.state),
  },
  {
    key: "address",
    label: "delivery address",
    purpose: "the order can be delivered",
    howToFix: 'Add a Long text field named "address".',
    matches: named(...REQUIRED_FIELD_NAMES.address),
  },
  {
    key: "package",
    label: "package choice",
    purpose: "customers can choose what they're buying",
    howToFix: "Add a Package picker field, and give it at least one option.",
    matches: (field) => field.type === "radio-group" || named(...REQUIRED_FIELD_NAMES.packageName)(field),
  },
];

/** Sentence-case a requirement label for use at the start of a line. */
function titleCase(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "a", "a and b", "a, b and c" */
function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Fields in `allFields` that satisfy `requirement`. */
function satisfiers(requirement: FieldRequirement, allFields: FormField[]): FormField[] {
  return allFields.filter((field) => requirement.matches(field));
}

/**
 * The requirements `field` is currently the *only* field satisfying. Empty
 * means the field is safe to delete. Non-empty drives both the lock and the
 * explanation shown when someone tries.
 */
export function getFieldLockReasons(field: FormField, allFields: FormField[]): FieldRequirement[] {
  return FIELD_REQUIREMENTS.filter((requirement) => {
    if (!requirement.matches(field)) return false;
    const matching = satisfiers(requirement, allFields);
    return matching.length === 1 && matching[0].id === field.id;
  });
}

/**
 * True when deleting this field would leave the form unable to take orders.
 * `allFields` is required: lockedness is a property of the field's role in the
 * whole schema, not of the field alone.
 */
export function isRequiredField(field: FormField, allFields: FormField[]): boolean {
  return getFieldLockReasons(field, allFields).length > 0;
}

/** A sentence explaining why this field can't be deleted, or null if it can. */
export function describeFieldLock(field: FormField, allFields: FormField[]): string | null {
  const reasons = getFieldLockReasons(field, allFields);
  if (reasons.length === 0) return null;

  const label = field.label.trim() || field.name;
  const collects = joinWithAnd(reasons.map((r) => r.label));
  const purpose = joinWithAnd(reasons.map((r) => r.purpose));

  return (
    `"${label}" is the only field that collects the ${collects}. ` +
    `Every order form needs it so ${purpose}. ` +
    `You can move it or change its label — to remove it, add another field that collects the same thing first.`
  );
}

export interface DuplicateFieldName {
  name: string;
  /** Labels of the fields sharing the name, in schema order. */
  labels: string[];
}

/**
 * Fields sharing a submission key. Comparison is case-insensitive and
 * trimmed, matching how the API and the embed read field names.
 */
export function findDuplicateFieldNames(fields: FormField[]): DuplicateFieldName[] {
  const byName = new Map<string, FormField[]>();
  for (const field of fields) {
    const key = fieldName(field);
    if (!key) continue; // empty names are a separate problem
    const existing = byName.get(key);
    if (existing) existing.push(field);
    else byName.set(key, [field]);
  }

  const duplicates: DuplicateFieldName[] = [];
  for (const [name, group] of byName) {
    if (group.length > 1) {
      duplicates.push({ name, labels: group.map((f) => f.label.trim() || f.name) });
    }
  }
  return duplicates;
}

export interface FormSchemaValidation {
  isValid: boolean;
  /** Human-readable description of each unmet requirement. */
  missingFields: string[];
  /** The unmet requirements themselves, for targeted UI. */
  missingRequirements: FieldRequirement[];
  duplicateNames: DuplicateFieldName[];
  warnings: string[];
}

/**
 * Check a schema can be saved: every requirement met, no two fields sharing
 * a submission key.
 */
export function validateFormSchema(schema: FormSchema): FormSchemaValidation {
  const fields = schema.fields ?? [];

  const missingRequirements = FIELD_REQUIREMENTS.filter(
    (requirement) => satisfiers(requirement, fields).length === 0,
  );

  const missingFields = missingRequirements.map((r) => `${titleCase(r.label)} — ${r.howToFix}`);
  const duplicateNames = findDuplicateFieldNames(fields);

  return {
    isValid: missingRequirements.length === 0 && duplicateNames.length === 0,
    missingFields,
    missingRequirements,
    duplicateNames,
    warnings: [],
  };
}

/**
 * Get suggested field names for a given constant type
 */
export function getSuggestedFieldNames(
  constantType: "customerName" | "phoneNumber" | "packageName",
): string[] {
  return [...REQUIRED_FIELD_NAMES[constantType]];
}

/**
 * Check if a field name matches any of the required field name patterns
 */
export function isRequiredFieldName(fieldNameInput: string): {
  type: "customerName" | "phoneNumber" | "packageName" | null;
  matches: string[];
} {
  const lowerName = fieldNameInput.toLowerCase();
  const matches: string[] = [];
  let type: "customerName" | "phoneNumber" | "packageName" | null = null;

  if (REQUIRED_FIELD_NAMES.customerName.includes(lowerName)) {
    type = "customerName";
    matches.push(...REQUIRED_FIELD_NAMES.customerName);
  }

  if (REQUIRED_FIELD_NAMES.phoneNumber.includes(lowerName)) {
    if (!type) type = "phoneNumber";
    matches.push(...REQUIRED_FIELD_NAMES.phoneNumber);
  }

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
      `Form "${formName}" is missing required fields:\n${validation.missingFields
        .map((f) => `- ${f}`)
        .join("\n")}`,
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
    const lowerName = fieldName(field);

    if (!suggestions.customerName) {
      if (REQUIRED_FIELD_NAMES.customerName.includes(lowerName)) {
        suggestions.customerName = field;
      } else if (lowerName === "first_name" || lowerName === "last_name") {
        suggestions.customerName = field;
      }
    }

    if (!suggestions.phoneNumber && REQUIRED_FIELD_NAMES.phoneNumber.includes(lowerName)) {
      suggestions.phoneNumber = field;
    }

    if (!suggestions.packageName) {
      if (REQUIRED_FIELD_NAMES.packageName.includes(lowerName)) {
        suggestions.packageName = field;
      } else if (field.type === "radio-group") {
        suggestions.packageName = { type: "radio-group", field };
      }
    }
  }

  return suggestions;
}

/** The system fields seeded into every brand-new form, in display order. */
export function getDefaultRequiredFields(): FormField[] {
  return [
    {
      id: createId("field"),
      type: "text",
      label: "First Name",
      name: "first_name",
      required: true,
      placeholder: "Enter your first name",
    },
    {
      id: createId("field"),
      type: "text",
      label: "Last Name",
      name: "last_name",
      required: true,
      placeholder: "Enter your last name",
    },
    {
      id: createId("field"),
      type: "phone",
      label: "WhatsApp Number",
      name: "whatsapp_number",
      required: true,
      placeholder: "+2348012345678",
    },
    {
      id: createId("field"),
      type: "phone",
      label: "Phone Number",
      name: "phone",
      required: true,
      placeholder: "+2348012345678",
    },
    {
      id: createId("field"),
      type: "state",
      label: "State",
      name: "state",
      required: true,
      placeholder: "Select a state",
    },
    {
      id: createId("field"),
      type: "textarea",
      label: "Address",
      name: "address",
      required: true,
      placeholder: "Enter your full delivery address",
    },
    {
      id: createId("field"),
      type: "radio-group",
      label: "Select Package",
      name: "package_selection",
      required: true,
      radioOptions: [],
    },
  ];
}

/** The field a given requirement seeds when it's missing from an old form. */
function buildRequiredField(key: RequirementKey): FormField | null {
  const defaults = getDefaultRequiredFields();
  const byKey: Record<RequirementKey, string> = {
    firstName: "first_name",
    lastName: "last_name",
    whatsapp: "whatsapp_number",
    phone: "phone",
    state: "state",
    address: "address",
    package: "package_selection",
  };
  return defaults.find((f) => f.name === byKey[key]) ?? null;
}

/**
 * Add any missing system fields to an existing form.
 *
 * Only ever *adds* - existing fields keep their name, label, type and order,
 * because live submissions, conditional logic and the Elementor mapping are
 * all keyed on them.
 */
export function ensureRequiredFields(schema: FormSchema): FormSchema {
  const fields = schema.fields ?? [];
  const added: FormField[] = [];

  for (const requirement of FIELD_REQUIREMENTS) {
    if (satisfiers(requirement, [...fields, ...added]).length > 0) continue;
    const field = buildRequiredField(requirement.key);
    if (field) added.push(field);
  }

  if (added.length === 0) return schema;
  return { ...schema, fields: [...added, ...fields] };
}
