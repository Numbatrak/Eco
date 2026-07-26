import { useState, useEffect } from "react";
import { LocationDropdown } from "./LocationDropdown";
import { SelectedLocations } from "./SelectedLocations";
import { CustomLocationInput } from "./CustomLocationInput";

interface LocationSelectorProps {
  selectedLocations: string[];
  onLocationsChange: (locations: string[]) => void;
}

export function LocationSelector({
  selectedLocations,
  onLocationsChange,
}: LocationSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customLocation, setCustomLocation] = useState("");

  useEffect(() => {
    if (!dropdownOpen) {
      setSearchQuery("");
    }
  }, [dropdownOpen]);

  const handleToggleLocation = (location: string) => {
    const newLocations = selectedLocations.includes(location)
      ? selectedLocations.filter((loc) => loc !== location)
      : [...selectedLocations, location];
    onLocationsChange(newLocations);
  };

  const handleAddCustomLocation = (location: string) => {
    if (!selectedLocations.includes(location)) {
      onLocationsChange([...selectedLocations, location]);
    }
  };

  const handleClearAll = () => {
    onLocationsChange([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-bold text-foreground">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary">
            <svg
              className="w-4 h-4 text-primary-foreground"
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          Service Locations
        </label>
        {selectedLocations.length > 0 && (
          <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm">
            {selectedLocations.length} selected
          </span>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="group flex w-full items-center justify-between gap-3 rounded-xl border-2 border-border bg-background px-4 py-3.5 text-left shadow-sm outline-none transition-all duration-200 hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/20"
        >
          <div className="flex flex-1 items-center gap-2">
            <svg
              className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary/80"
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
            <span
              className={`text-sm ${
                selectedLocations.length > 0
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {selectedLocations.length > 0
                ? `${selectedLocations.length} location${
                    selectedLocations.length > 1 ? "s" : ""
                  } selected`
                : "Search and select states..."}
            </span>
          </div>
          <svg
            className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${
              dropdownOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        <LocationDropdown
          isOpen={dropdownOpen}
          onClose={() => setDropdownOpen(false)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedLocations={selectedLocations}
          onToggleLocation={handleToggleLocation}
        />
      </div>

      <CustomLocationInput
        value={customLocation}
        onChange={setCustomLocation}
        onAdd={handleAddCustomLocation}
      />

      <SelectedLocations
        locations={selectedLocations}
        onRemove={handleToggleLocation}
        onClearAll={handleClearAll}
      />
    </div>
  );
}
