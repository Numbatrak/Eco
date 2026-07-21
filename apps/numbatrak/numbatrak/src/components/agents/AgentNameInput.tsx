import React from "react";

interface AgentNameInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function AgentNameInput({ value, onChange }: AgentNameInputProps) {
  return (
    <div className="space-y-3">
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        Agent Name
        <span className="text-destructive">*</span>
      </label>
      <div className="relative group">
        <input
          type="text"
          required
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onChange(e.target.value)
          }
          placeholder="Enter full name (e.g., John Doe)"
          className="w-full rounded-xl border-2 border-border bg-background px-4 py-3.5 text-foreground shadow-sm outline-none transition-all duration-200 placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/20 group-hover:border-muted-foreground"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
