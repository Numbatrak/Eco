"use client";

import { useState } from "react";
import { useSite } from "../../../components/SiteProvider";
import { useCart } from "../../../components/CartContext";
import { formatCents } from "../../../lib/money";

export default function ShopPage(): React.ReactElement {
  const { site } = useSite();
  const { addItem } = useCart();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function handleAdd(productId: string): Promise<void> {
    setAddingId(productId);
    setErrorId(null);
    try {
      await addItem(productId, 1);
    } catch {
      setErrorId(productId);
    } finally {
      setAddingId(null);
    }
  }

  if (!site.productsGridEnabled || site.products.length === 0) {
    return <p className="text-center text-sm text-muted">No products to show yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {site.products.map((product) => (
        <div
          key={product.id}
          className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-4"
        >
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-40 w-full rounded-md object-cover"
            />
          ) : (
            <div className="h-40 w-full rounded-md bg-paper" />
          )}
          <div>
            <h3 className="font-heading text-base text-ink">{product.name}</h3>
            {product.description ? <p className="text-sm text-muted">{product.description}</p> : null}
          </div>
          <div className="mt-auto flex items-center justify-between">
            <span className="font-medium text-ink">
              {formatCents(product.priceCents, product.currency)}
            </span>
            <button
              type="button"
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-60"
              disabled={addingId === product.id}
              onClick={() => void handleAdd(product.id)}
            >
              {addingId === product.id ? "Adding…" : "Add to cart"}
            </button>
          </div>
          {errorId === product.id ? (
            <p className="text-xs text-danger">Could not add this item. Try again.</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
