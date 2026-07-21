interface PageHeaderProps {
  onAddNew: () => void;
  showAddButton?: boolean;
}

export function PageHeader({ onAddNew, showAddButton = true }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Products & Pricing</h1>
        <p className="text-muted-foreground text-sm">
          Manage products and track price history over time
        </p>
      </div>
      {showAddButton && (
        <button
          type="button"
          onClick={onAddNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New Product
        </button>
      )}
    </div>
  );
}








