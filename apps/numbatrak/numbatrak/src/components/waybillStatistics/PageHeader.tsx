interface PageHeaderProps {
  totalStates?: number;
}

export function PageHeader() {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Waybill Statistics</h1>
        <p className="text-muted-foreground text-sm">
          Track waybilled items from Lagos warehouse to other states
        </p>
      </div>
    </div>
  );
}
