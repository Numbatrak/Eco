import { DeliveryWithRelations } from "../../types/delivery";
import { DeliveryTableHeader } from "./DeliveryTableHeader";
import { DeliveryTableRow } from "./DeliveryTableRow";
import {
  Search,
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  Calendar,
  User,
  FileText,
  Package,
} from "lucide-react";
import { useState } from "react";
import { TablePagination } from "../ui/TablePagination";
import "./DeliveryTable.css";
import { TableLoadingCell } from "../ui/LoadingState";

interface DeliveryTableProps {
  deliveries: DeliveryWithRelations[];
  loading: boolean;
  error: string | null;
  onEdit: (delivery: DeliveryWithRelations) => void;
  onDelete: (deliveryId: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: "asc" | "desc";
  onSortChange: (order: "asc" | "desc") => void;
  agents: Array<{ id: number; name: string }>;
  products: Array<{ id: string; name: string }>;
  filters: {
    date?: string;
    agentId?: number;
    csr?: string;
    productId?: string;
    status?: "Waybilled" | "Delivered";
    month?: string;
    subBrand?: string;
  };
  onFilterChange: (filters: {
    date?: string;
    agentId?: number;
    csr?: string;
    productId?: string;
    status?: "Waybilled" | "Delivered";
    month?: string;
    subBrand?: string;
  }) => void;
  subBrandOptions?: string[];
  canEdit?: boolean;
  canDelete?: boolean;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  itemsPerPage?: number;
  totalItems?: number;
}

export function DeliveryTable({
  deliveries,
  loading,
  error,
  onEdit,
  onDelete,
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
  agents,
  products,
  filters,
  onFilterChange,
  subBrandOptions = [],
  canEdit = true,
  canDelete = true,
  currentPage = 1,
  onPageChange,
  itemsPerPage = 20,
  totalItems,
}: DeliveryTableProps) {
  const itemCount = totalItems ?? deliveries.length;
  const totalPages = Math.ceil(itemCount / itemsPerPage);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const handleFilterClick = (filterType: string) => {
    setActiveFilter(activeFilter === filterType ? null : filterType);
  };

  const handleFilterRemove = (filterType: keyof typeof filters) => {
    onFilterChange({ ...filters, [filterType]: undefined });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, date: e.target.value || undefined });
  };

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      agentId: e.target.value ? parseInt(e.target.value) : undefined,
    });
  };

  const handleCSRChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, csr: e.target.value || undefined });
  };

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      productId: e.target.value || undefined,
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFilterChange({
      ...filters,
      status:
        value === "Waybilled" || value === "Delivered" ? value : undefined,
    });
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, month: e.target.value || undefined });
  };

  const handleSubBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({
      ...filters,
      subBrand: e.target.value || undefined,
    });
  };

  return (
    <div className="delivery-table-container">
      <div className="delivery-table-header">
        <div className="delivery-table-header-content">
          <div className="delivery-table-title-section">
            <div className="delivery-table-icon">
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
              <h2 className="delivery-table-title">Deliveries & Waybills</h2>
              <p className="delivery-table-subtitle">
                {deliveries.length} delivery{deliveries.length !== 1 ? "s" : ""}{" "}
                recorded
              </p>
            </div>
          </div>

          <div className="delivery-table-controls">
            {/* Search Input */}
            <div className="delivery-table-search">
              <Search className="delivery-table-search-icon" />
              <input
                type="text"
                placeholder="Filter deliveries..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="delivery-table-search-input"
              />
            </div>

            {/* Filter Buttons */}
            <div className="delivery-table-filters">
              <button
                onClick={() => handleFilterClick("date")}
                className={`delivery-table-filter-button ${
                  filters.date ? "active" : ""
                }`}
              >
                <Plus className="delivery-table-filter-icon" />
                Date
                {filters.date && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("date");
                    }}
                    className="delivery-table-filter-remove"
                  >
                    <X className="delivery-table-filter-remove-icon" />
                  </button>
                )}
              </button>
              <button
                onClick={() => handleFilterClick("agent")}
                className={`delivery-table-filter-button ${
                  filters.agentId ? "active" : ""
                }`}
              >
                <Plus className="delivery-table-filter-icon" />
                Agent
                {filters.agentId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("agentId");
                    }}
                    className="delivery-table-filter-remove"
                  >
                    <X className="delivery-table-filter-remove-icon" />
                  </button>
                )}
              </button>
              <button
                onClick={() => handleFilterClick("csr")}
                className={`delivery-table-filter-button ${
                  filters.csr ? "active" : ""
                }`}
              >
                <Plus className="delivery-table-filter-icon" />
                CSR
                {filters.csr && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("csr");
                    }}
                    className="delivery-table-filter-remove"
                  >
                    <X className="delivery-table-filter-remove-icon" />
                  </button>
                )}
              </button>
              <button
                onClick={() => handleFilterClick("product")}
                className={`delivery-table-filter-button ${
                  filters.productId ? "active" : ""
                }`}
              >
                <Plus className="delivery-table-filter-icon" />
                Name
                {filters.productId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("productId");
                    }}
                    className="delivery-table-filter-remove"
                  >
                    <X className="delivery-table-filter-remove-icon" />
                  </button>
                )}
              </button>
              <button
                onClick={() => handleFilterClick("status")}
                className={`delivery-table-filter-button ${
                  filters.status ? "active" : ""
                }`}
              >
                <Plus className="delivery-table-filter-icon" />
                Status
                {filters.status && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("status");
                    }}
                    className="delivery-table-filter-remove"
                  >
                    <X className="delivery-table-filter-remove-icon" />
                  </button>
                )}
              </button>
              <button
                onClick={() => handleFilterClick("month")}
                className={`delivery-table-filter-button ${
                  filters.month ? "active" : ""
                }`}
              >
                <Plus className="delivery-table-filter-icon" />
                Month
                {filters.month && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("month");
                    }}
                    className="delivery-table-filter-remove"
                  >
                    <X className="delivery-table-filter-remove-icon" />
                  </button>
                )}
              </button>
              {subBrandOptions.length > 0 && (
                <button
                  onClick={() => handleFilterClick("subBrand")}
                  className={`delivery-table-filter-button ${
                    filters.subBrand ? "active" : ""
                  }`}
                >
                  <Plus className="delivery-table-filter-icon" />
                  Sub-brand
                  {filters.subBrand && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFilterRemove("subBrand");
                      }}
                      className="delivery-table-filter-remove"
                    >
                      <X className="delivery-table-filter-remove-icon" />
                    </button>
                  )}
                </button>
              )}
            </div>

            {/* Sort Toggle */}
            <div className="delivery-table-sort">
              <button
                onClick={() =>
                  onSortChange(sortOrder === "asc" ? "desc" : "asc")
                }
                className="delivery-table-sort-button"
                title={`Sort ${
                  sortOrder === "asc" ? "Descending" : "Ascending"
                }`}
              >
                {sortOrder === "asc" ? (
                  <>
                    <ArrowUp className="delivery-table-sort-icon" />
                    <span>Asc</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="delivery-table-sort-icon" />
                    <span>Desc</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Filter Dropdowns */}
        {activeFilter && (
          <div className="delivery-table-filter-dropdowns">
            {activeFilter === "date" && (
              <div className="delivery-table-filter-dropdown">
                <label className="delivery-table-filter-label">
                  <Calendar className="delivery-table-filter-label-icon" />
                  Filter by Date
                </label>
                <input
                  type="date"
                  value={filters.date || ""}
                  onChange={handleDateChange}
                  className="delivery-table-filter-input"
                />
              </div>
            )}
            {activeFilter === "agent" && (
              <div className="delivery-table-filter-dropdown">
                <label className="delivery-table-filter-label">
                  <User className="delivery-table-filter-label-icon" />
                  Filter by Agent
                </label>
                <select
                  value={filters.agentId || ""}
                  onChange={handleAgentChange}
                  className="delivery-table-filter-select"
                >
                  <option value="">All Agents</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {activeFilter === "csr" && (
              <div className="delivery-table-filter-dropdown">
                <label className="delivery-table-filter-label">
                  <FileText className="delivery-table-filter-label-icon" />
                  Filter by CSR
                </label>
                <input
                  type="text"
                  placeholder="Enter CSR..."
                  value={filters.csr || ""}
                  onChange={handleCSRChange}
                  className="delivery-table-filter-input"
                />
              </div>
            )}
            {activeFilter === "product" && (
              <div className="delivery-table-filter-dropdown">
                <label className="delivery-table-filter-label">
                  <Package className="delivery-table-filter-label-icon" />
                  Filter by Product Name
                </label>
                <select
                  value={filters.productId || ""}
                  onChange={handleProductChange}
                  className="delivery-table-filter-select"
                >
                  <option value="">All Products</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {activeFilter === "status" && (
              <div className="delivery-table-filter-dropdown">
                <label className="delivery-table-filter-label">
                  <FileText className="delivery-table-filter-label-icon" />
                  Filter by Status
                </label>
                <select
                  value={filters.status || ""}
                  onChange={handleStatusChange}
                  className="delivery-table-filter-select"
                >
                  <option value="">All statuses</option>
                  <option value="Waybilled">Waybilled</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </div>
            )}
            {activeFilter === "month" && (
              <div className="delivery-table-filter-dropdown">
                <label className="delivery-table-filter-label">
                  <Calendar className="delivery-table-filter-label-icon" />
                  Filter by Month
                </label>
                <input
                  type="month"
                  value={filters.month || ""}
                  onChange={handleMonthChange}
                  className="delivery-table-filter-input"
                />
              </div>
            )}
            {activeFilter === "subBrand" && subBrandOptions.length > 0 && (
              <div className="delivery-table-filter-dropdown">
                <label className="delivery-table-filter-label">
                  <FileText className="delivery-table-filter-label-icon" />
                  Filter by Sub-brand
                </label>
                <select
                  value={filters.subBrand || ""}
                  onChange={handleSubBrandChange}
                  className="delivery-table-filter-select"
                >
                  <option value="">All sub-brands</option>
                  {subBrandOptions.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="delivery-table-wrapper">
        <table className="delivery-table">
          <DeliveryTableHeader />
          <tbody>
            {loading ? (
              <tr>
                <TableLoadingCell colSpan={10} message="Loading deliveries…" />
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={10} className="delivery-table-error">
                  {error}
                </td>
              </tr>
            ) : deliveries.length === 0 ? (
              <tr>
                <td colSpan={10} className="delivery-table-empty">
                  No deliveries found. Create your first delivery to get
                  started.
                </td>
              </tr>
            ) : (
              deliveries.map((delivery, index) => (
                <DeliveryTableRow
                  key={delivery.id}
                  delivery={delivery}
                  index={index}
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

      {onPageChange && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={itemCount}
          itemsPerPage={itemsPerPage}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
