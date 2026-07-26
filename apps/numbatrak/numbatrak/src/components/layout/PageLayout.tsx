import { ReactNode } from "react";

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
}

/** Standard page shell — matches dashboard padding and full-width content area. */
export function PageLayout({ children, className = "" }: PageLayoutProps) {
  return (
    <section
      className={`p-6 md:p-8 flex flex-col gap-6 min-h-screen bg-background ${className}`.trim()}
    >
      {children}
    </section>
  );
}
