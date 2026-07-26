import { AbandonedCartWithRelations } from "../../types/abandonedCart";
import { AbandonedCartFilters } from "../../services/abandonedCarts";
import { AbandonedCartTableHeader } from "./AbandonedCartTableHeader";
import { AbandonedCartTableRow } from "./AbandonedCartTableRow";
import {
  Search,
  ArrowUp,
  ArrowDown,
  X,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import "./AbandonedCartTable.css";
import { TableLoadingCell } from "../ui/LoadingState";

interface AbandonedCartTableProps {
  carts: AbandonedCartWithRelations[];
  loading: boolean;
  error: string | null;
  onEdit: (cart: AbandonedCartWithRelations) => void;
  onDelete: (cartId: string) => void;
  onConvert: (cart: AbandonedCartWithRelations) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: "asc" | "desc";
  onSortChange: (order: "asc" | "desc") => void;
  filters: AbandonedCartFilters;
  onFilterChange: (filters: AbandonedCartFilters) => void;
  formList?: { id: string; name: string }[];
  funnelOptions?: string[];
  productOptions?: { id: string; name: string }[];
  currentPage: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  totalItems: number;
  canEdit?: boolean;
  canDelete?: boolean;
  onFollowUpSuccess?: (message: string) => void;
  onFollowUpError?: (message: string) => void;
}

export function AbandonedCartTable({
  carts,
  loading,
  error,
  onEdit,
  onDelete,
  onConvert,
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
  filters,
  onFilterChange,
  formList = [],
  funnelOptions = [],
  productOptions = [],
  currentPage,
  onPageChange,
  itemsPerPage,
  totalItems,
  canEdit = true,
  canDelete = true,
  onFollowUpSuccess,
  onFollowUpError,
}: AbandonedCartTableProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handleFilterClick = (filterType: string) => {
    setActiveFilter(activeFilter === filterType ? null : filterType);
  };

  const handleFilterRemove = (filterType: keyof typeof filters) => {
    onFilterChange({ ...filters, [filterType]: undefined });
  };

  const handleConvertedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFilterChange({
      ...filters,
      converted: value === "" ? undefined : value === "true",
    });
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, dateFrom: e.target.value || undefined });
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, dateTo: e.target.value || undefined });
  };

  const formSelectValue = filters.formId ?? "all";
  const handleFormSelect = (value: string) => {
    onFilterChange({
      ...filters,
      formId: value === "all" ? undefined : value,
    });
  };

  const funnelSelectValue = filters.funnelName ?? "all";
  const handleFunnelSelect = (value: string) => {
    onFilterChange({
      ...filters,
      funnelName: value === "all" ? undefined : value,
    });
  };

  const productSelectValue = filters.productId ?? "all";
  const handleProductSelect = (value: string) => {
    onFilterChange({
      ...filters,
      productId: value === "all" ? undefined : value,
    });
  };

  const renderPageNumbers = () => {
    const pageNumbers = [];
    const maxPageButtons = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

    if (endPage - startPage + 1 < maxPageButtons) {
      startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <button
          key={i}
          onClick={() => onPageChange(i)}
          className={`pagination-button ${currentPage === i ? "active" : ""}`}
        >
          {i}
        </button>
      );
    }
    return pageNumbers;
  };

  return (
    <div className="abandoned-cart-table-container">
      <div className="abandoned-cart-table-header">
        <div className="abandoned-cart-table-header-content">
          <div className="abandoned-cart-table-title-section">
            <div className="abandoned-cart-table-icon">
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
              <h2 className="abandoned-cart-table-title">Abandoned Carts</h2>
              <p className="abandoned-cart-table-subtitle">
                {totalItems} cart{totalItems !== 1 ? "s" : ""} abandoned
              </p>
            </div>
          </div>

          <div className="abandoned-cart-table-controls">
            <div className="abandoned-cart-table-search">
              <Search className="abandoned-cart-table-search-icon" />
              <input
                type="text"
                placeholder="Search carts..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="abandoned-cart-table-search-input"
              />
            </div>

            {formList.length > 0 && (
              <div
                className="flex items-center gap-2 shrink-0"
                style={{ minWidth: "200px", maxWidth: "min(100%, 320px)" }}
              >
                <FileText
                  className="w-4 h-4 text-muted-foreground shrink-0"
                  aria-hidden
                />
                <Select value={formSelectValue} onValueChange={handleFormSelect}>
                  <SelectTrigger
                    className="w-full border-border bg-background h-9 text-sm"
                    aria-label="Filter by form"
                  >
                    <SelectValue placeholder="All forms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All forms</SelectItem>
                    {formList.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {funnelOptions.length > 0 && (
              <div
                className="flex items-center gap-2 shrink-0"
                style={{ minWidth: "180px", maxWidth: "min(100%, 280px)" }}
              >
                <Select value={funnelSelectValue} onValueChange={handleFunnelSelect}>
                  <SelectTrigger
                    className="w-full border-border bg-background h-9 text-sm"
                    aria-label="Filter by funnel"
                  >
                    <SelectValue placeholder="All funnels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All funnels</SelectItem>
                    {funnelOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {productOptions.length > 0 && (
              <div
                className="flex items-center gap-2 shrink-0"
                style={{ minWidth: "180px", maxWidth: "min(100%, 280px)" }}
              >
                <Select value={productSelectValue} onValueChange={handleProductSelect}>
                  <SelectTrigger
                    className="w-full border-border bg-background h-9 text-sm"
                    aria-label="Filter by product"
                  >
                    <SelectValue placeholder="All products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All products</SelectItem>
                    {productOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="abandoned-cart-table-filters">
              <button
                onClick={() => handleFilterClick("converted")}
                className={`abandoned-cart-table-filter-button ${
                  filters.converted !== undefined ? "active" : ""
                }`}
              >
                <Filter className="abandoned-cart-table-filter-icon" />
                Status
                {filters.converted !== undefined && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("converted");
                    }}
                    className="abandoned-cart-table-filter-remove"
                  >
                    <X className="abandoned-cart-table-filter-remove-icon" />
                  </button>
                )}
              </button>
              <button
                onClick={() => handleFilterClick("date")}
                className={`abandoned-cart-table-filter-button ${
                  filters.dateFrom || filters.dateTo ? "active" : ""
                }`}
              >
                <Calendar className="abandoned-cart-table-filter-icon" />
                Date
                {(filters.dateFrom || filters.dateTo) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("dateFrom");
                      handleFilterRemove("dateTo");
                    }}
                    className="abandoned-cart-table-filter-remove"
                  >
                    <X className="abandoned-cart-table-filter-remove-icon" />
                  </button>
                )}
              </button>
            </div>

            <div className="abandoned-cart-table-sort">
              <button
                onClick={() =>
                  onSortChange(sortOrder === "asc" ? "desc" : "asc")
                }
                className="abandoned-cart-table-sort-button"
                title={`Sort ${
                  sortOrder === "asc" ? "Descending" : "Ascending"
                }`}
              >
                {sortOrder === "asc" ? (
                  <>
                    <ArrowUp className="abandoned-cart-table-sort-icon" />
                    <span>Asc</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="abandoned-cart-table-sort-icon" />
                    <span>Desc</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {activeFilter && (
          <div className="abandoned-cart-table-filter-dropdowns">
            {activeFilter === "converted" && (
              <div className="abandoned-cart-table-filter-dropdown">
                <label className="abandoned-cart-table-filter-label">
                  <Filter className="abandoned-cart-table-filter-label-icon" />
                  Filter by Conversion Status
                </label>
                <select
                  value={
                    filters.converted === undefined
                      ? ""
                      : filters.converted.toString()
                  }
                  onChange={handleConvertedChange}
                  className="abandoned-cart-table-filter-select"
                >
                  <option value="">All</option>
                  <option value="true">Converted</option>
                  <option value="false">Not Converted</option>
                </select>
              </div>
            )}
            {activeFilter === "date" && (
              <>
                <div className="abandoned-cart-table-filter-dropdown">
                  <label className="abandoned-cart-table-filter-label">
                    <Calendar className="abandoned-cart-table-filter-label-icon" />
                    From Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom || ""}
                    onChange={handleDateFromChange}
                    className="abandoned-cart-table-filter-input"
                  />
                </div>
                <div className="abandoned-cart-table-filter-dropdown">
                  <label className="abandoned-cart-table-filter-label">
                    <Calendar className="abandoned-cart-table-filter-label-icon" />
                    To Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo || ""}
                    onChange={handleDateToChange}
                    className="abandoned-cart-table-filter-input"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="abandoned-cart-table-wrapper">
        <table className="abandoned-cart-table">
          <AbandonedCartTableHeader />
          <tbody>
            {loading ? (
              <tr>
                <TableLoadingCell colSpan={11} message="Loading abandoned carts…" />
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={11} className="abandoned-cart-table-error">
                  {error}
                </td>
              </tr>
            ) : carts.length === 0 ? (
              <tr>
                <td colSpan={11} className="abandoned-cart-table-empty">
                  No abandoned carts found.
                </td>
              </tr>
            ) : (
              carts.map((cart, index) => (
                <AbandonedCartTableRow
                  key={cart.id}
                  cart={cart}
                  index={index}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onConvert={onConvert}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onFollowUpSuccess={onFollowUpSuccess}
                  onFollowUpError={onFollowUpError}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="pagination-button"
          >
            <ChevronLeft className="pagination-icon" />
            Previous
          </button>
          <div className="page-numbers">{renderPageNumbers()}</div>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="pagination-button"
          >
            Next
            <ChevronRight className="pagination-icon" />
          </button>
        </div>
      )}
    </div>
  );
}






