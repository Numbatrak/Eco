import { useEffect, useState } from "react";
import { fetchLatestOrders } from "../../services/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ShoppingCart, ChevronRight } from "lucide-react";
import { useOrganization } from "../../contexts/OrganizationContext";

interface LatestOrder {
  id: string;
  customer_name: string;
  phone_number: string;
  location: string;
  order_date: string;
  product_name: string;
  order_status: string;
  sales_price: number | null;
}

interface NewOrdersProps {
  /** When set, only submissions from this form are shown */
  formId?: string | null;
  /** When set, only orders for this CSR (v2 / form_responses.csr_id) are shown */
  csrId?: string | null;
}

export function NewOrders({ formId, csrId }: NewOrdersProps) {
  const { currentOrganization } = useOrganization();
  const [orders, setOrders] = useState<LatestOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentOrganization) {
      loadOrders();
    }
  }, [currentOrganization, formId, csrId]);

  const loadOrders = async () => {
    if (!currentOrganization) return;
    
    try {
      setLoading(true);
      const data = await fetchLatestOrders(
        currentOrganization.id,
        formId ?? undefined,
        csrId ?? undefined
      );
      setOrders(data);
    } catch (err) {
      console.error("Error loading latest orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "N/A";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "delivered":
        return "#10b981";
      case "pending":
        return "#f59e0b";
      case "cancelled":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  return (
    <Card className="dashboard-widget-card overflow-hidden border-border bg-card">
      <CardHeader className="border-b border-border bg-muted/30 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <ShoppingCart className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-lg font-bold tracking-tight text-foreground">
            New Orders
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="divide-y divide-border">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="p-4 flex items-center justify-between animate-pulse"
              >
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
                <div className="h-4 bg-muted rounded w-16" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <ShoppingCart className="w-12 h-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No recent orders found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {orders.map((order) => (
              <div
                key={order.id}
                className="group p-4 flex items-center justify-between transition-colors hover:bg-muted/50 cursor-pointer"
              >
                <div className="flex-1 min-width-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground text-sm truncate uppercase tracking-tight">
                      {order.customer_name}
                    </span>
                    <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      {formatCurrency(order.sales_price)}
                    </span>
                  </div>
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground font-medium">
                    <span className="truncate max-w-[120px]">{order.product_name}</span>
                    <span className="text-muted-foreground/30">•</span>
                    <span>{formatDate(order.order_date)}</span>
                    <span className="text-muted-foreground/30">•</span>
                    <span 
                      className="font-bold uppercase tracking-wider text-[10px]"
                      style={{ color: getStatusColor(order.order_status) }}
                    >
                      {order.order_status}
                    </span>
                  </div>
                </div>
                <div className="p-2 rounded-full hover:bg-background transition-colors opacity-0 group-hover:opacity-100">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

  );
}



