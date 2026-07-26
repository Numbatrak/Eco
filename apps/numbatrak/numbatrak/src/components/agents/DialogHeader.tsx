import { BrandedDialogHero } from "../brand/BrandedDialogHero";

interface DialogHeaderProps {
  mode: "create" | "edit";
}

export function DialogHeader({ mode }: DialogHeaderProps) {
  return (
    <BrandedDialogHero
      icon={
        <svg
          className="h-7 w-7"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={
              mode === "edit"
                ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                : "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
            }
          />
        </svg>
      }
      title={mode === "edit" ? "Edit Agent Profile" : "Create New Agent"}
      description={
        mode === "edit"
          ? "Update agent details and service coverage"
          : "Add a new field agent with their service locations"
      }
    />
  );
}












