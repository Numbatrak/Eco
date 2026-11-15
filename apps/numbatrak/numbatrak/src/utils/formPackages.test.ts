import { describe, it, expect } from "vitest";
import {
  offerLineQuantity,
  offerTrueUnitCount,
  offerPackagePrice,
  estimateOfferCost,
  describeOfferContents,
  buildPackageCatalog,
  describePackage,
  packageLine,
  isOfferBackedOption,
  applyPackageToOption,
  createEmptyPackageOption,
} from "./formPackages";
import { Product, ProductOffer, ProductVariant } from "../types/product";
import { RadioOption } from "../types/form";

function product(id: string, name: string, cost = 0): Product {
  return { id, organization_id: "org", name, cost_price: cost, active: true };
}

function variant(id: string, productId: string, name: string, cost = 0): ProductVariant {
  return {
    id,
    organization_id: "org",
    product_id: productId,
    name,
    base_price: 0,
    cost_price: cost,
    active: true,
    display_order: 0,
  };
}

function offer(partial: Partial<ProductOffer> & Pick<ProductOffer, "id" | "product_id">): ProductOffer {
  return {
    organization_id: "org",
    offer_type: "single",
    label: "An offer",
    min_quantity: 1,
    free_quantity: 0,
    price: 0,
    unit_cost: 0,
    active: true,
    display_order: 0,
    ...partial,
  } as ProductOffer;
}

const MAT = product("p_mat", "Medium Mat", 3000);
const WIPES = product("p_wipes", "Wipes", 500);
const productsById = new Map([MAT, WIPES].map((p) => [p.id, p]));
const BLUE = variant("v_blue", "p_mat", "Blue", 3200);
const variantsById = new Map([[BLUE.id, BLUE]]);

describe("offerLineQuantity", () => {
  it("is 1 for a single offer", () => {
    expect(offerLineQuantity(offer({ id: "o", product_id: "p_mat" }))).toBe(1);
  });

  it("is 1 bundle count for a bundle", () => {
    expect(offerLineQuantity(offer({ id: "o", product_id: "p_mat", offer_type: "bundle" }))).toBe(1);
  });

  it("is 1 bundle count for buy X get Y", () => {
    const o = offer({ id: "o", product_id: "p_mat", offer_type: "buy_x_get_y", min_quantity: 2, free_quantity: 1 });
    expect(offerLineQuantity(o)).toBe(1);
  });

  /**
   * The trap: resolveLinePricing prices a quantity tier at price/min_quantity
   * per unit and takes the line quantity as the unit count. Sending 1 would
   * charge a fraction of the tier and ship a single unit.
   */
  it("is min_quantity for a quantity tier, not 1", () => {
    const tier = offer({ id: "o", product_id: "p_mat", offer_type: "quantity_tier", min_quantity: 2, price: 18000 });
    expect(offerLineQuantity(tier)).toBe(2);
  });

  it("never drops below 1 even if min_quantity is bad data", () => {
    const tier = offer({ id: "o", product_id: "p_mat", offer_type: "quantity_tier", min_quantity: 0 });
    expect(offerLineQuantity(tier)).toBe(1);
  });

  it("charges the full tier price at the computed quantity", () => {
    // Reproduces the server's arithmetic: unitPrice = price / min_quantity,
    // total = unitPrice * quantityPaid.
    const tier = offer({ id: "o", product_id: "p_mat", offer_type: "quantity_tier", min_quantity: 2, price: 18000 });
    const lineQty = offerLineQuantity(tier);
    const unitPrice = tier.price / Math.max(tier.min_quantity, 1);
    expect(unitPrice * lineQty).toBe(18000);
  });

  it("charges the full price for buy X get Y at bundle count 1", () => {
    const bxgy = offer({ id: "o", product_id: "p_mat", offer_type: "buy_x_get_y", min_quantity: 2, free_quantity: 1, price: 18000 });
    const quantityPaid = offerLineQuantity(bxgy) * bxgy.min_quantity;
    const unitPrice = bxgy.price / bxgy.min_quantity;
    expect(unitPrice * quantityPaid).toBe(18000);
  });
});

describe("offerTrueUnitCount", () => {
  it("counts free units for buy X get Y", () => {
    const o = offer({ id: "o", product_id: "p_mat", offer_type: "buy_x_get_y", min_quantity: 2, free_quantity: 1 });
    expect(offerTrueUnitCount(o)).toBe(3);
  });

  it("counts the rung for a quantity tier", () => {
    expect(offerTrueUnitCount(offer({ id: "o", product_id: "p_mat", offer_type: "quantity_tier", min_quantity: 4 }))).toBe(4);
  });

  it("is 1 for single and bundle", () => {
    expect(offerTrueUnitCount(offer({ id: "o", product_id: "p_mat" }))).toBe(1);
    expect(offerTrueUnitCount(offer({ id: "o", product_id: "p_mat", offer_type: "bundle" }))).toBe(1);
  });
});

describe("offerPackagePrice", () => {
  it("is the offer price for every type", () => {
    for (const type of ["single", "quantity_tier", "bundle", "buy_x_get_y"] as const) {
      expect(offerPackagePrice(offer({ id: "o", product_id: "p_mat", offer_type: type, price: 18000 }))).toBe(18000);
    }
  });
});

describe("estimateOfferCost", () => {
  it("multiplies unit cost by true units for buy X get Y", () => {
    const o = offer({ id: "o", product_id: "p_mat", offer_type: "buy_x_get_y", min_quantity: 2, free_quantity: 1, unit_cost: 3000 });
    // Free units still cost money - that is the whole point of the accord rule.
    expect(estimateOfferCost(o, productsById, variantsById)).toBe(9000);
  });

  it("multiplies by the rung for a quantity tier", () => {
    const o = offer({ id: "o", product_id: "p_mat", offer_type: "quantity_tier", min_quantity: 4, unit_cost: 3000 });
    expect(estimateOfferCost(o, productsById, variantsById)).toBe(12000);
  });

  it("adds bundled components at their own cost price", () => {
    const o = offer({
      id: "o",
      product_id: "p_mat",
      offer_type: "bundle",
      unit_cost: 3000,
      bundle_items: [{ product_id: "p_wipes", variant_id: null, quantity: 2 }],
    });
    expect(estimateOfferCost(o, productsById, variantsById)).toBe(3000 + 2 * 500);
  });

  it("prefers a variant's cost price over the product's", () => {
    const o = offer({
      id: "o",
      product_id: "p_mat",
      offer_type: "bundle",
      unit_cost: 0,
      bundle_items: [{ product_id: "p_mat", variant_id: "v_blue", quantity: 1 }],
    });
    expect(estimateOfferCost(o, productsById, variantsById)).toBe(3200);
  });

  it("treats an unknown component as zero rather than throwing", () => {
    const o = offer({
      id: "o",
      product_id: "p_mat",
      offer_type: "bundle",
      unit_cost: 1000,
      bundle_items: [{ product_id: "gone", variant_id: null, quantity: 3 }],
    });
    expect(estimateOfferCost(o, productsById, variantsById)).toBe(1000);
  });
});

describe("describeOfferContents", () => {
  it("describes a single", () => {
    expect(describeOfferContents(offer({ id: "o", product_id: "p_mat" }), productsById, variantsById)).toBe(
      "1× Medium Mat",
    );
  });

  it("describes a quantity tier rung", () => {
    const o = offer({ id: "o", product_id: "p_mat", offer_type: "quantity_tier", min_quantity: 4 });
    expect(describeOfferContents(o, productsById, variantsById)).toBe("4× Medium Mat");
  });

  it("calls out the free units", () => {
    const o = offer({ id: "o", product_id: "p_mat", offer_type: "buy_x_get_y", min_quantity: 2, free_quantity: 1 });
    expect(describeOfferContents(o, productsById, variantsById)).toBe("2× Medium Mat, +1 free");
  });

  it("lists bundled components", () => {
    const o = offer({
      id: "o",
      product_id: "p_mat",
      offer_type: "bundle",
      bundle_items: [{ product_id: "p_wipes", variant_id: null, quantity: 2 }],
    });
    expect(describeOfferContents(o, productsById, variantsById)).toBe("1× Medium Mat + 2× Wipes");
  });

  it("names the variant when the offer forces one", () => {
    const o = offer({ id: "o", product_id: "p_mat", variant_id: "v_blue" });
    expect(describeOfferContents(o, productsById, variantsById)).toBe("1× Medium Mat (Blue)");
  });

  it("says so when a product has gone missing", () => {
    const o = offer({ id: "o", product_id: "ghost" });
    expect(describeOfferContents(o, productsById, variantsById)).toBe("1× Unknown product");
  });
});

describe("buildPackageCatalog", () => {
  const offers = {
    p_mat: [
      offer({ id: "o2", product_id: "p_mat", label: "Buy 2 Get 1", display_order: 2, price: 18000 }),
      offer({ id: "o1", product_id: "p_mat", label: "Single mat", display_order: 1, price: 10000 }),
      offer({ id: "o_off", product_id: "p_mat", label: "Retired", active: false }),
    ],
    p_wipes: [offer({ id: "o3", product_id: "p_wipes", label: "Wipes pack", price: 2000 })],
  };

  it("omits switched-off offers", () => {
    const { choices } = buildPackageCatalog([MAT, WIPES], offers, {});
    expect(choices.map((c) => c.offer.id)).not.toContain("o_off");
  });

  it("groups by product then merchant ordering", () => {
    const { choices } = buildPackageCatalog([MAT, WIPES], offers, {});
    expect(choices.map((c) => `${c.productName}/${c.label}`)).toEqual([
      "Medium Mat/Single mat",
      "Medium Mat/Buy 2 Get 1",
      "Wipes/Wipes pack",
    ]);
  });

  it("indexes by offer id for lookup from a saved option", () => {
    const { byOfferId } = buildPackageCatalog([MAT, WIPES], offers, {});
    expect(byOfferId.get("o2")?.label).toBe("Buy 2 Get 1");
  });

  it("is empty when the merchant has no offers yet", () => {
    expect(buildPackageCatalog([MAT], {}, {}).choices).toEqual([]);
  });
});

describe("describePackage", () => {
  it("computes profit from price minus estimated cost", () => {
    const o = offer({ id: "o", product_id: "p_mat", price: 10000, unit_cost: 3000 });
    const choice = describePackage(o, productsById, variantsById);
    expect(choice.price).toBe(10000);
    expect(choice.estimatedCost).toBe(3000);
    expect(choice.estimatedProfit).toBe(7000);
    expect(choice.unavailableReason).toBeNull();
  });

  it("flags a package whose anchor product is gone", () => {
    const choice = describePackage(offer({ id: "o", product_id: "ghost" }), productsById, variantsById);
    expect(choice.unavailableReason).toMatch(/no longer available/);
  });

  it("flags a bundle whose component is gone", () => {
    const o = offer({
      id: "o",
      product_id: "p_mat",
      offer_type: "bundle",
      bundle_items: [{ product_id: "ghost", variant_id: null, quantity: 1 }],
    });
    expect(describePackage(o, productsById, variantsById).unavailableReason).toMatch(/bundles/);
  });

  it("reports a negative profit rather than hiding it", () => {
    const o = offer({ id: "o", product_id: "p_mat", price: 1000, unit_cost: 3000 });
    expect(describePackage(o, productsById, variantsById).estimatedProfit).toBe(-2000);
  });
});

describe("packageLine", () => {
  it("submits one line carrying the offer", () => {
    const o = offer({ id: "o", product_id: "p_mat", variant_id: "v_blue" });
    const choice = describePackage(o, productsById, variantsById);
    expect(packageLine(choice)).toEqual({
      product_id: "p_mat",
      quantity: 1,
      offer_id: "o",
      variant_id: "v_blue",
    });
  });

  it("uses the tier quantity so the full tier price is charged", () => {
    const o = offer({ id: "o", product_id: "p_mat", offer_type: "quantity_tier", min_quantity: 4, price: 35000 });
    expect(packageLine(describePackage(o, productsById, variantsById)).quantity).toBe(4);
  });

  it("does not spell out bundle components - the server expands them", () => {
    const o = offer({
      id: "o",
      product_id: "p_mat",
      offer_type: "bundle",
      bundle_items: [{ product_id: "p_wipes", variant_id: null, quantity: 2 }],
    });
    const line = packageLine(describePackage(o, productsById, variantsById));
    expect(line.product_id).toBe("p_mat");
    expect(line.quantity).toBe(1);
  });
});

describe("isOfferBackedOption", () => {
  it("is true only for options marked as offer-backed", () => {
    expect(isOfferBackedOption({ source: "offer" })).toBe(true);
    expect(isOfferBackedOption({ source: "manual" })).toBe(false);
    // Saved before packages moved to Products.
    expect(isOfferBackedOption({ source: undefined })).toBe(false);
  });
});

describe("applyPackageToOption", () => {
  const existing: RadioOption = {
    id: "opt_keep",
    title: "Old title",
    value: "starter_pack",
    price: 1,
    products: [{ product_id: "whatever", quantity: 9 }],
    source: "offer",
  };
  const choice = describePackage(
    offer({ id: "o_new", product_id: "p_mat", label: "Buy 2 Get 1", price: 18000 }),
    productsById,
    variantsById,
  );

  it("mirrors title, price and line from the offer", () => {
    const next = applyPackageToOption(existing, choice);
    expect(next.title).toBe("Buy 2 Get 1");
    expect(next.price).toBe(18000);
    expect(next.offer_id).toBe("o_new");
    expect(next.products).toEqual([{ product_id: "p_mat", quantity: 1, offer_id: "o_new", variant_id: null }]);
  });

  /** A live form's submissions and Elementor mapping both key on these. */
  it("never changes the option id or its answer value", () => {
    const next = applyPackageToOption(existing, choice);
    expect(next.id).toBe("opt_keep");
    expect(next.value).toBe("starter_pack");
  });

  it("marks a converted hand-built option as offer-backed", () => {
    const legacy: RadioOption = { ...existing, source: undefined };
    expect(applyPackageToOption(legacy, choice).source).toBe("offer");
  });

  it("replaces the hand-built product lines rather than merging", () => {
    const legacy: RadioOption = {
      ...existing,
      source: undefined,
      products: [
        { product_id: "p_mat", quantity: 4 },
        { product_id: "p_wipes", quantity: 1 },
      ],
    };
    expect(applyPackageToOption(legacy, choice).products).toHaveLength(1);
  });
});

describe("createEmptyPackageOption", () => {
  it("is offer-backed but not yet chosen", () => {
    const option = createEmptyPackageOption("option_1");
    expect(option.source).toBe("offer");
    expect(option.offer_id).toBeNull();
    expect(option.products).toEqual([]);
    expect(option.value).toBe("option_1");
  });

  it("gets a unique id each time", () => {
    expect(createEmptyPackageOption("a").id).not.toBe(createEmptyPackageOption("a").id);
  });
});

