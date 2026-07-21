/** @deprecated Not routed — use OrdersForm + orderIntake. See src/legacy/README.md */
import { OrderWithRelations } from "../../types/order";
import { OrderTableHeader } from "./OrderTableHeader";
import { OrderTableRow } from "./OrderTableRow";
import {
  Search,
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  Calendar,
  User,
  Package,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import "./OrderTable.css";
import { TableLoadingCell } from "../ui/LoadingState";

interface OrderTableProps {
  orders: OrderWithRelations[];
  allOrders?: OrderWithRelations[];
  loading: boolean;
  error: string | null;
  onEdit: (order: OrderWithRelations) => void;
  onDelete: (orderId: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: "asc" | "desc";
  onSortChange: (order: "asc" | "desc") => void;
  filters: {
    date?: string;
    status?: string;
    location?: string;
    product?: string;
  };
  onFilterChange: (filters: {
    date?: string;
    status?: string;
    location?: string;
    product?: string;
  }) => void;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  itemsPerPage?: number;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function OrderTable({
  orders,
  allOrders,
  loading,
  error,
  onEdit,
  onDelete,
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
  filters,
  onFilterChange,
  currentPage = 1,
  onPageChange,
  itemsPerPage = 20,
  canEdit = true,
  canDelete = true,
}: OrderTableProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  console.log("displaying orders", orders);

  // Calculate pagination
  const totalPages = Math.ceil(orders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = orders.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    if (currentPage > 1 && onPageChange) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages && onPageChange) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageClick = (page: number) => {
    if (onPageChange) {
      onPageChange(page);
    }
  };

  const handleFilterClick = (filterType: string) => {
    setActiveFilter(activeFilter === filterType ? null : filterType);
  };

  const handleFilterRemove = (filterType: keyof typeof filters) => {
    onFilterChange({ ...filters, [filterType]: undefined });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, date: e.target.value || undefined });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      status: e.target.value || undefined,
    });
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, location: e.target.value || undefined });
  };

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      product: e.target.value || undefined,
    });
  };

  // Extract unique products from all orders (not just filtered ones)
  const uniqueProducts = Array.from(
    new Set(
      (allOrders || orders)
        .flatMap((order) => [order.product_name, order.product2])
        .filter((product): product is string => !!product)
        .sort()
    )
  );

  return (
    <div className="order-table-container">
      <div className="order-table-header">
        <div className="order-table-header-content">
          <div className="order-table-title-section">
            <div className="order-table-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="order-table-title">Orders</h2>
              <p className="order-table-subtitle">
                {orders.length} order{orders.length !== 1 ? "s" : ""} recorded
                {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
              </p>
            </div>
          </div>

          <div className="order-table-controls">
            {/* Search Input */}
            <div className="order-table-search">
              <Search className="order-table-search-icon" />
              <input
                type="text"
                placeholder="Filter orders..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="order-table-search-input"
              />
            </div>

            {/* Filter Buttons */}
            <div className="order-table-filters">
              <button
                onClick={() => handleFilterClick("date")}
                className={`order-table-filter-button ${
                  filters.date ? "active" : ""
                }`}
              >
                <Plus className="order-table-filter-icon" />
                Date
                {filters.date && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("date");
                    }}
                    className="order-table-filter-remove"
                  >
                    <X className="order-table-filter-remove-icon" />
                  </button>
                )}
              </button>
              <button
                onClick={() => handleFilterClick("status")}
                className={`order-table-filter-button ${
                  filters.status ? "active" : ""
                }`}
              >
                <Plus className="order-table-filter-icon" />
                Status
                {filters.status && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("status");
                    }}
                    className="order-table-filter-remove"
                  >
                    <X className="order-table-filter-remove-icon" />
                  </button>
                )}
              </button>
              <button
                onClick={() => handleFilterClick("location")}
                className={`order-table-filter-button ${
                  filters.location ? "active" : ""
                }`}
              >
                <Plus className="order-table-filter-icon" />
                Location
                {filters.location && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("location");
                    }}
                    className="order-table-filter-remove"
                  >
                    <X className="order-table-filter-remove-icon" />
                  </button>
                )}
              </button>
              <button
                onClick={() => handleFilterClick("product")}
                className={`order-table-filter-button ${
                  filters.product ? "active" : ""
                }`}
              >
                <Plus className="order-table-filter-icon" />
                Product
                {filters.product && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("product");
                    }}
                    className="order-table-filter-remove"
                  >
                    <X className="order-table-filter-remove-icon" />
                  </button>
                )}
              </button>
            </div>

            {/* Sort Toggle */}
            <div className="order-table-sort">
              <button
                onClick={() =>
                  onSortChange(sortOrder === "asc" ? "desc" : "asc")
                }
                className="order-table-sort-button"
                title={`Sort ${
                  sortOrder === "asc" ? "Descending" : "Ascending"
                }`}
              >
                {sortOrder === "asc" ? (
                  <>
                    <ArrowUp className="order-table-sort-icon" />
                    <span>Asc</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="order-table-sort-icon" />
                    <span>Desc</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Filter Dropdowns */}
        {activeFilter && (
          <div className="order-table-filter-dropdowns">
            {activeFilter === "date" && (
              <div className="order-table-filter-dropdown">
                <label className="order-table-filter-label">
                  <Calendar className="order-table-filter-label-icon" />
                  Filter by Date
                </label>
                <input
                  type="date"
                  value={filters.date || ""}
                  onChange={handleDateChange}
                  className="order-table-filter-input"
                />
              </div>
            )}
            {activeFilter === "status" && (
              <div className="order-table-filter-dropdown">
                <label className="order-table-filter-label">
                  <Package className="order-table-filter-label-icon" />
                  Filter by Status
                </label>
                <select
                  value={filters.status || ""}
                  onChange={handleStatusChange}
                  className="order-table-filter-select"
                >
                  <option value="">All Statuses</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Pending">Pending</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            )}
            {activeFilter === "location" && (
              <div className="order-table-filter-dropdown">
                <label className="order-table-filter-label">
                  <User className="order-table-filter-label-icon" />
                  Filter by Location
                </label>
                <input
                  type="text"
                  placeholder="Enter location..."
                  value={filters.location || ""}
                  onChange={handleLocationChange}
                  className="order-table-filter-input"
                />
              </div>
            )}
            {activeFilter === "product" && (
              <div className="order-table-filter-dropdown">
                <label className="order-table-filter-label">
                  <ShoppingBag className="order-table-filter-label-icon" />
                  Filter by Product
                </label>
                <select
                  value={filters.product || ""}
                  onChange={handleProductChange}
                  className="order-table-filter-select"
                >
                  <option value="">All Products</option>
                  {uniqueProducts.map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="order-table-wrapper">
        <table className="order-table">
          <OrderTableHeader />
          <tbody>
            {loading ? (
              <tr>
                <TableLoadingCell colSpan={27} message="Loading orders…" />
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={27} className="order-table-error">
                  {error}
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={27} className="order-table-empty">
                  No orders found. Import your first order to get started.
                </td>
              </tr>
            ) : (
              paginatedOrders.map((order, index) => (
                <OrderTableRow
                  key={order.id}
                  order={order}
                  index={startIndex + index}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="order-table-pagination">
          <div className="order-table-pagination-info">
            Showing {startIndex + 1} to {Math.min(endIndex, orders.length)} of{" "}
            {orders.length} orders
          </div>
          <div className="order-table-pagination-controls">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="order-table-pagination-button"
              title="Previous page"
            >
              <ChevronLeft className="order-table-pagination-icon" />
              Previous
            </button>

            <div className="order-table-pagination-pages">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageClick(pageNum)}
                    className={`order-table-pagination-page ${
                      pageNum === currentPage ? "active" : ""
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="order-table-pagination-button"
              title="Next page"
            >
              Next
              <ChevronRight className="order-table-pagination-icon" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
