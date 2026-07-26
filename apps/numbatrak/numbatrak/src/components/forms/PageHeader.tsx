interface PageHeaderProps {
  onAddNew: () => void;
  showAddButton?: boolean;
}

export function PageHeader({ onAddNew, showAddButton = true }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Forms</h1>
        <p className="text-muted-foreground text-sm">
          Create and manage dynamic forms for order collection
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
          Create New Form
        </button>
      )}
    </div>
  );
}
