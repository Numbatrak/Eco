import { describe, it, expect } from "vitest";
import {
  COALESCE_WINDOW_MS,
  HISTORY_LIMIT,
  HistoryState,
  historyReducer,
  initHistory,
} from "./schemaHistory";
import { FormSchema, FormField } from "../../../types/form";

function schema(...labels: string[]): FormSchema {
  return {
    fields: labels.map(
      (label, i) =>
        ({
          id: `f${i}`,
          type: "text",
          label,
          name: `field_${i}`,
          required: false,
        }) as FormField,
    ),
    submitButton: { text: "Submit Order" },
  };
}

const labelsOf = (s: FormSchema) => s.fields.map((f) => f.label);

/** Apply a list of actions to a starting state. */
function run(start: HistoryState, actions: Parameters<typeof historyReducer>[1][]): HistoryState {
  return actions.reduce(historyReducer, start);
}

describe("historyReducer", () => {
  it("starts with nothing to undo or redo", () => {
    const state = initHistory(schema("a"));
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
  });

  it("records a commit and undoes it", () => {
    const start = initHistory(schema("a"));
    const after = historyReducer(start, { type: "commit", next: schema("a", "b"), at: 0 });
    expect(labelsOf(after.present)).toEqual(["a", "b"]);

    const undone = historyReducer(after, { type: "undo" });
    expect(labelsOf(undone.present)).toEqual(["a"]);
    expect(undone.future).toHaveLength(1);
  });

  it("redoes what was undone", () => {
    const state = run(initHistory(schema("a")), [
      { type: "commit", next: schema("a", "b"), at: 0 },
      { type: "undo" },
      { type: "redo" },
    ]);
    expect(labelsOf(state.present)).toEqual(["a", "b"]);
    expect(state.future).toHaveLength(0);
  });

  it("is a no-op when there is nothing to undo or redo", () => {
    const start = initHistory(schema("a"));
    expect(historyReducer(start, { type: "undo" })).toBe(start);
    expect(historyReducer(start, { type: "redo" })).toBe(start);
  });

  it("drops the redo branch once a new edit is committed", () => {
    const state = run(initHistory(schema("a")), [
      { type: "commit", next: schema("a", "b"), at: 0 },
      { type: "undo" },
      { type: "commit", next: schema("a", "c"), at: 10 },
    ]);
    expect(state.future).toHaveLength(0);
    expect(labelsOf(state.present)).toEqual(["a", "c"]);
  });

  describe("coalescing", () => {
    it("collapses rapid edits sharing a key into one step", () => {
      const state = run(initHistory(schema("a")), [
        { type: "commit", next: schema("ab"), coalesceKey: "field:f0:label", at: 0 },
        { type: "commit", next: schema("abc"), coalesceKey: "field:f0:label", at: 100 },
        { type: "commit", next: schema("abcd"), coalesceKey: "field:f0:label", at: 200 },
      ]);
      expect(state.past).toHaveLength(1);

      // One undo goes all the way back to before the first keystroke.
      const undone = historyReducer(state, { type: "undo" });
      expect(labelsOf(undone.present)).toEqual(["a"]);
    });

    it("starts a new step once the window lapses", () => {
      const state = run(initHistory(schema("a")), [
        { type: "commit", next: schema("ab"), coalesceKey: "k", at: 0 },
        { type: "commit", next: schema("abc"), coalesceKey: "k", at: COALESCE_WINDOW_MS + 1 },
      ]);
      expect(state.past).toHaveLength(2);
    });

    it("coalesces exactly at the window boundary", () => {
      const state = run(initHistory(schema("a")), [
        { type: "commit", next: schema("ab"), coalesceKey: "k", at: 0 },
        { type: "commit", next: schema("abc"), coalesceKey: "k", at: COALESCE_WINDOW_MS },
      ]);
      expect(state.past).toHaveLength(1);
    });

    it("does not coalesce edits to different things", () => {
      const state = run(initHistory(schema("a")), [
        { type: "commit", next: schema("ab"), coalesceKey: "field:f0:label", at: 0 },
        { type: "commit", next: schema("ab", "x"), coalesceKey: "field:f1:label", at: 50 },
      ]);
      expect(state.past).toHaveLength(2);
    });

    it("does not coalesce different properties of the same field", () => {
      const state = run(initHistory(schema("a")), [
        { type: "commit", next: schema("ab"), coalesceKey: "field:f0:label", at: 0 },
        { type: "commit", next: schema("ab"), coalesceKey: "field:f0:placeholder", at: 50 },
      ]);
      expect(state.past).toHaveLength(2);
    });

    it("never coalesces a structural edit, even back to back", () => {
      const state = run(initHistory(schema("a")), [
        { type: "commit", next: schema("a", "b"), at: 0 },
        { type: "commit", next: schema("a", "b", "c"), at: 1 },
      ]);
      expect(state.past).toHaveLength(2);
    });

    it("breaks the run when a structural edit lands between keystrokes", () => {
      const state = run(initHistory(schema("a")), [
        { type: "commit", next: schema("ab"), coalesceKey: "k", at: 0 },
        { type: "commit", next: schema("ab", "new"), at: 10 },
        { type: "commit", next: schema("abc", "new"), coalesceKey: "k", at: 20 },
      ]);
      expect(state.past).toHaveLength(3);
    });

    it("starts a fresh run after an undo", () => {
      const state = run(initHistory(schema("a")), [
        { type: "commit", next: schema("ab"), coalesceKey: "k", at: 0 },
        { type: "undo" },
        { type: "commit", next: schema("az"), coalesceKey: "k", at: 10 },
      ]);
      expect(state.past).toHaveLength(1);
      expect(labelsOf(historyReducer(state, { type: "undo" }).present)).toEqual(["a"]);
    });
  });

  describe("replace (edits the app makes on the user's behalf)", () => {
    it("changes the schema without adding an undo step", () => {
      const state = run(initHistory(schema("a")), [
        { type: "commit", next: schema("a", "b"), at: 0 },
        { type: "replace", next: schema("a", "b-cleaned") },
      ]);
      expect(state.past).toHaveLength(1);
      expect(labelsOf(state.present)).toEqual(["a", "b-cleaned"]);
    });

    it("still undoes back past it to the last user edit", () => {
      const state = run(initHistory(schema("a")), [
        { type: "commit", next: schema("a", "b"), at: 0 },
        { type: "replace", next: schema("a", "b-cleaned") },
        { type: "undo" },
      ]);
      expect(labelsOf(state.present)).toEqual(["a"]);
    });

    it("clears the redo branch so timelines can't splice", () => {
      const state = run(initHistory(schema("a")), [
        { type: "commit", next: schema("a", "b"), at: 0 },
        { type: "undo" },
        { type: "replace", next: schema("cleaned") },
      ]);
      expect(state.future).toHaveLength(0);
    });
  });

  it("reset clears history", () => {
    const state = run(initHistory(schema("a")), [
      { type: "commit", next: schema("a", "b"), at: 0 },
      { type: "reset", next: schema("loaded") },
    ]);
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
    expect(labelsOf(state.present)).toEqual(["loaded"]);
  });

  it("caps history at HISTORY_LIMIT, dropping the oldest", () => {
    let state = initHistory(schema("s0"));
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) {
      state = historyReducer(state, { type: "commit", next: schema(`s${i}`), at: i * 10_000 });
    }
    expect(state.past).toHaveLength(HISTORY_LIMIT);
    expect(labelsOf(state.past[0])).toEqual([`s${20}`]);
  });

  /** The regression the audit called out. */
  it("restores property edits made before an unrelated structural edit", () => {
    const withOption = schema("a", "b");
    withOption.fields[0] = {
      ...withOption.fields[0],
      type: "radio-group",
      radioOptions: [
        { id: "o1", title: "Starter", value: "starter", price: 5000, products: [{ product_id: "p1", quantity: 2 }] },
      ],
    } as FormField;

    const moved: FormSchema = { ...withOption, fields: [withOption.fields[1], withOption.fields[0]] };

    const state = run(initHistory(schema("a", "b")), [
      // Property edits: price, then attached products (separate keys).
      { type: "commit", next: schema("a", "b"), coalesceKey: "option:o1:price", at: 0 },
      { type: "commit", next: withOption, coalesceKey: "option:o1:products", at: 900 },
      // Unrelated structural edit.
      { type: "commit", next: moved, at: 1800 },
    ]);

    const once = historyReducer(state, { type: "undo" });
    const option = (once.present.fields[0] as FormField).radioOptions?.[0];
    expect(option?.price).toBe(5000);
    expect(option?.products).toHaveLength(1);
    expect(labelsOf(once.present)).toEqual(["a", "b"]);
  });
});
