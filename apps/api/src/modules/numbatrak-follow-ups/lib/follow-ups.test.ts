import { describe, it, expect, vi, beforeEach } from "vitest";
import { numbatrakAbandonedCarts, numbatrakCustomerOrders, numbatrakFollowUps, user } from "@platform/db";

vi.mock("./csr-assignment.js", () => ({
  pickLeastBusyCsr: vi.fn(),
}));

const { pickLeastBusyCsr } = await import("./csr-assignment.js");
const { createFollowUp, updateFollowUp, autoCreateFollowUpForOrder } = await import("./follow-ups.js");

/**
 * Minimal stand-in for the subset of the Drizzle query builder this module
 * uses (select/from/where/limit/orderBy, insert/values, update/set/where,
 * .returning()). Every chain method returns the same thenable object, so
 * awaiting at any point in the chain resolves to `result` - this matches how
 * drizzle-orm's own builders are thenable at every step.
 */
function chainable(result: unknown, onValues?: (vals: unknown) => void): any {
  const obj: any = {
    from: (table: unknown) => byTable.get(table) ?? chainable([]),
    where: () => obj,
    limit: () => obj,
    orderBy: () => obj,
    offset: () => obj,
    groupBy: () => obj,
    set: () => obj,
    values: (vals: unknown) => {
      onValues?.(vals);
      return obj;
    },
    returning: () => Promise.resolve(result),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return obj;
}

let byTable: Map<unknown, ReturnType<typeof chainable>>;

function makeFakeDb(opts: {
  users?: unknown[];
  carts?: unknown[];
  orders?: unknown[];
  insertResult?: unknown[];
  updateResult?: unknown[];
  onInsertValues?: (vals: unknown) => void;
  insertThrows?: boolean;
}) {
  byTable = new Map<unknown, ReturnType<typeof chainable>>([
    [user, chainable(opts.users ?? [])],
    [numbatrakAbandonedCarts, chainable(opts.carts ?? [])],
    [numbatrakCustomerOrders, chainable(opts.orders ?? [])],
  ]);

  return {
    select: () => ({ from: (table: unknown) => byTable.get(table) ?? chainable([]) }),
    insert: () => ({
      values: (vals: unknown) => {
        if (opts.insertThrows) return Promise.reject(new Error("insert failed"));
        opts.onInsertValues?.(vals);
        return chainable(opts.insertResult ?? []);
      },
    }),
    update: () => ({ set: () => ({ where: () => chainable(opts.updateResult ?? []) }) }),
  } as any;
}

beforeEach(() => {
  vi.mocked(pickLeastBusyCsr).mockReset();
});

describe("autoCreateFollowUpForOrder", () => {
  it("inserts an awaiting follow-up assigned to the least-busy csr", async () => {
    vi.mocked(pickLeastBusyCsr).mockResolvedValue("csr-1");
    let inserted: any = null;
    const db = makeFakeDb({ onInsertValues: (vals) => (inserted = vals) });

    await autoCreateFollowUpForOrder(db, "org-1", "order-1");

    expect(inserted).toMatchObject({
      organizationId: "org-1",
      orderId: "order-1",
      assignedTo: "csr-1",
      status: "awaiting",
      priority: "medium",
    });
  });

  it("still inserts an unassigned follow-up when no csr exists", async () => {
    vi.mocked(pickLeastBusyCsr).mockResolvedValue(null);
    let inserted: any = null;
    const db = makeFakeDb({ onInsertValues: (vals) => (inserted = vals) });

    await autoCreateFollowUpForOrder(db, "org-1", "order-1");

    expect(inserted).toMatchObject({ assignedTo: null });
  });

  it("never throws - a follow-up write failure must not block order creation", async () => {
    vi.mocked(pickLeastBusyCsr).mockResolvedValue("csr-1");
    const db = makeFakeDb({ insertThrows: true });

    await expect(autoCreateFollowUpForOrder(db, "org-1", "order-1")).resolves.toBeUndefined();
  });
});

describe("createFollowUp / attachRelations order fields", () => {
  it("attaches the linked order's customer info, not cart fields", async () => {
    vi.mocked(pickLeastBusyCsr).mockResolvedValue("csr-1");
    const insertedRow = {
      id: 1,
      organizationId: "org-1",
      orderId: "order-1",
      abandonedCartId: null,
      assignedTo: "csr-1",
      status: "awaiting",
      priority: "medium",
      startedAt: null,
      firstContactAt: null,
      completedAt: null,
      responseTimeMinutes: null,
      resolutionTimeMinutes: null,
      outcome: null,
      notes: null,
      createdAt: new Date("2024-01-01T09:00:00Z"),
      updatedAt: new Date("2024-01-01T09:00:00Z"),
    };
    const orderRow = {
      id: "order-1",
      customerName: "Ada Lovelace",
      phoneNumber: "+2348000000000",
      state: "Lagos",
      deliveryAddress: "1 Analytical Engine Way",
    };
    const db = makeFakeDb({ insertResult: [insertedRow], orders: [orderRow] });

    const followUp = await createFollowUp(db, "org-1", { orderId: "order-1" });

    expect(followUp.orderCustomerName).toBe("Ada Lovelace");
    expect(followUp.orderCustomerPhone).toBe("+2348000000000");
    expect(followUp.orderCustomerState).toBe("Lagos");
    expect(followUp.orderCustomerAddress).toBe("1 Analytical Engine Way");
    expect(followUp.cartCustomerName).toBeNull();
  });
});

describe("updateFollowUp - order-linked response time", () => {
  it("anchors response time on the order's createdAt, not just abandoned carts", async () => {
    // Constructed in local time (not a "Z" UTC literal) so this matches
    // calculateWorkHoursMinutes' own local-time getHours()/setHours() math
    // regardless of the timezone the test runner executes in.
    const orderCreatedAt = new Date(2024, 0, 1, 10, 0, 0); // Monday Jan 1 2024, 10:00, within work hours
    const firstContactAt = new Date(2024, 0, 1, 10, 30, 0).toISOString();
    const currentRow = {
      id: 1,
      organizationId: "org-1",
      orderId: "order-1",
      abandonedCartId: null,
      assignedTo: "csr-1",
      status: "awaiting",
      priority: "medium",
      startedAt: null,
      firstContactAt: null,
      completedAt: null,
      responseTimeMinutes: null,
      resolutionTimeMinutes: null,
      outcome: null,
      notes: null,
      createdAt: orderCreatedAt,
      updatedAt: orderCreatedAt,
    };
    const updatedRow = { ...currentRow, status: "followed_up", firstContactAt: new Date(firstContactAt), responseTimeMinutes: 30 };

    let capturedUpdate: any = null;
    const db = makeFakeDb({ orders: [{ id: "order-1", createdAt: orderCreatedAt }] });
    // findFollowUpForOrg's select().from(numbatrakFollowUps) and the final
    // update() both need bespoke wiring since makeFakeDb only pre-wires
    // user/cart/order lookups.
    byTable.set(numbatrakFollowUps, chainable([currentRow]));
    db.update = () => ({
      set: (vals: unknown) => {
        capturedUpdate = vals;
        return { where: () => chainable([updatedRow]) };
      },
    });

    const result = await updateFollowUp(db, "org-1", 1, { status: "followed_up", firstContactAt });

    expect(capturedUpdate.responseTimeMinutes).toBe(30);
    expect(result?.responseTimeMinutes).toBe(30);
  });
});
