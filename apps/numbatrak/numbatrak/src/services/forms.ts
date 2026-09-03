"use client";

import { apiRequest } from "../lib/apiClient";
import { Form, FormSchema, FieldMapping } from "../types/form";
import { emptyWithoutOrg } from "./orgQuery";

const EMPTY_FIELD_MAPPING: FieldMapping = { contactFields: {}, valueToOptionId: {} };

interface FormDto {
  id: string;
  name: string;
  formToken: string;
  schema: Record<string, unknown>;
  active: boolean;
  siteUrl: string | null;
  subBrand: string | null;
  funnelName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  fieldMapping: FieldMapping;
  hasWebhookSecret: boolean;
}

function dtoToForm(dto: FormDto, organizationId: string | null): Form {
  return {
    id: dto.id,
    organization_id: organizationId ?? "",
    name: dto.name,
    form_token: dto.formToken,
    schema: (dto.schema ?? { fields: [], submitButton: { text: "Submit Order" } }) as unknown as FormSchema,
    active: dto.active,
    sub_brand: dto.subBrand,
    funnel_name: dto.funnelName,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
    field_mapping: dto.fieldMapping ?? EMPTY_FIELD_MAPPING,
    has_webhook_secret: dto.hasWebhookSecret ?? false,
  };
}

/**
 * Read all forms from the database (filtered by organization)
 */
export async function fetchForms(organizationId: string | null): Promise<Form[]> {
  const empty = emptyWithoutOrg<Form>(organizationId);
  if (empty) return empty;

  const { forms } = await apiRequest<{ forms: FormDto[] }>("/org/numbatrak/forms");
  return forms.map((dto) => dtoToForm(dto, organizationId));
}

/**
 * Fetch a single form by ID. No dedicated single-form route on the backend
 * (forms per org is a small list) - filtered client-side from the list.
 */
export async function fetchFormById(formId: string): Promise<Form | null> {
  const { forms } = await apiRequest<{ forms: FormDto[] }>("/org/numbatrak/forms");
  const dto = forms.find((f) => f.id === formId);
  if (!dto) return null;
  // organization_id isn't returned by the DTO (server already scopes by
  // active org) - callers of this function never read that field back off
  // the result, matching the pre-port behavior where it was only echoed
  // for uniformity, not relied upon.
  return dtoToForm(dto, "");
}

/**
 * Create a new form
 */
export async function createForm(input: {
  name: string;
  organization_id: string;
  form_token: string;
  schema: FormSchema;
  active?: boolean;
  sub_brand?: string | null;
  funnel_name?: string | null;
}): Promise<Form> {
  const dto = await apiRequest<FormDto>("/org/numbatrak/forms", {
    method: "POST",
    body: {
      name: input.name,
      formToken: input.form_token,
      schema: input.schema,
      active: input.active ?? true,
      subBrand: input.sub_brand ?? null,
      funnelName: input.funnel_name ?? null,
    },
  });

  return dtoToForm(dto, input.organization_id);
}

/**
 * Update an existing form
 */
export async function updateForm(
  formId: string,
  input: {
    name?: string;
    form_token?: string;
    schema?: FormSchema;
    active?: boolean;
    sub_brand?: string | null;
    funnel_name?: string | null;
  }
): Promise<Form> {
  const dto = await apiRequest<FormDto>(`/org/numbatrak/forms/${formId}`, {
    method: "PATCH",
    body: {
      name: input.name,
      formToken: input.form_token,
      schema: input.schema,
      active: input.active,
      subBrand: input.sub_brand,
      funnelName: input.funnel_name,
    },
  });

  return dtoToForm(dto, "");
}

/**
 * Delete a form from the database
 */
export async function removeForm(formId: string): Promise<void> {
  await apiRequest<void>(`/org/numbatrak/forms/${formId}`, { method: "DELETE" });
}

/**
 * Save the Elementor webhook field mapping for a form.
 */
export async function updateFormFieldMapping(formId: string, fieldMapping: FieldMapping): Promise<Form> {
  const dto = await apiRequest<FormDto>(`/org/numbatrak/forms/${formId}`, {
    method: "PATCH",
    body: { fieldMapping },
  });
  return dtoToForm(dto, "");
}

/**
 * Generate (or replace) this form's Elementor webhook secret. The plaintext
 * value is returned once by this call and never re-exposed by any GET.
 */
export async function rotateFormWebhookSecret(formId: string): Promise<string> {
  const { secret } = await apiRequest<{ secret: string }>(`/org/numbatrak/forms/${formId}/webhook-secret/rotate`, {
    method: "POST",
  });
  return secret;
}

/**
 * Generate a unique form token. This token is the sole bearer credential
 * gating the public, unauthenticated /public/numbatrak/forms/:token
 * endpoints (see apps/api/src/modules/numbatrak-forms/routes/public.ts) -
 * Math.random() isn't cryptographically secure and was too easy to
 * brute-force for something with that much riding on it, so this uses the
 * Web Crypto API instead (16 random bytes = 128 bits of entropy).
 */
export function generateFormToken(): string {
  const prefix = "form_live_";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const randomPart = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}${randomPart}`;
}
