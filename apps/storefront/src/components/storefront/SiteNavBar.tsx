"use client";

import type { ReactNode } from "react";
import type { SiteTheme } from "@platform/shared-types";

export interface SiteNavBarProps {
  brandName: string;
  theme: SiteTheme;
  cartSlot?: ReactNode;
}

export function SiteNavBar({ brandName, theme, cartSlot }: SiteNavBarProps): React.ReactElement {
  return (
    <nav className="st-nav">
      <span className="st-brand">
        {theme.logoUrl ? (
          <img src={theme.logoUrl} alt={brandName} className="st-brand-logo" />
        ) : null}
        {brandName}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div className="st-navlinks">
          <span>Menu</span>
          <span>Visit</span>
        </div>
        {cartSlot}
      </div>
    </nav>
  );
}
