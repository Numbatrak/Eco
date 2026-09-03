// Verbatim TS port of supabase/functions/create-order-from-form/index.ts's
// validateSubmissionAgainstSchema/isFieldVisible/isValidNigerianPhone.

interface FormSchemaField {
  name: string;
  type?: string;
  required?: boolean;
  showWhen?: { fieldName: string; equals: string };
}

interface FormSchemaPayload {
  fields?: FormSchemaField[];
}

const NG_PHONE_REGEX = /^(?:\+?234|0)?(70[1-9]|80[2-9]|81[0-9]|90[1-9]|91[0-9])\d{7}$/;

function normalizePhoneInput(value: string): string {
  return value.replace(/[\s\-().]/g, "").trim();
}

function isValidNigerianPhone(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const normalized = normalizePhoneInput(value);
  return normalized.length > 0 && NG_PHONE_REGEX.test(normalized);
}

function isFieldVisible(field: FormSchemaField, fieldValues: Record<string, unknown>): boolean {
  if (!field.showWhen?.fieldName) return true;
  const current = fieldValues[field.showWhen.fieldName];
  return String(current ?? "") === String(field.showWhen.equals ?? "");
}

// Reserved field name the public embed script renders as an off-screen,
// tabindex-excluded input real visitors never see or fill; bots that
// auto-fill every field on the page trip it. Not part of the form schema, so
// it never collides with a business-defined field name.
export const HONEYPOT_FIELD_NAME = "_numbatrak_hp";

/** True if the honeypot trap field arrived non-empty - i.e., a bot filled it. */
export function isHoneypotTriggered(fieldValues: Record<string, unknown>): boolean {
  const value = fieldValues[HONEYPOT_FIELD_NAME];
  return value != null && String(value).trim() !== "";
}

/** Returns an error message, or null if the submission is valid. */
export function validateSubmissionAgainstSchema(
  schema: Record<string, unknown> | null | undefined,
  fieldValues: Record<string, unknown>,
): string | null {
  const fields = (schema as FormSchemaPayload | null | undefined)?.fields;
  if (!fields?.length) return null;

  for (const field of fields) {
    if (!isFieldVisible(field, fieldValues)) continue;
    if (!field.required) continue;

    const value = fieldValues[field.name];
    const isEmpty = value == null || (typeof value === "string" && value.trim() === "") || (field.type === "radio-group" && !value);

    if (isEmpty) {
      return `Missing required field: ${field.name}`;
    }

    if (field.type === "phone") {
      if (!isValidNigerianPhone(String(value))) {
        return `Invalid phone number for field: ${field.name}`;
      }
    }
  }

  // Catch-all phone check across canonical field names, independent of
  // whether the schema itself declares a "phone"-typed field for them.
  const phoneKeys = ["phone", "whatsapp_number", "whatsapp", "customer_phone", "phone_number"];
  for (const key of phoneKeys) {
    const val = fieldValues[key];
    if (val != null && String(val).trim() !== "" && !isValidNigerianPhone(String(val))) {
      return `Invalid phone number: ${key}`;
    }
  }

  return null;
}
