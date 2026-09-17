import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  numbatrakComplaints,
  numbatrakCustomerOrders,
  numbatrakCustomerOrderItems,
  numbatrakUnifiedExpenses,
  numbatrakExpenseSubcategories,
} from "@platform/db";

vi.mock("../../numbatrak-orders/lib/stock.js", () => ({
  createReplacementMovement: vi.fn(),
}));

const { createReplacementMovement } = await import("../../numbatrak-orders/lib/stock.js");
const { findOrCreateCustomer, resolveComplaint } = await import("./crm.js");

beforeEach(() => {
  vi.mocked(createReplacementMovement).mockReset();
});

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

function fakeResolveDb(opts: {
  complaint: any;
  updatedComplaint?: any;
  order?: any | null;
  orderItem?: any | null;
  onOrderUpdate?: (vals: any) => void;
  onExpenseInsert?: (vals: any) => void;
}) {
  return {
    select: () => ({
      from: (table: unknown) => {
        if (table === numbatrakComplaints) {
          return { where: () => ({ limit: () => Promise.resolve([opts.complaint]) }) };
        }
        if (table === numbatrakCustomerOrders) {
          return { where: () => ({ limit: () => Promise.resolve(opts.order ? [opts.order] : []) }) };
        }
        if (table === numbatrakCustomerOrderItems) {
          return { where: () => ({ limit: () => Promise.resolve(opts.orderItem ? [opts.orderItem] : []) }) };
        }
        throw new Error("fakeResolveDb: unexpected select table");
      },
    }),
    update: (table: unknown) => {
      if (table === numbatrakCustomerOrders) {
        return {
          set: (vals: unknown) => {
            opts.onOrderUpdate?.(vals);
            return { where: () => Promise.resolve([]) };
          },
        };
      }
      if (table === numbatrakComplaints) {
        return { set: () => ({ where: () => ({ returning: () => Promise.resolve([opts.updatedComplaint ?? opts.complaint]) }) }) };
      }
      throw new Error("fakeResolveDb: unexpected update table");
    },
    insert: (table: unknown) => {
      if (table === numbatrakUnifiedExpenses) {
        return {
          values: (vals: unknown) => {
            opts.onExpenseInsert?.(vals);
            return { onConflictDoNothing: () => Promise.resolve() };
          },
        };
      }
      if (table === numbatrakExpenseSubcategories) {
        return { values: () => ({ onConflictDoNothing: () => Promise.resolve() }) };
      }
      throw new Error("fakeResolveDb: unexpected insert table");
    },
  } as any;
}

const baseComplaint = {
  id: "complaint-1",
  organizationId: "org-1",
  customerId: "cust-1",
  orderId: "order-1",
  status: "open",
  resolutionType: null,
};

const baseOrder = {
  id: "order-1",
  organizationId: "org-1",
  agentId: 7,
  deliveryFee: "500",
};

describe("resolveComplaint - refund", () => {
  it("flips the order to refunded and books no expense", async () => {
    let orderUpdate: any = null;
    let expenseInsert: any = null;
    const db = fakeResolveDb({
      complaint: baseComplaint,
      order: baseOrder,
      onOrderUpdate: (v) => (orderUpdate = v),
      onExpenseInsert: (v) => (expenseInsert = v),
    });

    await resolveComplaint(db, "org-1", "complaint-1", "user-1", { resolution: "Refunded", resolutionType: "refund" });

    expect(orderUpdate.status).toBe("refunded");
    expect(expenseInsert).toBeNull();
    expect(createReplacementMovement).not.toHaveBeenCalled();
  });

  it("throws when the complaint has no linked order", async () => {
    const db = fakeResolveDb({ complaint: { ...baseComplaint, orderId: null } });
    await expect(
      resolveComplaint(db, "org-1", "complaint-1", "user-1", { resolution: "Refunded", resolutionType: "refund" }),
    ).rejects.toThrow(/requires the complaint to be linked to an order/);
  });
});

describe("resolveComplaint - replacement", () => {
  it("books unit cost + delivery fee as a chargeback expense and deducts stock", async () => {
    let expenseInsert: any = null;
    const db = fakeResolveDb({
      complaint: baseComplaint,
      order: baseOrder,
      orderItem: { unitCostAtSubmission: "1200" },
      onExpenseInsert: (v) => (expenseInsert = v),
    });

    await resolveComplaint(db, "org-1", "complaint-1", "user-1", {
      resolution: "Replaced",
      resolutionType: "replacement",
      productId: "product-1",
    });

    expect(createReplacementMovement).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ fromAgentId: 7, productId: "product-1", quantity: 1, orderId: "order-1", cost: 1200 }),
    );
    expect(expenseInsert).toMatchObject({
      category: "operational",
      subcategory: "chargeback",
      amount: "1700", // 1200 unit cost + 500 delivery fee
      orderId: "order-1",
      productId: "product-1",
      sourceType: "complaint_replacement",
      sourceId: "complaint-1",
    });
  });

  it("skips the stock movement but still books the expense when the order has no agent", async () => {
    let expenseInsert: any = null;
    const db = fakeResolveDb({
      complaint: baseComplaint,
      order: { ...baseOrder, agentId: null },
      orderItem: { unitCostAtSubmission: "1200" },
      onExpenseInsert: (v) => (expenseInsert = v),
    });

    await resolveComplaint(db, "org-1", "complaint-1", "user-1", {
      resolution: "Replaced",
      resolutionType: "replacement",
      productId: "product-1",
    });

    expect(createReplacementMovement).not.toHaveBeenCalled();
    expect(expenseInsert).not.toBeNull();
  });

  it("throws when no productId is given", async () => {
    const db = fakeResolveDb({ complaint: baseComplaint, order: baseOrder });
    await expect(
      resolveComplaint(db, "org-1", "complaint-1", "user-1", { resolution: "Replaced", resolutionType: "replacement" }),
    ).rejects.toThrow(/selecting which product/);
  });

  it("throws when the product isn't part of the linked order", async () => {
    const db = fakeResolveDb({ complaint: baseComplaint, order: baseOrder, orderItem: null });
    await expect(
      resolveComplaint(db, "org-1", "complaint-1", "user-1", {
        resolution: "Replaced",
        resolutionType: "replacement",
        productId: "product-1",
      }),
    ).rejects.toThrow(/not part of the linked order/);
  });
});

describe("resolveComplaint - other", () => {
  it("skips the order lookup entirely - no order fixture needed for it to succeed", async () => {
    let expenseInsert: any = null;
    // Deliberately no `order`/`orderItem` fixture: if "other" mistakenly
    // triggered the refund/replacement order lookup, this would throw
    // "order linked to this complaint was not found" and fail the test.
    const db = fakeResolveDb({
      complaint: baseComplaint,
      updatedComplaint: { ...baseComplaint, status: "resolved", resolutionType: "other" },
      onExpenseInsert: (v) => (expenseInsert = v),
    });

    const result = await resolveComplaint(db, "org-1", "complaint-1", "user-1", {
      resolution: "Resolved",
      resolutionType: "other",
    });

    expect(result?.resolutionType).toBe("other");
    expect(expenseInsert).toBeNull();
    expect(createReplacementMovement).not.toHaveBeenCalled();
  });
});
