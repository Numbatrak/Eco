import { buildStorefrontBaseUrl } from "../../../lib/storefront-url.js";

export interface CatalogFeedProduct {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  /** True if the product has no variants, or at least one variant is available with stock. */
  inStock: boolean;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Google Merchant RSS/XML feed. `g:id` is the PRODUCT id (never a variant
 * id) - matches the same id every pixel event sends, so ad platforms can
 * match catalog items to events reliably (variant-level catalogs cause real
 * match-rate problems in practice).
 */
export function buildCatalogFeedXml(
  brandName: string,
  subdomain: string,
  products: CatalogFeedProduct[],
): string {
  const baseUrl = buildStorefrontBaseUrl(subdomain);
  const items = products
    .map((product) => {
      const price = (product.priceCents / 100).toFixed(2);
      return `    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:title>${escapeXml(product.name)}</g:title>
      <g:description>${escapeXml(product.description ?? "")}</g:description>
      <g:link>${escapeXml(`${baseUrl}/products/${product.id}`)}</g:link>
      ${product.imageUrl ? `<g:image_link>${escapeXml(product.imageUrl)}</g:image_link>` : ""}
      <g:availability>${product.inStock ? "in stock" : "out of stock"}</g:availability>
      <g:price>${price} ${escapeXml(product.currency)}</g:price>
      <g:brand>${escapeXml(brandName)}</g:brand>
      <g:condition>new</g:condition>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>${escapeXml(brandName)}</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(brandName)} product catalog</description>
${items}
  </channel>
</rss>
`;
}
