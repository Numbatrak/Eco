import { Table, TableBody } from "../ui/table";
import { ProductWithDetails } from "../../types/product";
import { ProductTableHeader } from "./ProductTableHeader";
import { ProductTableRow } from "./ProductTableRow";
import { Search, ArrowUp, ArrowDown } from "lucide-react";
import { useClientPagination } from "../../hooks/useClientPagination";
import { TablePagination } from "../ui/TablePagination";
import { TableLoadingCell } from "../ui/LoadingState";

interface ProductTableProps {
  products: ProductWithDetails[];
  loading: boolean;
  error: string | null;
  onEdit: (product: ProductWithDetails) => void;
  onDelete: (productId: number | string) => void;
  onSetActive?: (product: ProductWithDetails, active: boolean) => void;
  onManageOffers: (product: ProductWithDetails) => void;
  onManageVariants?: (product: ProductWithDetails) => void;
  onReceiveStock?: (product: ProductWithDetails) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: "asc" | "desc";
  onSortChange: (order: "asc" | "desc") => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function ProductTable({
  products,
  loading,
  error,
  onEdit,
  onDelete,
  onSetActive,
  onManageOffers,
  onManageVariants,
  onReceiveStock,
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
  canEdit = true,
  canDelete = true,
}: ProductTableProps) {
  const {
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
  } = useClientPagination(products);

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-border bg-muted/40">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary p-2">
              <svg
                className="h-5 w-5 text-primary-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Products</h2>
              <p className="text-xs font-medium text-muted-foreground">
                {products.length} product{products.length !== 1 ? "s" : ""}{" "}
                registered
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-64 rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-1">
              <button
                type="button"
                onClick={() =>
                  onSortChange(sortOrder === "asc" ? "desc" : "asc")
                }
                className="flex items-center gap-2 rounded px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                title={`Sort ${
                  sortOrder === "asc" ? "Descending" : "Ascending"
                }`}
              >
                {sortOrder === "asc" ? (
                  <>
                    <ArrowUp className="w-4 h-4" />
                    <span>Asc</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-4 h-4" />
                    <span>Desc</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Table>
        <ProductTableHeader />
        <TableBody>
          {loading ? (
            <tr>
              <TableLoadingCell colSpan={7} message="Loading products…" />
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center text-destructive">
                {error}
              </td>
            </tr>
          ) : paginatedItems.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                No products found. Create your first product to get started.
              </td>
            </tr>
          ) : (
            paginatedItems.map((product, index) => (
              <ProductTableRow
                key={product.id}
                product={product}
                index={(currentPage - 1) * itemsPerPage + index}
                onEdit={onEdit}
                onDelete={onDelete}
                onSetActive={onSetActive}
                onManageOffers={onManageOffers}
                onManageVariants={onManageVariants}
                onReceiveStock={onReceiveStock}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ))
          )}
        </TableBody>
      </Table>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}








