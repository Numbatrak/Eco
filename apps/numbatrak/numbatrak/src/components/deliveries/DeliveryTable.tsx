import { DeliveryWithRelations } from "../../types/delivery";
import { DeliveryTableHeader } from "./DeliveryTableHeader";
import { DeliveryTableRow } from "./DeliveryTableRow";
import {
  Search,
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  MapPin,
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
  onConfirmPickup?: (deliveryId: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: "asc" | "desc";
  onSortChange: (order: "asc" | "desc") => void;
  locations: string[];
  filters: {
    location?: string;
  };
  onFilterChange: (filters: { location?: string }) => void;
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
  onConfirmPickup,
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
  locations,
  filters,
  onFilterChange,
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

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, location: e.target.value || undefined });
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
                onClick={() => handleFilterClick("location")}
                className={`delivery-table-filter-button ${
                  filters.location ? "active" : ""
                }`}
              >
                <Plus className="delivery-table-filter-icon" />
                Location
                {filters.location && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("location");
                    }}
                    className="delivery-table-filter-remove"
                  >
                    <X className="delivery-table-filter-remove-icon" />
                  </button>
                )}
              </button>
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
            {activeFilter === "location" && (
              <div className="delivery-table-filter-dropdown">
                <label className="delivery-table-filter-label">
                  <MapPin className="delivery-table-filter-label-icon" />
                  Filter by Location
                </label>
                <select
                  value={filters.location || ""}
                  onChange={handleLocationChange}
                  className="delivery-table-filter-select"
                >
                  <option value="">All Locations</option>
                  {locations.map((location) => (
                    <option key={location} value={location}>
                      {location}
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
                <TableLoadingCell colSpan={9} message="Loading deliveries…" />
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={9} className="delivery-table-error">
                  {error}
                </td>
              </tr>
            ) : deliveries.length === 0 ? (
              <tr>
                <td colSpan={9} className="delivery-table-empty">
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
                  onConfirmPickup={onConfirmPickup}
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
