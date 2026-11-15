/**
 * Identifier and name generation for the form builder.
 *
 * `name` is the key a submission arrives under, so two fields sharing one
 * silently merge their answers and break conditional logic, the Elementor
 * mapping and the embed's DOM. The old generator derived names from
 * `fields.length + 1`, which collides as soon as anything is deleted:
 * add field_8, add field_9, delete field_8, add -> field_9 again.
 *
 * Everything here is pure so it can be tested without rendering the builder.
 */

import { FormField, RadioOption } from "../types/form";

/** Stable, collision-free id. Date.now() repeats inside a single tick. */
export function createId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : // Fallback for older Safari and non-secure contexts, where
        // randomUUID is absent. getRandomValues has much wider support.
        Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
  return `${prefix}_${uuid}`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Lowest `n >= start` for which every candidate built from it is unused.
 * Scanning up from the current count rather than from 1 means a name freed
 * by a deletion isn't handed to a different field later - an integration
 * mapped to the old one would silently pick up the new field's answers.
 */
export function nextFreeNumber(
  taken: Set<string>,
  candidates: (n: number) => string[],
  start: number,
): number {
  let n = Math.max(1, start);
  while (candidates(n).some((candidate) => taken.has(normalize(candidate)))) {
    n += 1;
  }
  return n;
}

function takenFieldStrings(fields: FormField[]): Set<string> {
  const taken = new Set<string>();
  for (const field of fields) {
    taken.add(normalize(field.name));
    taken.add(normalize(field.label));
  }
  return taken;
}

export interface GeneratedFieldNaming {
  name: string;
  label: string;
}

/**
 * A `name`/`label` pair that collides with nothing already in the schema.
 * Both share a number so the two read as the same field.
 */
export function generateFieldNaming(
  fields: FormField[],
  typeLabel: string,
): GeneratedFieldNaming {
  const taken = takenFieldStrings(fields);
  const n = nextFreeNumber(
    taken,
    (i) => [`field_${i}`, `${typeLabel} ${i}`],
    fields.length + 1,
  );
  return { name: `field_${n}`, label: `${typeLabel} ${n}` };
}

/** A `name` for a copy of `source` that collides with nothing in the schema. */
export function generateCopyNaming(
  fields: FormField[],
  source: FormField,
): GeneratedFieldNaming {
  const taken = takenFieldStrings(fields);
  const n = nextFreeNumber(
    taken,
    (i) => [`${source.name}_copy_${i}`, `${source.label} (copy ${i})`],
    1,
  );
  return {
    name: `${source.name}_copy_${n}`,
    label: `${source.label} (copy ${n})`,
  };
}

/**
 * An answer value + title for a new choice in a package picker. The value is
 * what a submission carries, so it has to be unique within the field.
 */
export function generateOptionNaming(options: Pick<RadioOption, "value" | "title">[]): {
  value: string;
  title: string;
} {
  const taken = new Set<string>();
  for (const option of options) {
    taken.add(normalize(option.value));
    taken.add(normalize(option.title));
  }
  const n = nextFreeNumber(
    taken,
    (i) => [`option_${i}`, `Option ${i}`],
    options.length + 1,
  );
  return { value: `option_${n}`, title: `Option ${n}` };
}

/** Same idea for the simple label/value pairs behind a dropdown field. */
export function generateSelectOptionNaming(
  options: { value: string; label: string }[],
): { value: string; label: string } {
  const taken = new Set<string>();
  for (const option of options) {
    taken.add(normalize(option.value));
    taken.add(normalize(option.label));
  }
  const n = nextFreeNumber(
    taken,
    (i) => [`option_${i}`, `Option ${i}`],
    options.length + 1,
  );
  return { value: `option_${n}`, label: `Option ${n}` };
}
