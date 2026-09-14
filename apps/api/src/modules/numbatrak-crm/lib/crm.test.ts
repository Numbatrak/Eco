import { describe, it, expect } from "vitest";
import { findOrCreateCustomer } from "./crm.js";

/**
 * findOrCreateCustomer's actual first-touch-sticky/last-touch-fresh dedup
 * behavior is real Postgres COALESCE semantics evaluated inside
 * onConflictDoUpdate - not something a fake db can execute. What's testable
 * without a live DB is the query shape: phone gets normalized before either
 * insert or conflict target, the conflict target is the real unique index,
 * and the row `.returning()` yields is what comes back.
 */
function fakeDb(returning: unknown[], capture: { values?: unknown; conflict?: unknown }) {
  return {
    insert: () => ({
      values: (vals: unknown) => {
        capture.values = vals;
        return {
          onConflictDoUpdate: (conflict: unknown) => {
            capture.conflict = conflict;
            return { returning: () => Promise.resolve(returning) };
          },
        };
      },
    }),
  } as any;
}

describe("findOrCreateCustomer", () => {
  it("normalizes the phone before inserting", async () => {
    const capture: { values?: any; conflict?: any } = {};
    const db = fakeDb([{ id: "cust-1", phone: "08012345678" }], capture);

    await findOrCreateCustomer(db, "org-1", {
      name: "Ada Lovelace",
      phone: "0801-234-5678",
      clickSource: "Facebook / cpc",
    });

    expect(capture.values.phone).toBe("08012345678");
    expect(capture.values.organizationId).toBe("org-1");
  });

  it("sets both click-source columns to the same value on first insert", async () => {
    const capture: { values?: any; conflict?: any } = {};
    const db = fakeDb([{ id: "cust-1" }], capture);

    await findOrCreateCustomer(db, "org-1", { name: "Ada", phone: "08012345678", clickSource: "Direct" });

    expect(capture.values.firstClickSource).toBe("Direct");
    expect(capture.values.lastClickSource).toBe("Direct");
  });

  it("targets the (organizationId, phone) unique index on conflict", async () => {
    const capture: { values?: any; conflict?: any } = {};
    const db = fakeDb([{ id: "cust-1" }], capture);

    await findOrCreateCustomer(db, "org-1", { name: "Ada", phone: "08012345678", clickSource: null });

    expect(capture.conflict.target).toHaveLength(2);
    expect(capture.conflict.set).toHaveProperty("firstClickSource");
    expect(capture.conflict.set).toHaveProperty("lastClickSource");
  });

  it("returns the row the upsert resolves to", async () => {
    const db = fakeDb([{ id: "cust-42", name: "Ada" }], {});
    const result = await findOrCreateCustomer(db, "org-1", { name: "Ada", phone: "08012345678", clickSource: null });
    expect(result).toEqual({ id: "cust-42", name: "Ada" });
  });

  it("throws if the upsert returns no row", async () => {
    const db = fakeDb([], {});
    await expect(
      findOrCreateCustomer(db, "org-1", { name: "Ada", phone: "08012345678", clickSource: null }),
    ).rejects.toThrow("Failed to find-or-create customer");
  });
});
