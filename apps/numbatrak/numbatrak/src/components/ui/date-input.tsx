import * as React from "react";
import { Calendar } from "lucide-react";
import { Input } from "./input";
import { cn } from "./utils";

function DateInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input || input.disabled) return;
    input.focus();
    input.showPicker?.();
  };

  return (
    <div className="dialog-date-input-wrap relative w-full">
      <Input
        ref={inputRef}
        type="date"
        className={cn("dialog-date-input pr-10", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={openPicker}
        disabled={props.disabled}
        className="dialog-date-input-icon absolute right-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-muted-foreground disabled:opacity-50"
        aria-label="Open calendar"
      >
        <Calendar className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export { DateInput };
