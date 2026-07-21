import type { ReactNode } from "react";
import { DialogDescription, DialogTitle } from "../ui/dialog";

export function BrandedDialogHero({
  icon,
  title,
  description,
  className = "",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={`dialog-hero-band ${className}`.trim()}>
      <div className="dialog-hero-band-inner">
        <div className="flex items-start gap-4">
          <div className="dialog-hero-icon-wrap">{icon}</div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="dialog-hero-title">{title}</DialogTitle>
            <DialogDescription className="dialog-hero-description">
              {description}
            </DialogDescription>
          </div>
        </div>
      </div>
    </div>
  );
}
