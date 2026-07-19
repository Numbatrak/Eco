import { describe, it, expect } from "vitest";
import { buildCatalogFeedXml, type CatalogFeedProduct } from "./build-feed.js";

function product(overrides: Partial<CatalogFeedProduct> = {}): CatalogFeedProduct {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Senator Gown",
    description: "A gown",
    priceCents: 2500000,
    currency: "NGN",
    imageUrl: "https://example.com/gown.jpg",
    inStock: true,
    ...overrides,
  };
}

describe("buildCatalogFeedXml", () => {
  it("uses the product id (not a variant id) as g:id", () => {
    const xml = buildCatalogFeedXml("Acme", "acme", [product()]);
    expect(xml).toContain("<g:id>11111111-1111-1111-1111-111111111111</g:id>");
  });

  it("links to the product detail page under the tenant's storefront URL", () => {
    const xml = buildCatalogFeedXml("Acme", "acme", [product()]);
    expect(xml).toContain(
      "<g:link>http://acme.localhost:3000/products/11111111-1111-1111-1111-111111111111</g:link>",
    );
  });

  it("formats price as major units with the currency code", () => {
    const xml = buildCatalogFeedXml("Acme", "acme", [product({ priceCents: 2500000 })]);
    expect(xml).toContain("<g:price>25000.00 NGN</g:price>");
  });

  it("reports out-of-stock products correctly", () => {
    const xml = buildCatalogFeedXml("Acme", "acme", [product({ inStock: false })]);
    expect(xml).toContain("<g:availability>out of stock</g:availability>");
  });

  it("escapes XML-unsafe characters in product names", () => {
    const xml = buildCatalogFeedXml("Acme", "acme", [product({ name: "Ankara & \"Lace\"" })]);
    expect(xml).toContain("<g:title>Ankara &amp; &quot;Lace&quot;</g:title>");
  });

  it("produces a valid empty channel for a tenant with no published products", () => {
    const xml = buildCatalogFeedXml("Acme", "acme", []);
    expect(xml).toContain("<channel>");
    expect(xml).toContain("</channel>");
  });
});
