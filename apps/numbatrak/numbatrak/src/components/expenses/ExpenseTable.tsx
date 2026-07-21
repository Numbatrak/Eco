import { AgentExpenseWithRelations } from "../../types/expense";
import { ExpenseTableHeader } from "./ExpenseTableHeader";
import { ExpenseTableRow } from "./ExpenseTableRow";
import { Search, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import "./ExpenseTable.css";
import { TableLoadingCell } from "../ui/LoadingState";

interface ExpenseTableProps {
  expenses: AgentExpenseWithRelations[];
  loading: boolean;
  error: string | null;
  onEdit: (expense: AgentExpenseWithRelations) => void;
  onDelete: (expenseId: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: "asc" | "desc";
  onSortChange: (order: "asc" | "desc") => void;
  canEdit?: boolean;
  canDelete?: boolean;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  itemsPerPage?: number;
  totalItems?: number;
}

export function ExpenseTable({
  expenses,
  loading,
  error,
  onEdit,
  onDelete,
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
  canEdit = true,
  canDelete = true,
  currentPage = 1,
  onPageChange,
  itemsPerPage = 10,
  totalItems = 0,
}: ExpenseTableProps) {
  // Calculate pagination
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

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

  return (
    <div className="expense-table-container">
      <div className="expense-table-header">
        <div className="expense-table-header-content">
          <div className="expense-table-title-section">
            <div className="expense-table-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="expense-table-title">Agent Expenses</h2>
              <p className="expense-table-subtitle">
                {totalItems} expense{totalItems !== 1 ? "s" : ""}{" "}
                recorded
              </p>
            </div>
          </div>

          <div className="expense-table-controls">
            {/* Search Input */}
            <div className="expense-table-search">
              <Search className="expense-table-search-icon" />
              <input
                type="text"
                placeholder="Filter expenses..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="expense-table-search-input"
              />
            </div>

            {/* Sort Toggle */}
            <div className="expense-table-sort">
              <button
                onClick={() =>
                  onSortChange(sortOrder === "asc" ? "desc" : "asc")
                }
                className="expense-table-sort-button"
                title={`Sort ${
                  sortOrder === "asc" ? "Descending" : "Ascending"
                }`}
              >
                {sortOrder === "asc" ? (
                  <>
                    <ArrowUp className="expense-table-sort-icon" />
                    <span>Asc</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="expense-table-sort-icon" />
                    <span>Desc</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="expense-table-wrapper">
        <table className="expense-table">
          <ExpenseTableHeader />
          <tbody>
            {loading ? (
              <tr>
                <TableLoadingCell colSpan={6} message="Loading expenses…" />
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="expense-table-error">
                  {error}
                </td>
              </tr>
            ) : expenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="expense-table-empty">
                  No expenses found. Create your first expense to get started.
                </td>
              </tr>
            ) : (
              expenses.map((expense, index) => (
                <ExpenseTableRow
                  key={expense.id}
                  expense={expense}
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="expense-table-pagination">
          <div className="expense-table-pagination-info">
            Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of{" "}
            {totalItems} expenses
          </div>
          <div className="expense-table-pagination-controls">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="expense-table-pagination-button"
              title="Previous page"
            >
              <ChevronLeft className="expense-table-pagination-icon" />
              Previous
            </button>

            <div className="expense-table-pagination-pages">
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
                    className={`expense-table-pagination-page ${
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
              className="expense-table-pagination-button"
              title="Next page"
            >
              Next
              <ChevronRight className="expense-table-pagination-icon" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}






