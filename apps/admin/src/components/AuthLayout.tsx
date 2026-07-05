import type { ReactNode } from "react";

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps): React.ReactElement {
  return (
    <div className="auth-shell">
      <div className="auth-card panel">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p className="field-hint">{subtitle}</p> : null}
        </div>
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
