"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { useSite } from "../../../../../components/SiteProvider";
import { useCart } from "../../../../../components/CartContext";
import { StorefrontShell } from "../../../../../components/storefront/StorefrontShell";
import { MiniCart } from "../../../../../components/MiniCart";
import { formatCents } from "../../../../../lib/money";
import { viewContent } from "../../../../../lib/analytics/pixelEvents";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}): React.ReactElement {
  const { productId } = use(params);
  const { site } = useSite();
  const { addItem } = useCart();

  const product = site.products.find((item) => item.id === productId);

  const [variantId, setVariantId] = useState<string>(product?.variants[0]?.id ?? "");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!product) {
    notFound();
  }
  // Rebind so the type stays narrowed inside closures like handleAdd below -
  // `product` itself widens back to `Product | undefined` there since it's a
  // `const` captured across a function boundary.
  const activeProduct = product;

  const hasVariants = activeProduct.variants.length > 0;
  const canAdd = !hasVariants || Boolean(variantId);

  useEffect(() => {
    viewContent(activeProduct.id, activeProduct.priceCents, activeProduct.currency);
  }, [activeProduct.id, activeProduct.priceCents, activeProduct.currency]);

  async function handleAdd(): Promise<void> {
    setError(null);
    setAdding(true);
    try {
      await addItem(activeProduct.id, 1, hasVariants ? variantId : undefined);
    } catch {
      setError("Could not add this item to your cart.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <StorefrontShell
      brandName={site.tenant.name}
      theme={site.theme}
      hasCollections={site.collections.length > 0}
      cartSlot={<MiniCart />}
    >
      <section className="st-section">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, maxWidth: 720 }}>
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="st-card-image filled"
              style={{ height: 320, borderRadius: 12 }}
            />
          ) : (
            <div className="st-card-image" style={{ height: 320 }} />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h1 className="st-headline" style={{ fontSize: 28 }}>
              {product.name}
            </h1>
            <div className="st-price" style={{ fontSize: 16 }}>
              {product.compareAtPriceCents ? (
                <span className="st-price-compare">
                  {formatCents(product.compareAtPriceCents, product.currency)}
                </span>
              ) : null}
              {formatCents(product.priceCents, product.currency)}
            </div>
            {product.description ? <p>{product.description}</p> : null}

            {hasVariants ? (
              <div className="field">
                <label className="field-label" htmlFor="variant">
                  Size / Color
                </label>
                <select
                  id="variant"
                  className="text-input"
                  value={variantId}
                  onChange={(event) => setVariantId(event.target.value)}
                >
                  <option value="" disabled>
                    Choose an option
                  </option>
                  {product.variants.map((variant) => (
                    <option
                      key={variant.id}
                      value={variant.id}
                      disabled={!variant.isAvailable || variant.stockCount <= 0}
                    >
                      {variant.size} / {variant.color}
                      {!variant.isAvailable || variant.stockCount <= 0 ? " (out of stock)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {error ? (
              <div style={{ fontSize: 13, color: "var(--st-accent)" }} role="alert">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              className="st-add-btn"
              disabled={!canAdd || adding}
              onClick={() => void handleAdd()}
            >
              {adding ? "Adding…" : "Add to cart"}
            </button>
          </div>
        </div>
      </section>
    </StorefrontShell>
  );
}
