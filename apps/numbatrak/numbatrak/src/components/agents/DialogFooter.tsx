import { DialogClose } from "../ui/dialog";

interface DialogFooterProps {
  mode: "create" | "edit";
  saving: boolean;
  disabled: boolean;
  onSubmit: () => void;
}

export function DialogFooter({
  mode,
  saving,
  disabled,
  onSubmit,
}: DialogFooterProps) {
  return (
    <div className="dialog-footer-bar">
      <DialogClose asChild>
        <button
          type="button"
          className="dialog-cancel-button"
        >
          Cancel
        </button>
      </DialogClose>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {saving ? (
          <>
            <svg
              className="animate-spin h-4 w-4 text-primary-foreground"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Processing...
          </>
        ) : (
          <>
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
                d="M5 13l4 4L19 7"
              />
            </svg>
            {mode === "edit" ? "Update Agent" : "Create Agent"}
          </>
        )}
      </button>
    </div>
  );
}












