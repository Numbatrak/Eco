interface SelectedLocationsProps {
  locations: string[];
  onRemove: (location: string) => void;
  onClearAll: () => void;
}

export function SelectedLocations({
  locations,
  onRemove,
  onClearAll,
}: SelectedLocationsProps) {
  if (locations.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          Selected Locations
        </p>
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-full px-3 py-1 text-xs font-semibold text-destructive transition-all hover:bg-destructive/10"
        >
          Clear All
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {locations.map((loc) => (
          <span
            key={loc}
            className="group inline-flex items-center gap-2 rounded-full border-2 border-primary/30 bg-card px-3 py-2 text-xs font-semibold text-primary shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md"
          >
            <svg
              className="h-3.5 w-3.5 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
            </svg>
            {loc}
            <button
              type="button"
              onClick={() => onRemove(loc)}
              className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-primary/80 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Remove ${loc}`}
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
