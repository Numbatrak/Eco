interface CustomLocationInputProps {
  value: string;
  onChange: (value: string) => void;
  onAdd: (location: string) => void;
}

export function CustomLocationInput({
  value,
  onChange,
  onAdd,
}: CustomLocationInputProps) {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (value.trim()) {
        onAdd(value.trim());
        onChange("");
      }
    }
  };

  const handleAdd = () => {
    if (value.trim()) {
      onAdd(value.trim());
      onChange("");
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Add custom location (press Enter)"
        className="w-full rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-3 pr-12 text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15"
      />
      {value.trim() && (
        <button
          type="button"
          onClick={handleAdd}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary p-2 text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
          title="Add location"
        >
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
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
