import { ReactNode } from "react";

interface PageHeaderProps {
  onAddNew: () => void;
  showAddButton?: boolean;
  extraActions?: ReactNode;
}

export function PageHeader({
  onAddNew,
  showAddButton = true,
  extraActions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">
          Deliveries & Waybills
        </h1>
        <p className="text-muted-foreground text-sm">
          Track deliveries and waybills; use Bulk Waybill Out to record Lagos → agent
          stock in the ledger.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {extraActions}
        {showAddButton && (
          <button
            type="button"
            onClick={onAddNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add New Delivery
          </button>
        )}
      </div>
    </div>
  );
}








