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
  MoreVertical,
} from "lucide-react";
import { formatNaira, formatShortId } from "../../utils/currency";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-lg p-2 text-muted-foreground shadow-sm transition-all hover:bg-accent hover:text-foreground"
                title="Product actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <>
                  {onSetActive && (
                    <DropdownMenuItem onClick={() => onSetActive(product, !isActive)}>
                      {isActive ? <Ban /> : <RotateCcw />}
                      {isActive ? "Deactivate product" : "Reactivate product"}
                    </DropdownMenuItem>
                  )}
                  {onReceiveStock && isActive && (
                    <DropdownMenuItem onClick={() => onReceiveStock(product)}>
                      <Package />
                      Receive stock (FIFO lot)
                    </DropdownMenuItem>
                  )}
                  {onManageVariants && product.allows_variants && isActive && (
                    <DropdownMenuItem onClick={() => onManageVariants(product)}>
                      <Layers />
                      Manage variants
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onManageOffers(product)} disabled={!isActive}>
                    <Tag />
                    Manage offers
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(product)}>
                    <Pencil />
                    Edit product
                  </DropdownMenuItem>
                </>
              )}
              {canDelete && (
                <>
                  {canEdit && <DropdownMenuSeparator />}
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(product.id)}>
                    <Trash2 />
                    Delete product
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
}
