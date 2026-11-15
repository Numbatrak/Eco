import { describe, it, expect } from "vitest";
import {
  createId,
  nextFreeNumber,
  generateFieldNaming,
  generateCopyNaming,
  generateOptionNaming,
  generateSelectOptionNaming,
} from "./formSchemaUtils";
import { FormField } from "../types/form";

function field(partial: Partial<FormField> & Pick<FormField, "name">): FormField {
  return {
    id: `id_${partial.name}`,
    type: "text",
    label: partial.name,
    required: false,
    ...partial,
  } as FormField;
}

describe("createId", () => {
  it("prefixes and never repeats within a tick", () => {
    const ids = new Set(Array.from({ length: 500 }, () => createId("field")));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id.startsWith("field_")).toBe(true);
  });
});

describe("nextFreeNumber", () => {
  it("returns the start when nothing collides", () => {
    expect(nextFreeNumber(new Set(), (n) => [`field_${n}`], 3)).toBe(3);
  });

  it("skips numbers whose candidates are taken", () => {
    const taken = new Set(["field_3", "field_4"]);
    expect(nextFreeNumber(taken, (n) => [`field_${n}`], 3)).toBe(5);
  });

  it("skips when any one of several candidates collides", () => {
    const taken = new Set(["text field 3"]);
    expect(nextFreeNumber(taken, (n) => [`field_${n}`, `Text Field ${n}`.toLowerCase()], 3)).toBe(4);
  });

  it("never returns below 1", () => {
    expect(nextFreeNumber(new Set(), (n) => [`field_${n}`], -5)).toBe(1);
  });
});

describe("generateFieldNaming", () => {
  it("numbers from the current field count", () => {
    const fields = [field({ name: "first_name" }), field({ name: "last_name" })];
    expect(generateFieldNaming(fields, "Text Field")).toEqual({
      name: "field_3",
      label: "Text Field 3",
    });
  });

  it("does not reuse a name freed by a deletion", () => {
    // The old generator produced field_3 here and collided: add 3, add 4,
    // delete 3 leaves [a, b, field_4] - length+1 is 4, which is taken.
    const fields = [
      field({ name: "first_name" }),
      field({ name: "last_name" }),
      field({ name: "field_4", label: "Text Field 4" }),
    ];
    const naming = generateFieldNaming(fields, "Text Field");
    expect(naming.name).toBe("field_5");
    expect(naming.label).toBe("Text Field 5");
  });

  it("avoids a collision with an existing label even when the name is free", () => {
    const fields = [field({ name: "custom_name", label: "Text Field 2" })];
    expect(generateFieldNaming(fields, "Text Field").label).toBe("Text Field 3");
  });

  it("compares case-insensitively and ignores surrounding space", () => {
    const fields = [field({ name: "  FIELD_2 ", label: "whatever" })];
    expect(generateFieldNaming(fields, "Text Field").name).toBe("field_3");
  });

  it("produces a unique name on every call when fields are appended", () => {
    let fields: FormField[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const naming = generateFieldNaming(fields, "Text Field");
      expect(seen.has(naming.name)).toBe(false);
      seen.add(naming.name);
      fields = [...fields, field({ name: naming.name, label: naming.label })];
    }
  });

  it("stays unique across interleaved adds and deletes", () => {
    let fields: FormField[] = [];
    const everUsed = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const naming = generateFieldNaming(fields, "Text Field");
      everUsed.add(naming.name);
      fields = [...fields, field({ id: `id${i}`, name: naming.name, label: naming.label })];
      // Drop something from the middle every third round.
      if (i % 3 === 2 && fields.length > 1) {
        fields = fields.filter((_, idx) => idx !== Math.floor(fields.length / 2));
      }
      const names = fields.map((f) => f.name.toLowerCase());
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe("generateCopyNaming", () => {
  it("numbers copies independently of the field count", () => {
    const source = field({ name: "notes", label: "Notes" });
    expect(generateCopyNaming([source], source)).toEqual({
      name: "notes_copy_1",
      label: "Notes (copy 1)",
    });
  });

  it("skips to the next free number when a copy already exists", () => {
    const source = field({ name: "notes", label: "Notes" });
    const existing = field({ name: "notes_copy_1", label: "Notes (copy 1)" });
    expect(generateCopyNaming([source, existing], source).name).toBe("notes_copy_2");
  });
});

describe("generateOptionNaming", () => {
  it("numbers from the current option count", () => {
    expect(generateOptionNaming([{ value: "option_1", title: "Option 1" }])).toEqual({
      value: "option_2",
      title: "Option 2",
    });
  });

  it("does not reuse an answer value freed by a deletion", () => {
    const options = [
      { value: "starter", title: "Starter" },
      { value: "option_2", title: "Option 2" },
    ];
    expect(generateOptionNaming(options).value).toBe("option_3");
  });

  it("avoids colliding with a merchant-typed title", () => {
    const options = [{ value: "starter", title: "Option 2" }];
    expect(generateOptionNaming(options)).toEqual({ value: "option_3", title: "Option 3" });
  });
});

describe("generateSelectOptionNaming", () => {
  it("avoids existing values and labels", () => {
    const options = [{ value: "option_2", label: "Red" }];
    expect(generateSelectOptionNaming(options)).toEqual({ value: "option_3", label: "Option 3" });
  });
});
