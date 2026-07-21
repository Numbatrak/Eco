import { useEffect, useState } from "react";
import { fetchLatestDeliveries } from "../../services/dashboard";
import { useOrganization } from "../../contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Package2 } from "lucide-react";
import { CardListSkeleton } from "../ui/LoadingState";

interface LatestDelivery {
  id: number;
  date: string;
  status: "Waybilled" | "Delivered";
  product: string;
  agent: string;
  quantity: number;
  cost: number;
}

export function LatestDeliveries() {
  const { currentOrganization } = useOrganization();
  const [deliveries, setDeliveries] = useState<LatestDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDeliveries();
  }, [currentOrganization?.id]);

  const loadDeliveries = async () => {
    if (!currentOrganization?.id) {
      setDeliveries([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await fetchLatestDeliveries(currentOrganization.id);
      setDeliveries(data);
    } catch (err) {
      console.error("Error loading latest deliveries:", err);
      setError("Could not load deliveries");
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Latest Deliveries</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <CardListSkeleton rows={5} />
        ) : error ? (
          <p className="text-sm text-destructive py-4">{error}</p>
        ) : deliveries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Package2 className="w-8 h-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No deliveries found</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border -mx-1">
            {deliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="flex items-center justify-between px-1 py-3 hover:bg-muted/40 transition-colors rounded-lg cursor-pointer"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-sm font-medium text-foreground truncate">
                      {delivery.product}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatCurrency(delivery.cost)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                    <span>{delivery.agent}</span>
                    <span className="opacity-40">•</span>
                    <span>{formatDate(delivery.date)}</span>
                    <span className="opacity-40">•</span>
                    <span>Qty: {delivery.quantity}</span>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
                    delivery.status === "Delivered"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {delivery.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
