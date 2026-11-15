import { describe, it, expect } from "vitest";
import {
  isRequiredField,
  getFieldLockReasons,
  describeFieldLock,
  findDuplicateFieldNames,
  validateFormSchema,
  getDefaultRequiredFields,
  ensureRequiredFields,
} from "./formValidation";
import { FormField, FormSchema } from "../types/form";

function field(partial: Partial<FormField> & Pick<FormField, "name">): FormField {
  return {
    id: `id_${partial.name}`,
    type: "text",
    label: partial.name,
    required: false,
    ...partial,
  } as FormField;
}

const complete = (): FormField[] => getDefaultRequiredFields();
const asSchema = (fields: FormField[]): FormSchema => ({
  fields,
  submitButton: { text: "Submit Order" },
});

describe("isRequiredField", () => {
  it("locks each sole satisfier of a requirement", () => {
    const fields = complete();
    for (const f of fields) {
      expect(isRequiredField(f, fields)).toBe(true);
    }
  });

  it("leaves an ordinary field unlocked", () => {
    const fields = [...complete(), field({ name: "notes", label: "Notes" })];
    const notes = fields[fields.length - 1];
    expect(isRequiredField(notes, fields)).toBe(false);
  });

  describe("extra package pickers", () => {
    it("unlocks both pickers while two exist", () => {
      const extra = field({ id: "extra", name: "upsell_picker", type: "radio-group", radioOptions: [] });
      const fields = [...complete(), extra];
      const original = fields.find((f) => f.name === "package_selection")!;

      expect(isRequiredField(extra, fields)).toBe(false);
      expect(isRequiredField(original, fields)).toBe(false);
    });

    it("re-locks the survivor once the extra is deleted", () => {
      const extra = field({ id: "extra", name: "upsell_picker", type: "radio-group", radioOptions: [] });
      const fields = [...complete(), extra];
      const remaining = fields.filter((f) => f.id !== "extra");
      const original = remaining.find((f) => f.name === "package_selection")!;

      expect(isRequiredField(original, remaining)).toBe(true);
    });

    it("never lets the last picker be deleted", () => {
      // Whatever order the user deletes in, one picker always stays locked.
      let fields = [
        ...complete(),
        field({ id: "x1", name: "picker_b", type: "radio-group", radioOptions: [] }),
        field({ id: "x2", name: "picker_c", type: "radio-group", radioOptions: [] }),
      ];
      for (const id of ["x1", "x2"]) {
        const target = fields.find((f) => f.id === id)!;
        expect(isRequiredField(target, fields)).toBe(false);
        fields = fields.filter((f) => f.id !== id);
      }
      const last = fields.find((f) => f.type === "radio-group")!;
      expect(isRequiredField(last, fields)).toBe(true);
    });
  });

  describe("alias fields", () => {
    it('does not lock "region" while a "state" field is present', () => {
      const region = field({ id: "region", name: "region", label: "Region" });
      const fields = [...complete(), region];
      expect(isRequiredField(region, fields)).toBe(false);
    });

    it('locks "region" when it is the only field satisfying state', () => {
      const region = field({ id: "region", name: "region", label: "Region" });
      const fields = [...complete().filter((f) => f.name !== "state"), region];
      expect(isRequiredField(region, fields)).toBe(true);
    });

    it("treats whatsapp and whatsapp_number as the same requirement", () => {
      const alt = field({ id: "alt", name: "whatsapp", type: "phone" });
      const fields = [...complete(), alt];
      const canonical = fields.find((f) => f.name === "whatsapp_number")!;
      expect(isRequiredField(alt, fields)).toBe(false);
      expect(isRequiredField(canonical, fields)).toBe(false);
    });
  });

  it("matches case-insensitively and ignores surrounding space", () => {
    const fields = complete().map((f) =>
      f.name === "phone" ? { ...f, name: "  PHONE " } : f,
    );
    const phone = fields.find((f) => f.name.trim().toLowerCase() === "phone")!;
    expect(isRequiredField(phone, fields)).toBe(true);
  });
});

describe("getFieldLockReasons / describeFieldLock", () => {
  it("returns no reasons for a deletable field", () => {
    const fields = [...complete(), field({ name: "notes" })];
    expect(getFieldLockReasons(fields[fields.length - 1], fields)).toEqual([]);
    expect(describeFieldLock(fields[fields.length - 1], fields)).toBeNull();
  });

  it("names the field and the reason it is locked", () => {
    const fields = complete();
    const picker = fields.find((f) => f.name === "package_selection")!;
    const message = describeFieldLock(picker, fields)!;

    expect(message).toContain('"Select Package"');
    expect(message).toContain("package choice");
    expect(message).toContain("choose what they're buying");
    // Tells the user what they *can* do.
    expect(message).toMatch(/move it|change its label/);
  });

  it("reports both roles when one field satisfies two requirements", () => {
    // A package picker named "state" is the only field covering both the
    // state answer and the package choice.
    const dual = field({
      id: "dual",
      name: "state",
      label: "State & Package",
      type: "radio-group",
      radioOptions: [],
    });
    const fields = [
      ...complete().filter((f) => f.name !== "state" && f.name !== "package_selection"),
      dual,
    ];

    const reasons = getFieldLockReasons(dual, fields);
    expect(reasons.map((r) => r.key)).toEqual(["state", "package"]);

    const message = describeFieldLock(dual, fields)!;
    expect(message).toContain("state and package choice");
    expect(message).toContain("deliveries can be routed and priced");
    expect(message).toContain("choose what they're buying");
  });

  it("whatsapp_number alone does not satisfy the phone requirement", () => {
    // Matches the pre-existing rule: the catch-all phone check is a separate
    // field from the WhatsApp number.
    const fields = complete().filter((f) => f.name !== "phone");
    const whatsapp = fields.find((f) => f.name === "whatsapp_number")!;
    expect(getFieldLockReasons(whatsapp, fields).map((r) => r.key)).toEqual(["whatsapp"]);
    expect(validateFormSchema(asSchema(fields)).missingRequirements.map((r) => r.key)).toEqual([
      "phone",
    ]);
  });
});

describe("findDuplicateFieldNames", () => {
  it("finds nothing in a clean schema", () => {
    expect(findDuplicateFieldNames(complete())).toEqual([]);
  });

  it("reports a collision with the labels involved", () => {
    const fields = [
      ...complete(),
      field({ id: "a", name: "field_9", label: "Text Field 9" }),
      field({ id: "b", name: "field_9", label: "Number Field 9" }),
    ];
    expect(findDuplicateFieldNames(fields)).toEqual([
      { name: "field_9", labels: ["Text Field 9", "Number Field 9"] },
    ]);
  });

  it("treats differing case and padding as the same name", () => {
    const fields = [field({ id: "a", name: "Notes" }), field({ id: "b", name: " notes " })];
    expect(findDuplicateFieldNames(fields)).toHaveLength(1);
  });

  it("ignores empty names", () => {
    const fields = [field({ id: "a", name: "" }), field({ id: "b", name: "  " })];
    expect(findDuplicateFieldNames(fields)).toEqual([]);
  });

  it("falls back to the name when a label is blank", () => {
    const fields = [
      field({ id: "a", name: "dup", label: "" }),
      field({ id: "b", name: "dup", label: "" }),
    ];
    expect(findDuplicateFieldNames(fields)[0].labels).toEqual(["dup", "dup"]);
  });
});

describe("validateFormSchema", () => {
  it("accepts a complete form", () => {
    const result = validateFormSchema(asSchema(complete()));
    expect(result.isValid).toBe(true);
    expect(result.missingFields).toEqual([]);
    expect(result.duplicateNames).toEqual([]);
  });

  it("reports each missing requirement with a way to fix it", () => {
    const result = validateFormSchema(asSchema(complete().filter((f) => f.name !== "address")));
    expect(result.isValid).toBe(false);
    expect(result.missingRequirements.map((r) => r.key)).toEqual(["address"]);
    expect(result.missingFields[0]).toContain("Delivery address");
    expect(result.missingFields[0]).toContain('named "address"');
  });

  it("accepts a legacy form using alias names", () => {
    const legacy = [
      field({ name: "first_name" }),
      field({ name: "last_name" }),
      field({ name: "whatsapp", type: "phone" }),
      field({ name: "customer_phone", type: "phone" }),
      field({ name: "region" }),
      field({ name: "delivery_address", type: "textarea" }),
      field({ name: "package_name" }),
    ];
    expect(validateFormSchema(asSchema(legacy)).isValid).toBe(true);
  });

  it("blocks saving when two fields share a name", () => {
    const fields = [
      ...complete(),
      field({ id: "a", name: "field_9", label: "Text Field 9" }),
      field({ id: "b", name: "field_9", label: "Number Field 9" }),
    ];
    const result = validateFormSchema(asSchema(fields));
    expect(result.isValid).toBe(false);
    expect(result.duplicateNames).toHaveLength(1);
    // No requirement is missing - the duplicate alone blocks the save.
    expect(result.missingFields).toEqual([]);
  });

  it("handles a schema with no fields at all", () => {
    const result = validateFormSchema({ fields: [] });
    expect(result.isValid).toBe(false);
    expect(result.missingRequirements).toHaveLength(7);
  });
});

describe("ensureRequiredFields", () => {
  it("leaves a complete form untouched", () => {
    const schema = asSchema(complete());
    expect(ensureRequiredFields(schema)).toBe(schema);
  });

  it("adds only what is missing", () => {
    const schema = asSchema(complete().filter((f) => f.name !== "address"));
    const result = ensureRequiredFields(schema);
    expect(result.fields).toHaveLength(7);
    expect(result.fields.some((f) => f.name === "address")).toBe(true);
  });

  it("never renames, retypes or drops an existing field", () => {
    const legacy = [
      field({ id: "keep1", name: "region", label: "Your Region" }),
      field({ id: "keep2", name: "delivery_address", label: "Where to deliver", type: "textarea" }),
    ];
    const result = ensureRequiredFields(asSchema(legacy));

    for (const original of legacy) {
      const after = result.fields.find((f) => f.id === original.id);
      expect(after).toEqual(original);
    }
  });

  it("does not add a second package picker to a form that has one", () => {
    const withPicker = [field({ name: "my_packages", type: "radio-group", radioOptions: [] })];
    const result = ensureRequiredFields(asSchema(withPicker));
    expect(result.fields.filter((f) => f.type === "radio-group")).toHaveLength(1);
  });

  it("produces a schema that validates", () => {
    const result = ensureRequiredFields(asSchema([field({ name: "notes" })]));
    expect(validateFormSchema(result).isValid).toBe(true);
  });

  it("gives every added field a unique id", () => {
    const result = ensureRequiredFields({ fields: [] });
    const ids = result.fields.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getDefaultRequiredFields", () => {
  it("returns a schema that validates immediately", () => {
    expect(validateFormSchema(asSchema(getDefaultRequiredFields())).isValid).toBe(true);
  });

  it("gives distinct ids across separate calls", () => {
    const a = getDefaultRequiredFields().map((f) => f.id);
    const b = getDefaultRequiredFields().map((f) => f.id);
    expect(new Set([...a, ...b]).size).toBe(a.length + b.length);
  });
});
