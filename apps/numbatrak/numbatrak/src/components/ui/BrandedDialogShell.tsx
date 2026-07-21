import type { ReactNode } from "react";
import { DialogContent } from "./dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";

interface BrandedDialogShellProps {
  open?: boolean;
  maxWidth?: string;
  hero: {
    icon: ReactNode;
    title: string;
    description: string;
  };
  children: ReactNode;
  footer?: ReactNode;
}

/** Theme-aware modal shell: midnight hero + card body (light/dark safe). */
export function BrandedDialogShell({
  maxWidth = "max-w-2xl",
  hero,
  children,
  footer,
}: BrandedDialogShellProps) {
  return (
    <DialogContent
      className={`${maxWidth} max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0`}
    >
      <BrandedDialogHero
        icon={hero.icon}
        title={hero.title}
        description={hero.description}
      />
      <div className="dialog-body-scroll max-h-standard">{children}</div>
      {footer ? <div className="dialog-footer-bar">{footer}</div> : null}
    </DialogContent>
  );
}
