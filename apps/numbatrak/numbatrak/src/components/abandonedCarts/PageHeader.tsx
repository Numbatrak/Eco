interface PageHeaderProps {
  totalCarts: number;
  convertedCount: number;
}

export function PageHeader({ totalCarts, convertedCount }: PageHeaderProps) {
  const conversionRate =
    totalCarts > 0 ? ((convertedCount / totalCarts) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Abandoned Carts</h1>
        <p className="text-muted-foreground text-sm">
          Track and convert abandoned shopping carts from your WordPress forms
        </p>
        <div className="flex items-center gap-4 mt-1">
          <div className="text-sm">
            <span className="text-muted-foreground">Total Carts: </span>
            <span className="font-semibold text-foreground">{totalCarts}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Converted: </span>
            <span className="font-semibold text-green-500">{convertedCount}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Conversion Rate: </span>
            <span className="font-semibold text-amber-500">{conversionRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
