"use client";

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
          {products.map((product) => (
            <div key={product.id} className="st-card">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="st-card-image filled"
                />
              ) : (
                <div className="st-card-image" />
              )}
              <h4>{product.name}</h4>
              {product.description ? <p>{product.description}</p> : null}
              <div className="st-price">{formatCents(product.priceCents, product.currency)}</div>
              {onAdd ? (
                <button
                  type="button"
                  className="st-add-btn"
                  disabled={addingId === product.id}
                  onClick={() => void onAdd(product.id)}
                >
                  {addingId === product.id ? "Adding…" : "Add to cart"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
