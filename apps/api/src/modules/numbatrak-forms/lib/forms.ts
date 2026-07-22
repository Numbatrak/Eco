import { and, desc, eq } from "drizzle-orm";
import { numbatrakForms, type Database } from "@platform/db";
import type { CreateNumbatrakFormRequest, NumbatrakForm, UpdateNumbatrakFormRequest } from "@platform/shared-types";

export type NumbatrakFormRow = typeof numbatrakForms.$inferSelect;

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

  const [row] = await db
    .update(numbatrakForms)
    .set(values)
    .where(and(eq(numbatrakForms.organizationId, organizationId), eq(numbatrakForms.id, formId)))
    .returning();
  return row ?? null;
}

export async function removeForm(db: Database, organizationId: string, formId: string): Promise<boolean> {
  const result = await db
    .delete(numbatrakForms)
    .where(and(eq(numbatrakForms.organizationId, organizationId), eq(numbatrakForms.id, formId)))
    .returning({ id: numbatrakForms.id });
  return result.length > 0;
}
