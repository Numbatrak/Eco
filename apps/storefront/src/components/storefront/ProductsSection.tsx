"use client";

import Link from "next/link";
import type { ProductsSection as ProductsSectionData, PublicSiteProduct } from "@platform/shared-types";
import { formatCents } from "../../lib/money";

export interface ProductsSectionProps {
  section: ProductsSectionData;
  products: PublicSiteProduct[];
  onAdd?: (productId: string) => void | Promise<void>;
  addingId?: string | null;
}

export function ProductsSection({
  section,
  products,
  onAdd,
  addingId,
}: ProductsSectionProps): React.ReactElement | null {
  if (!section.visible) return null;
  return (
    <section className="st-section">
      <h3 className="st-section-title">{section.title || "On the counter today"}</h3>
      {products.length === 0 ? (
        <div className="st-empty">No products to show yet.</div>
      ) : (
        <div className="st-grid">
          {products.map((product) => {
            const hasVariants = product.variants.length > 0;
            return (
              <div key={product.id} className="st-card">
                <Link href={`/products/${product.id}`} className="st-card-link">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="st-card-image filled" />
                  ) : (
                    <div className="st-card-image" />
                  )}
                  <h4>{product.name}</h4>
                  {product.description ? <p>{product.description}</p> : null}
                  <div className="st-price">
                    {product.compareAtPriceCents ? (
                      <span className="st-price-compare">
                        {formatCents(product.compareAtPriceCents, product.currency)}
                      </span>
                    ) : null}
                    {formatCents(product.priceCents, product.currency)}
                  </div>
                </Link>
                {onAdd && !hasVariants ? (
                  <button
                    type="button"
                    className="st-add-btn"
                    disabled={addingId === product.id}
                    onClick={() => void onAdd(product.id)}
                  >
                    {addingId === product.id ? "Adding…" : "Add to cart"}
                  </button>
                ) : null}
                {onAdd && hasVariants ? (
                  <Link
                    href={`/products/${product.id}`}
                    className="st-add-btn"
                    style={{ textAlign: "center", textDecoration: "none" }}
                  >
                    Choose options
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
