import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPaginationRange } from "../../lib/pagination";

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className = "",
}: TablePaginationProps) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);
  const pages = getPaginationRange(currentPage, totalPages);

  return (
    <div className={`table-pagination ${className}`.trim()}>
      <p className="table-pagination-summary">
        {start} to {end} of {totalItems}
      </p>
      <div className="table-pagination-controls">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="table-pagination-button"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        <div className="table-pagination-pages">
          {pages.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={`table-pagination-page ${
                currentPage === page ? "active" : ""
              }`}
              aria-label={`Page ${page}`}
              aria-current={currentPage === page ? "page" : undefined}
            >
              {page}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="table-pagination-button"
          aria-label="Next page"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
