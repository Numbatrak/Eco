import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchLatestAbandonedCarts } from "../../services/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { useOrganization } from "../../contexts/OrganizationContext";
import { EMPTY_CELL } from "../../utils/display";

interface LatestAbandonedCart {
  id: string;
  customer_name: string;
  phone_number: string;
  location: string;
  abandoned_at: string;
  product_name: string;
  sales_price: number | null;
  filled_fields_count: number;
}

interface AbandonedCartsProps {
  /** When set, only carts linked to this form are shown */
  formId?: string | null;
}

export function AbandonedCarts({ formId }: AbandonedCartsProps) {
  const { currentOrganization } = useOrganization();
  const [carts, setCarts] = useState<LatestAbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrganization) {
      loadCarts();
    }
  }, [currentOrganization, formId]);

  const loadCarts = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const data = await fetchLatestAbandonedCarts(
        currentOrganization.id,
        formId ?? undefined
      );
      setCarts(data);
    } catch (err) {
      console.error("Error loading latest abandoned carts:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return EMPTY_CELL;
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        return diffMinutes <= 1 ? "Just now" : `${diffMinutes} min ago`;
      }
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    }
    if (diffDays === 1) {
      return "Yesterday";
    }
    if (diffDays < 7) {
      return `${diffDays} days ago`;
    }
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Card className="dashboard-widget-card overflow-hidden border-border bg-card">
      <CardHeader className="border-b border-border bg-muted/30 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-1.5">
              <ShoppingBag className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-lg font-bold tracking-tight text-foreground">
              Abandoned Carts
            </CardTitle>
          </div>
          <Link
            to="/abandoned-carts"
            className="shrink-0 text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="divide-y divide-border">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex animate-pulse items-center justify-between p-4"
              >
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
                <div className="h-4 w-16 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : carts.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <ShoppingBag className="mb-3 h-12 w-12 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">
              No abandoned carts found
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {carts.map((cart) => (
              <Link
                key={cart.id}
                to="/abandoned-carts"
                className="group flex items-center justify-between p-4 text-inherit no-underline transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1 pr-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="truncate text-sm font-semibold uppercase tracking-tight text-foreground">
                      {cart.customer_name}
                    </span>
                    <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs font-bold text-emerald-500">
                      {formatCurrency(cart.sales_price)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
                    <span className="max-w-[120px] truncate">{cart.product_name}</span>
                    <span className="text-muted-foreground/30">•</span>
                    <span className="truncate">{cart.location}</span>
                    <span className="text-muted-foreground/30">•</span>
                    <span>{formatDate(cart.abandoned_at)}</span>
                  </div>
                </div>
                <div className="rounded-full p-2 opacity-0 transition-colors transition-opacity group-hover:bg-background group-hover:opacity-100">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
