// One-off backfill: every NumbaTrak order-intake form must have a required
// "state" field (see apps/numbatrak/numbatrak/src/utils/formValidation.ts's
// getDefaultRequiredFields/ensureRequiredFields, which already enforce this
// for any form created or resaved through the builder going forward). Forms
// saved before that validation existed can still be missing the field, or
// have it present but not required - this script finds and fixes those.
//
// Defaults to a dry run (prints what would change, writes nothing). Pass
// --apply to actually update the DB.
//
// Run: pnpm --filter @platform/api backfill-form-state --dry-run
//      pnpm --filter @platform/api backfill-form-state --apply
import { eq } from "drizzle-orm";
import { getDb, numbatrakForms } from "@platform/db";

interface FormFieldLike {
  id: string;
  type: string;
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  [key: string]: unknown;
}

interface FormSchemaLike {
  fields?: FormFieldLike[];
  [key: string]: unknown;
}

// Mirrors REQUIRED_FIELD_NAMES.state in the numbatrak frontend's formValidation.ts.
const STATE_FIELD_NAMES = new Set(["state", "state_region", "region"]);

function findStateField(fields: FormFieldLike[]): FormFieldLike | undefined {
  return fields.find((f) => STATE_FIELD_NAMES.has((f.name || "").toLowerCase()));
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const db = getDb();
  const rows = await db.select().from(numbatrakForms);

  console.log(`Scanning ${rows.length} form(s)${apply ? " (APPLY MODE - will write changes)" : " (dry run - no changes will be written)"}...\n`);

  let missing = 0;
  let notRequired = 0;
  let unchanged = 0;

  for (const row of rows) {
    const schema = (row.schema ?? {}) as FormSchemaLike;
    const fields = Array.isArray(schema.fields) ? schema.fields : [];
    const existing = findStateField(fields);

    if (!existing) {
      missing++;
      console.log(`[ADD]      form "${row.name}" (${row.id}, org ${row.organizationId}) - no state field found`);
      if (apply) {
        const newField: FormFieldLike = {
          id: `field_state_backfill_${row.id}`,
          type: "state",
          label: "State",
          name: "state",
          required: true,
          placeholder: "Select a state",
        };
        const updatedSchema: FormSchemaLike = { ...schema, fields: [newField, ...fields] };
        await db.update(numbatrakForms).set({ schema: updatedSchema }).where(eq(numbatrakForms.id, row.id));
      }
    } else if (existing.required !== true) {
      notRequired++;
      console.log(`[REQUIRE]  form "${row.name}" (${row.id}, org ${row.organizationId}) - state field "${existing.name}" present but not required`);
      if (apply) {
        const updatedFields = fields.map((f) => (f === existing ? { ...f, required: true } : f));
        const updatedSchema: FormSchemaLike = { ...schema, fields: updatedFields };
        await db.update(numbatrakForms).set({ schema: updatedSchema }).where(eq(numbatrakForms.id, row.id));
      }
    } else {
      unchanged++;
    }
  }

  console.log(
    `\nDone. ${missing} missing state field, ${notRequired} had state but not required, ${unchanged} already compliant.`,
  );
  if (!apply && missing + notRequired > 0) {
    console.log("Dry run only - re-run with --apply to write these changes.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
