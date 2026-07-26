import { FollowUpWithRelations, FollowUpStatus, FollowUpPriority } from "../../types/followUp";
import { FollowUpTableHeader } from "./FollowUpTableHeader";
import { FollowUpTableRow } from "./FollowUpTableRow";
import {
  Search,
  ArrowUp,
  ArrowDown,
  X,
  Calendar,
  User,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { TableLoadingCell } from "../ui/LoadingState";

interface FollowUpTableProps {
  followUps: FollowUpWithRelations[];
  loading: boolean;
  error: string | null;
  onEdit: (followUp: FollowUpWithRelations) => void;
  onDelete: (followUpId: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: "asc" | "desc";
  onSortChange: (order: "asc" | "desc") => void;
  filters: {
    assigned_to?: string;
    status?: FollowUpStatus;
    priority?: FollowUpPriority;
    dateFrom?: string;
    dateTo?: string;
  };
  onFilterChange: (filters: {
    assigned_to?: string;
    status?: FollowUpStatus;
    priority?: FollowUpPriority;
    dateFrom?: string;
    dateTo?: string;
  }) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  totalItems: number;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function FollowUpTable({
  followUps,
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
  currentPage,
  onPageChange,
  itemsPerPage,
  totalItems,
  canEdit = true,
  canDelete = true,
}: FollowUpTableProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handleFilterClick = (filterType: string) => {
    setActiveFilter(activeFilter === filterType ? null : filterType);
  };

  const handleFilterRemove = (filterType: keyof typeof filters) => {
    onFilterChange({ ...filters, [filterType]: undefined });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFilterChange({
      ...filters,
      status: value === "" ? undefined : (value as FollowUpStatus),
    });
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFilterChange({
      ...filters,
      priority: value === "" ? undefined : (value as FollowUpPriority),
    });
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, dateFrom: e.target.value || undefined });
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, dateTo: e.target.value || undefined });
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
    <div className="follow-up-table-container">
      <div className="follow-up-table-header">
        <div className="follow-up-table-header-content">
          <div className="follow-up-table-title-section">
            <div className="follow-up-table-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <div>
              <h2 className="follow-up-table-title">Follow-Ups</h2>
              <p className="follow-up-table-subtitle">
                {totalItems} follow-up{totalItems !== 1 ? "s" : ""} tracked
              </p>
            </div>
          </div>

          <div className="follow-up-table-controls">
            <div className="follow-up-table-search">
              <Search className="follow-up-table-search-icon" />
              <input
                type="text"
                placeholder="Search follow-ups..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="follow-up-table-search-input"
              />
            </div>

            <div className="follow-up-table-filters">
              <button
                onClick={() => handleFilterClick("status")}
                className={`follow-up-table-filter-button ${
                  filters.status ? "active" : ""
                }`}
              >
                <Filter className="follow-up-table-filter-icon" />
                Status
                {filters.status && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("status");
                    }}
                    className="follow-up-table-filter-remove"
                  >
                    <X className="follow-up-table-filter-remove-icon" />
                  </button>
                )}
              </button>
              <button
                onClick={() => handleFilterClick("priority")}
                className={`follow-up-table-filter-button ${
                  filters.priority ? "active" : ""
                }`}
              >
                <Filter className="follow-up-table-filter-icon" />
                Priority
                {filters.priority && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("priority");
                    }}
                    className="follow-up-table-filter-remove"
                  >
                    <X className="follow-up-table-filter-remove-icon" />
                  </button>
                )}
              </button>
              <button
                onClick={() => handleFilterClick("date")}
                className={`follow-up-table-filter-button ${
                  filters.dateFrom || filters.dateTo ? "active" : ""
                }`}
              >
                <Calendar className="follow-up-table-filter-icon" />
                Date
                {(filters.dateFrom || filters.dateTo) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFilterRemove("dateFrom");
                      handleFilterRemove("dateTo");
                    }}
                    className="follow-up-table-filter-remove"
                  >
                    <X className="follow-up-table-filter-remove-icon" />
                  </button>
                )}
              </button>
            </div>

            <div className="follow-up-table-sort">
              <button
                onClick={() =>
                  onSortChange(sortOrder === "asc" ? "desc" : "asc")
                }
                className="follow-up-table-sort-button"
                title={`Sort ${
                  sortOrder === "asc" ? "Descending" : "Ascending"
                }`}
              >
                {sortOrder === "asc" ? (
                  <>
                    <ArrowUp className="follow-up-table-sort-icon" />
                    <span>Asc</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="follow-up-table-sort-icon" />
                    <span>Desc</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {activeFilter && (
          <div className="follow-up-table-filter-dropdowns">
            {activeFilter === "status" && (
              <div className="follow-up-table-filter-dropdown">
                <label className="follow-up-table-filter-label">
                  <Filter className="follow-up-table-filter-label-icon" />
                  Filter by Status
                </label>
                <select
                  value={filters.status || ""}
                  onChange={handleStatusChange}
                  className="follow-up-table-filter-select"
                >
                  <option value="">All Statuses</option>
                  <option value="awaiting">Awaiting follow-up</option>
                  <option value="followed_up">Followed up</option>
                  <option value="resolved">Resolved</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}
            {activeFilter === "priority" && (
              <div className="follow-up-table-filter-dropdown">
                <label className="follow-up-table-filter-label">
                  <Filter className="follow-up-table-filter-label-icon" />
                  Filter by Priority
                </label>
                <select
                  value={filters.priority || ""}
                  onChange={handlePriorityChange}
                  className="follow-up-table-filter-select"
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            )}
            {activeFilter === "date" && (
              <>
                <div className="follow-up-table-filter-dropdown">
                  <label className="follow-up-table-filter-label">
                    <Calendar className="follow-up-table-filter-label-icon" />
                    From Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom || ""}
                    onChange={handleDateFromChange}
                    className="follow-up-table-filter-input"
                  />
                </div>
                <div className="follow-up-table-filter-dropdown">
                  <label className="follow-up-table-filter-label">
                    <Calendar className="follow-up-table-filter-label-icon" />
                    To Date
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo || ""}
                    onChange={handleDateToChange}
                    className="follow-up-table-filter-input"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="follow-up-table-wrapper">
        <table className="follow-up-table">
          <FollowUpTableHeader />
          <tbody>
            {loading ? (
              <tr>
                <TableLoadingCell colSpan={9} message="Loading follow-ups…" />
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={9} className="follow-up-table-error">
                  {error}
                </td>
              </tr>
            ) : followUps.length === 0 ? (
              <tr>
                <td colSpan={9} className="follow-up-table-empty">
                  No follow-ups found.
                </td>
              </tr>
            ) : (
              followUps.map((followUp, index) => (
                <FollowUpTableRow
                  key={followUp.id}
                  followUp={followUp}
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






