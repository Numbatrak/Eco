import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { numbatrakForms, type Database } from "@platform/db";
import type {
  CreateNumbatrakFormRequest,
  NumbatrakForm,
  NumbatrakFormFieldMapping,
  UpdateNumbatrakFormRequest,
} from "@platform/shared-types";
import { encryptSecret, decryptSecret } from "../../../lib/encryption.js";
import { constantTimeEqual } from "../../payments/lib/constant-time.js";

export type NumbatrakFormRow = typeof numbatrakForms.$inferSelect;

const EMPTY_FIELD_MAPPING: NumbatrakFormFieldMapping = { contactFields: {}, valueToOptionId: {} };

function readFieldMapping(row: NumbatrakFormRow): NumbatrakFormFieldMapping {
  const raw = row.fieldMapping as Partial<NumbatrakFormFieldMapping> | null | undefined;
  if (!raw) return EMPTY_FIELD_MAPPING;
  return {
    contactFields: raw.contactFields ?? {},
    productField: raw.productField,
    valueToOptionId: raw.valueToOptionId ?? {},
  };
}

export function serializeForm(row: NumbatrakFormRow): NumbatrakForm {
  return {
    id: row.id,
    name: row.name,
    formToken: row.formToken,
    schema: row.schema as Record<string, unknown>,
    active: row.active,
    siteUrl: row.siteUrl,
    subBrand: row.subBrand,
    funnelName: row.funnelName,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    fieldMapping: readFieldMapping(row),
    hasWebhookSecret: Boolean(row.webhookSecretEncrypted),
  };
}

export async function listFormsForOrg(db: Database, organizationId: string): Promise<NumbatrakFormRow[]> {
  return db
    .select()
    .from(numbatrakForms)
    .where(eq(numbatrakForms.organizationId, organizationId))
    .orderBy(desc(numbatrakForms.createdAt));
}

export async function createForm(
  db: Database,
  organizationId: string,
  input: CreateNumbatrakFormRequest,
): Promise<NumbatrakFormRow> {
  const [row] = await db
    .insert(numbatrakForms)
    .values({
      organizationId,
      name: input.name,
      formToken: input.formToken,
      schema: input.schema,
      active: input.active ?? true,
      siteUrl: input.siteUrl ?? null,
      subBrand: input.subBrand ?? null,
      funnelName: input.funnelName ?? null,
    })
    .returning();
  if (!row) throw new Error("Failed to create form");
  return row;
}

export async function updateForm(
  db: Database,
  organizationId: string,
  formId: string,
  input: UpdateNumbatrakFormRequest,
): Promise<NumbatrakFormRow | null> {
  const values: Partial<typeof numbatrakForms.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) values.name = input.name;
  if (input.formToken !== undefined) values.formToken = input.formToken;
  if (input.schema !== undefined) values.schema = input.schema;
  if (input.active !== undefined) values.active = input.active;
  if (input.siteUrl !== undefined) values.siteUrl = input.siteUrl;
  if (input.subBrand !== undefined) values.subBrand = input.subBrand;
  if (input.funnelName !== undefined) values.funnelName = input.funnelName;
  if (input.fieldMapping !== undefined) values.fieldMapping = input.fieldMapping;

  const [row] = await db
    .update(numbatrakForms)
    .set(values)
    .where(and(eq(numbatrakForms.organizationId, organizationId), eq(numbatrakForms.id, formId)))
    .returning();
  return row ?? null;
}

/** Generates a new plaintext webhook secret, stores it encrypted, and returns the plaintext (shown once). */
export async function rotateFormWebhookSecret(
  db: Database,
  organizationId: string,
  formId: string,
): Promise<string | null> {
  const secret = randomBytes(24).toString("base64url");
  const [row] = await db
    .update(numbatrakForms)
    .set({ webhookSecretEncrypted: encryptSecret(secret), updatedAt: new Date() })
    .where(and(eq(numbatrakForms.organizationId, organizationId), eq(numbatrakForms.id, formId)))
    .returning({ id: numbatrakForms.id });
  return row ? secret : null;
}

/** True if `providedSecret` matches the form's configured webhook secret (false if none is configured). */
export function verifyFormWebhookSecret(form: NumbatrakFormRow, providedSecret: string | undefined): boolean {
  if (!form.webhookSecretEncrypted || !providedSecret) return false;
  return constantTimeEqual(decryptSecret(form.webhookSecretEncrypted), providedSecret);
}

export async function removeForm(db: Database, organizationId: string, formId: string): Promise<boolean> {
  const result = await db
    .delete(numbatrakForms)
    .where(and(eq(numbatrakForms.organizationId, organizationId), eq(numbatrakForms.id, formId)))
    .returning({ id: numbatrakForms.id });
  return result.length > 0;
}
