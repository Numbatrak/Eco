"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductVariant } from "@platform/shared-types";
import { commerceApi } from "../../../lib/commerceApi";
import { ApiError } from "../../../lib/apiClient";

export function VariantEditor({ productId }: { productId: string }): React.ReactElement {
  const [variants, setVariants] = useState<ProductVariant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newSize, setNewSize] = useState("");
  const [newColor, setNewColor] = useState("");
  const [newStock, setNewStock] = useState(0);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const { variants: list } = await commerceApi.listVariants(productId);
      setVariants(list);
    } catch {
      setError("Could not load variants.");
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd(): Promise<void> {
    if (!newSize.trim() || !newColor.trim()) return;
    setError(null);
    setAdding(true);
    try {
      await commerceApi.createVariant(productId, {
        size: newSize.trim(),
        color: newColor.trim(),
        stockCount: newStock,
      });
      setNewSize("");
      setNewColor("");
      setNewStock(0);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add this variant.");
    } finally {
      setAdding(false);
    }
  }

  async function handleStockChange(variant: ProductVariant, stockCount: number): Promise<void> {
    setVariants((current) =>
      current ? current.map((v) => (v.id === variant.id ? { ...v, stockCount } : v)) : current,
    );
    try {
      await commerceApi.updateVariant(productId, variant.id, { stockCount });
    } catch {
      setError("Could not update stock.");
      await load();
    }
  }

  async function handleAvailableChange(variant: ProductVariant, isAvailable: boolean): Promise<void> {
    setVariants((current) =>
      current ? current.map((v) => (v.id === variant.id ? { ...v, isAvailable } : v)) : current,
    );
    try {
      await commerceApi.updateVariant(productId, variant.id, { isAvailable });
    } catch {
      setError("Could not update availability.");
      await load();
    }
  }

  async function handleDelete(variant: ProductVariant): Promise<void> {
    try {
      await commerceApi.deleteVariant(productId, variant.id);
      await load();
    } catch {
      setError("Could not remove this variant.");
    }
  }

  return (
    <div className="panel" style={{ padding: "var(--space-5)", marginTop: "var(--space-5)", maxWidth: 480 }}>
      <h2 style={{ marginBottom: "var(--space-3)" }}>Variants</h2>
      <p className="field-hint" style={{ marginBottom: "var(--space-3)" }}>
        Size/color combinations customers pick from. Leave empty to sell this product without variants.
      </p>

      {error ? (
        <div className="banner banner-danger" role="alert" style={{ marginBottom: "var(--space-3)" }}>
          {error}
        </div>
      ) : null}

      {variants === null ? (
        <p className="field-hint">Loading…</p>
      ) : variants.length === 0 ? (
        <p className="field-hint" style={{ marginBottom: "var(--space-3)" }}>
          No variants yet.
        </p>
      ) : (
        <table className="data-table" style={{ marginBottom: "var(--space-4)" }}>
          <thead>
            <tr>
              <th>Size</th>
              <th>Color</th>
              <th>Stock</th>
              <th>Available</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => (
              <tr key={variant.id}>
                <td>{variant.size}</td>
                <td>{variant.color}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    className="text-input"
                    style={{ width: 80 }}
                    value={variant.stockCount}
                    onChange={(event) =>
                      void handleStockChange(variant, Math.max(0, Number(event.target.value)))
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={variant.isAvailable}
                    onChange={(event) => void handleAvailableChange(variant, event.target.checked)}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  <button type="button" className="btn-link" onClick={() => void handleDelete(variant)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div className="field">
          <label className="field-label" htmlFor="new-variant-size">
            Size
          </label>
          <input
            id="new-variant-size"
            className="text-input"
            style={{ width: 90 }}
            value={newSize}
            onChange={(event) => setNewSize(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="new-variant-color">
            Color
          </label>
          <input
            id="new-variant-color"
            className="text-input"
            style={{ width: 110 }}
            value={newColor}
            onChange={(event) => setNewColor(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="new-variant-stock">
            Stock
          </label>
          <input
            id="new-variant-stock"
            type="number"
            min={0}
            className="text-input"
            style={{ width: 80 }}
            value={newStock}
            onChange={(event) => setNewStock(Math.max(0, Number(event.target.value)))}
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={adding || !newSize.trim() || !newColor.trim()}
          onClick={() => void handleAdd()}
        >
          {adding ? "Adding…" : "Add variant"}
        </button>
      </div>
    </div>
  );
}
