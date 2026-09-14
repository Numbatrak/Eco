import { describe, it, expect } from "vitest";
import { markOrderAbandoned } from "./orders.js";

/**
 * markOrderAbandoned's real behavior lives in the SQL WHERE clause
 * (status = 'pending' AND abandoned_at IS NULL) - a fake db can't evaluate
 * that, but it can verify the function's contract: returning() rows means
 * the conditional update matched and flipped the row, an empty result means
 * it didn't (already paid/failed, or already flagged by a concurrent run).
 */
function fakeDb(returning: unknown[]) {
  return {
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve(returning),
        }),
      }),
    }),
  } as any;
}

describe("markOrderAbandoned", () => {
  it("returns true when the conditional update matches a row", async () => {
    const db = fakeDb([{ id: "order-1" }]);
    await expect(markOrderAbandoned(db, "order-1")).resolves.toBe(true);
  });

  it("returns false when no row matches (already settled or already flagged)", async () => {
    const db = fakeDb([]);
    await expect(markOrderAbandoned(db, "order-1")).resolves.toBe(false);
  });
});
