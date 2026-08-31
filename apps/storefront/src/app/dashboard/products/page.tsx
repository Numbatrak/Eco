"use client";

import { useCallback, useEffect, useState } from "react";
import type { Product, ProductStatus } from "@platform/shared-types";
import { RequireAuth } from "../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../components/dashboard/DashboardLayout";
import { commerceApi } from "../../../lib/commerceApi";
import { formatCents } from "../../../lib/money";

type Filter = "all" | ProductStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

function ProductsInner(): React.ReactElement {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const { products: list } = await commerceApi.listProducts();
      setProducts(list);
    } catch {
      setError("Could not load products.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = (products ?? []).filter(
    (product) => filter === "all" || product.status === filter,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Products</h1>
      </div>

      <div className="banner banner-muted" role="status">
        Products are managed in Numbatrak. Add, edit, or publish a product there and it syncs
        here automatically.
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={filter === item.value ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : null}

      {products === null ? (
        <p className="field-hint">Loading products…</p>
      ) : filtered.length === 0 ? (
        <p className="field-hint">No products yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id}>
                  <td>
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt=""
                        style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }}
                      />
                    ) : null}
                  </td>
                  <td>{product.name}</td>
                  <td>{formatCents(product.priceCents, product.currency)}</td>
                  <td>
                    <span className={`badge badge-${product.status}`}>{product.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ProductsListPage(): React.ReactElement {
  return (
    <RequireAuth>
      <DashboardLayout>
        <ProductsInner />
      </DashboardLayout>
    </RequireAuth>
  );
}
