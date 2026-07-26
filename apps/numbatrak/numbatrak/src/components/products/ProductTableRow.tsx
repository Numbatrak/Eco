import { TableCell, TableRow } from "../ui/table";
import { ProductWithDetails } from "../../types/product";
import {
  Pencil,
  Trash2,
  Tag,
  Package,
  Ban,
  RotateCcw,
  Layers,
} from "lucide-react";
import { formatNaira, formatShortId } from "../../utils/currency";

interface ProductTableRowProps {
  product: ProductWithDetails;
  index: number;
  onEdit: (product: ProductWithDetails) => void;
  onDelete: (productId: number | string) => void;
  onSetActive?: (product: ProductWithDetails, active: boolean) => void;
  onManageOffers: (product: ProductWithDetails) => void;
  onManageVariants?: (product: ProductWithDetails) => void;
  onReceiveStock?: (product: ProductWithDetails) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function ProductTableRow({
  product,
  index,
  onEdit,
  onDelete,
  onSetActive,
  onManageOffers,
  onManageVariants,
  onReceiveStock,
  canEdit = true,
  canDelete = true,
}: ProductTableRowProps) {
  const activeOffers = product.offers?.filter((o) => o.active).length ?? 0;
  const variantCount = product.variants?.filter((v) => v.active).length ?? 0;
  const isActive = product.active !== false;
  const perf = product.performance;

  return (
    <TableRow
      className={`${
        index % 2 === 0 ? "bg-card" : "bg-muted/30"
      } transition-colors hover:bg-accent/50 ${!isActive ? "opacity-75" : ""}`}
    >
      <TableCell className="px-6 py-4 max-w-[7rem]">
        <code
          className="block truncate font-mono text-xs font-semibold text-muted-foreground"
          title={String(product.id)}
        >
          {formatShortId(product.id)}
        </code>
      </TableCell>
      <TableCell className="px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-metric text-sm font-bold text-primary-foreground">
            {product.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-foreground">{product.name}</span>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatNaira(product.base_price ?? 0, { decimals: 0 })}
              {product.category ? ` · ${product.category}` : ""}
              {product.sub_brand ? ` · ${product.sub_brand}` : ""}
            </p>
            {variantCount > 0 && (
              <p className="text-xs text-primary">{variantCount} variant(s)</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="px-6 py-4">
        <span className="font-metric text-sm font-semibold text-foreground">
          {(product.stock_on_hand ?? 0).toLocaleString("en-NG")}
        </span>
        <p className="text-xs text-muted-foreground">from inventory</p>
      </TableCell>
      <TableCell className="px-6 py-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Tag className="h-3 w-3" />
          {activeOffers} active
        </span>
      </TableCell>
      <TableCell className="px-6 py-4">
        {perf ? (
          <div className="text-xs space-y-0.5">
            <p>
              <span className="text-muted-foreground">Units:</span>{" "}
              <span className="font-semibold">
                {perf.units_sold.toLocaleString("en-NG")}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Rev:</span>{" "}
              <span className="font-semibold">
                {formatNaira(perf.revenue, { decimals: 0 })}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Margin:</span>{" "}
              <span
                className={`font-semibold ${
                  perf.margin < 0 ? "text-destructive" : "text-emerald-600"
                }`}
              >
                {formatNaira(perf.margin, { decimals: 0 })}
              </span>
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="px-6 py-4">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isActive
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isActive ? "Active" : "Inactive"}
        </span>
      </TableCell>
      <TableCell className="px-6 py-4 text-right">
        {(canEdit || canDelete) && (
          <div className="flex items-center justify-end gap-2">
            {canEdit && (
              <>
                {onSetActive && (
                  <button
                    type="button"
                    onClick={() => onSetActive(product, !isActive)}
                    className={`rounded-lg p-2 shadow-sm transition-all hover:shadow-md ${
                      isActive
                        ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white"
                        : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white"
                    }`}
                    title={isActive ? "Deactivate product" : "Reactivate product"}
                  >
                    {isActive ? (
                      <Ban className="h-4 w-4" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                  </button>
                )}
                {onReceiveStock && isActive && (
                  <button
                    type="button"
                    onClick={() => onReceiveStock(product)}
                    className="rounded-lg bg-primary/10 p-2 text-primary shadow-sm transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-md"
                    title="Receive stock (FIFO lot)"
                  >
                    <Package className="h-4 w-4" />
                  </button>
                )}
                {onManageVariants && product.allows_variants && isActive && (
                  <button
                    type="button"
                    onClick={() => onManageVariants(product)}
                    className="rounded-lg bg-primary/10 p-2 text-primary shadow-sm transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-md"
                    title="Manage variants"
                  >
                    <Layers className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onManageOffers(product)}
                  className="rounded-lg bg-primary/10 p-2 text-primary shadow-sm transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-md"
                  title="Manage offers"
                  disabled={!isActive}
                >
                  <Tag className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(product)}
                  className="rounded-lg bg-primary/10 p-2 text-primary shadow-sm transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-md"
                  title="Edit product"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(product.id)}
                className="rounded-lg bg-destructive/10 p-2 text-destructive shadow-sm transition-all hover:bg-destructive hover:text-destructive-foreground hover:shadow-md"
                title="Delete product"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
