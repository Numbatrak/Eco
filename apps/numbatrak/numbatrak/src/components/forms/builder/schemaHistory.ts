/**
 * Undo/redo for the form builder.
 *
 * Previously only structural edits (add/remove/move/duplicate) were recorded,
 * while every property edit - labels, prices, package options, attached
 * products, confirmation settings - went straight to state. Undo therefore
 * restored a snapshot from the last structural edit and silently threw away
 * everything typed since. Every mutation now goes through `commit`.
 *
 * Rapid edits to the same thing coalesce into one step via `coalesceKey`, so
 * undoing a label doesn't walk back one character at a time.
 *
 * The reducer is pure - `at` is passed in rather than read from the clock -
 * so the coalescing rules can be tested directly.
 */

import { useCallback, useMemo, useReducer } from "react";
import { FormSchema } from "../../../types/form";

/** Edits sharing a coalesce key within this window collapse into one step. */
export const COALESCE_WINDOW_MS = 800;

/** Plenty for a session, bounded so a long edit can't grow without limit. */
export const HISTORY_LIMIT = 100;

export interface HistoryState {
  present: FormSchema;
  past: FormSchema[];
  future: FormSchema[];
  /** Coalesce key of the most recent commit, or null if it can't coalesce. */
  lastKey: string | null;
  lastAt: number;
}

export type HistoryAction =
  | { type: "commit"; next: FormSchema; coalesceKey?: string; at: number }
  /** Apply without recording - for automatic edits the user didn't make. */
  | { type: "replace"; next: FormSchema }
  /** Load a form, or re-baseline after a save. Clears history. */
  | { type: "reset"; next: FormSchema }
  | { type: "undo" }
  | { type: "redo" };

export function initHistory(present: FormSchema): HistoryState {
  return { present, past: [], future: [], lastKey: null, lastAt: 0 };
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "commit": {
      // Coalescing keeps `past` untouched, so the single undo step rewinds to
      // before the first keystroke of the run rather than the last.
      const coalesces =
        action.coalesceKey != null &&
        state.lastKey != null &&
        action.coalesceKey === state.lastKey &&
        action.at - state.lastAt <= COALESCE_WINDOW_MS;

      return {
        present: action.next,
        past: coalesces ? state.past : [...state.past, state.present].slice(-HISTORY_LIMIT),
        future: [],
        lastKey: action.coalesceKey ?? null,
        lastAt: action.at,
      };
    }

    case "replace":
      // Not an undo step, but it does invalidate any redo branch: redoing on
      // top of a schema the user didn't produce would splice two timelines.
      return { ...state, present: action.next, future: [], lastKey: null, lastAt: 0 };

    case "reset":
      return initHistory(action.next);

    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        present: previous,
        past: state.past.slice(0, -1),
        future: [...state.future, state.present],
        lastKey: null,
        lastAt: 0,
      };
    }

    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[state.future.length - 1];
      return {
        present: next,
        past: [...state.past, state.present],
        future: state.future.slice(0, -1),
        lastKey: null,
        lastAt: 0,
      };
    }

    default:
      return state;
  }
}

export interface SchemaHistory {
  schema: FormSchema;
  /** Record an edit the user made. */
  commitSchema: (next: FormSchema, coalesceKey?: string) => void;
  /** Apply an edit the app made on the user's behalf - not undoable. */
  replaceSchema: (next: FormSchema) => void;
  /** Load/re-baseline, clearing history. */
  resetSchema: (next: FormSchema) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useSchemaHistory(initial: FormSchema): SchemaHistory {
  const [state, dispatch] = useReducer(historyReducer, initial, initHistory);

  const commitSchema = useCallback((next: FormSchema, coalesceKey?: string) => {
    dispatch({ type: "commit", next, coalesceKey, at: Date.now() });
  }, []);

  const replaceSchema = useCallback((next: FormSchema) => {
    dispatch({ type: "replace", next });
  }, []);

  const resetSchema = useCallback((next: FormSchema) => {
    dispatch({ type: "reset", next });
  }, []);

  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  return useMemo(
    () => ({
      schema: state.present,
      commitSchema,
      replaceSchema,
      resetSchema,
      undo,
      redo,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
    }),
    [state, commitSchema, replaceSchema, resetSchema, undo, redo],
  );
}
