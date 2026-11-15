import { FormField } from "../../../types/form";

/**
 * What each field type is called in the UI.
 *
 * Merchants are small business owners setting up an order form, not people who
 * know what a "radio group" or a "textarea" is - so the builder never shows the
 * internal type name anywhere a person can read it.
 */
export const FIELD_TYPE_LABELS: Record<FormField["type"], string> = {
  text: "Text",
  email: "Email",
  phone: "Phone",
  number: "Number",
  textarea: "Long text",
  select: "Dropdown",
  state: "State",
  "radio-group": "Package picker",
  "order-bump": "Order bump",
};

/** One-line description of what each type is for, for pickers and tooltips. */
export const FIELD_TYPE_HINTS: Record<FormField["type"], string> = {
  text: "Short answer",
  email: "Email address",
  phone: "Phone or WhatsApp",
  number: "Digits only",
  textarea: "Notes, address",
  select: "Pick one from a list",
  state: "Nigerian states",
  "radio-group": "The packages they choose from",
  "order-bump": "Optional add-on at checkout",
};

export function fieldTypeLabel(type: FormField["type"]): string {
  return FIELD_TYPE_LABELS[type] ?? type;
}
