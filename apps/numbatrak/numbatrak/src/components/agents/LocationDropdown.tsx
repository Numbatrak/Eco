import { useRef, useEffect } from "react";
import { nigeriaStates } from "../../constants/nigeriaStates";

interface LocationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedLocations: string[];
  onToggleLocation: (location: string) => void;
}

export function LocationDropdown({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  selectedLocations,
  onToggleLocation,
}: LocationDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const filteredLocations = searchQuery
    ? nigeriaStates.filter((state) =>
        state.toLowerCase().includes(searchQuery.toLowerCase().trim())
      )
    : nigeriaStates;

  if (!isOpen) return null;

  return (
    <div
      className="agent-location-dropdown absolute z-50 mt-2 w-full overflow-hidden rounded-xl border-2 border-border bg-popover text-popover-foreground shadow-2xl animate-in slide-in-from-top-2"
      ref={dropdownRef}
    >
      <div className="border-b border-border bg-muted p-3">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary/80"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search states..."
            className="w-full rounded-lg border-2 border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            autoFocus
          />
        </div>
      </div>

      <div className="agent-location-dropdown-list max-h-64 overflow-y-auto">
        {filteredLocations.length === 0 ? (
          <div className="p-8 text-center">
            <svg
              className="mx-auto mb-3 h-12 w-12 text-muted-foreground opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm font-medium text-muted-foreground">
              No states found
            </p>
          </div>
        ) : (
          filteredLocations.map((location) => {
            const isSelected = selectedLocations.includes(location);
            return (
              <button
                key={location}
                type="button"
                onClick={() => onToggleLocation(location)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-150 ${
                  isSelected
                    ? "border-l-4 border-primary bg-primary/10"
                    : "border-l-4 border-transparent hover:bg-accent"
                }`}
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                    isSelected
                      ? "scale-110 border border-primary bg-primary"
                      : "border-border"
                  }`}
                >
                  {isSelected && (
                    <svg
                      className="h-3.5 w-3.5 text-primary-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <span
                  className={`text-sm font-medium transition-colors ${
                    isSelected ? "text-foreground" : "text-foreground/90"
                  }`}
                >
                  {location}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
