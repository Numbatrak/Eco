import { Fragment, useEffect, useState } from "react";
import {
  fetchInventorySummary,
  InventorySummary,
} from "../../services/inventory";
import { fetchProducts } from "../../services/products";
import { Product } from "../../types/product";
import { useOrganization } from "../../contexts/OrganizationContext";
import "./InventoryTable.css";
import { LoadingState } from "../ui/LoadingState";

interface InventoryTableProps {
  refreshTrigger?: number;
}

export function InventoryTable({ refreshTrigger }: InventoryTableProps) {
  const { currentOrganization } = useOrganization();
  const [summary, setSummary] = useState<InventorySummary[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [refreshTrigger, currentOrganization?.id]);

  const loadData = async () => {
    const orgId = currentOrganization?.id ?? null;
    if (!orgId) {
      setSummary([]);
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [summaryData, productsData] = await Promise.all([
        fetchInventorySummary(orgId),
        fetchProducts(orgId),
      ]);
      setSummary(summaryData);
      setProducts(productsData);
    } catch (err) {
      console.error("Error loading inventory:", err);
      setError("Failed to load inventory. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals for each product
  const calculateTotals = () => {
    const totals: Record<
      string,
      { total: number; delivered: number; remaining: number }
    > = {};

    products.forEach((product) => {
      totals[product.id] = { total: 0, delivered: 0, remaining: 0 };
    });

    summary.forEach((agentSummary) => {
      agentSummary.products.forEach((productData) => {
        const productTotal = totals[productData.product_id] || {
          total: 0,
          delivered: 0,
          remaining: 0,
        };
        productTotal.total += productData.total;
        productTotal.delivered += productData.delivered;
        productTotal.remaining += productData.remaining;
        totals[productData.product_id] = productTotal;
      });
    });

    return totals;
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="inventory-table-loading-container">
        <LoadingState label="Loading inventory…" size="md" className="py-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="inventory-table-error-container">{error}</div>
    );
  }

  return (
    <div className="inventory-table-container">
      <div className="inventory-table-header">
        <div className="inventory-table-title-section">
          <div className="inventory-table-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <div>
            <h2 className="inventory-table-title">Inventory Summary</h2>
            <p className="inventory-table-subtitle">
              Product allocation and delivery status by agent
            </p>
          </div>
        </div>
      </div>

      <div className="inventory-table-wrapper">
        <table className="inventory-table">
          <thead>
            <tr>
              <th className="inventory-table-header-cell sticky-left">Agent</th>
              {products.map((product) => (
                <th
                  key={product.id}
                  colSpan={3}
                  className="inventory-table-header-cell text-center border-left"
                >
                  <div className="inventory-table-product-header">
                    <span className="inventory-table-product-name">{product.name}</span>
                    <div className="inventory-table-product-badges">
                      <span className="inventory-table-product-badge">Allocated</span>
                      <span className="inventory-table-product-badge">Delivered</span>
                      <span className="inventory-table-product-badge">Remaining</span>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Total Row */}
            <tr className="total-row">
              <td className="inventory-table-cell total-sticky">Total</td>
              {products.map((product) => {
                const productTotal = totals[product.id] || {
                  total: 0,
                  delivered: 0,
                  remaining: 0,
                };
                return (
                  <Fragment key={product.id}>
                    <td className="inventory-table-cell inventory-table-cell-allocated border-left">
                      {productTotal.total}
                    </td>
                    <td className="inventory-table-cell inventory-table-cell-delivered">
                      {productTotal.delivered}
                    </td>
                    <td className="inventory-table-cell inventory-table-cell-remaining">
                      {productTotal.remaining}
                    </td>
                  </Fragment>
                );
              })}
            </tr>

            {/* Agent Rows */}
            {summary.length === 0 ? (
              <tr>
                <td
                  colSpan={1 + products.length * 3}
                  className="inventory-table-empty"
                >
                  No inventory data found. Add inventory allocations to get
                  started.
                </td>
              </tr>
            ) : (
              summary.map((agentSummary, index) => (
                <tr key={agentSummary.agent_id || "unassigned"}>
                  <td className="inventory-table-cell sticky-left">
                    {agentSummary.agent_name}
                  </td>
                  {products.map((product) => {
                    const productData = agentSummary.products.find(
                      (p) => p.product_id === product.id
                    ) || {
                      product_id: product.id,
                      product_name: product.name,
                      total: 0,
                      delivered: 0,
                      remaining: 0,
                    };
                    return (
                      <Fragment key={product.id}>
                        <td className="inventory-table-cell inventory-table-cell-allocated border-left">
                          {productData.total}
                        </td>
                        <td className="inventory-table-cell inventory-table-cell-delivered">
                          {productData.delivered}
                        </td>
                        <td className="inventory-table-cell inventory-table-cell-remaining">
                          {productData.remaining}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}





