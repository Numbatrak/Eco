import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { SiteTheme } from "../../types/siteConfig";

export interface SiteNavBarProps {
  brandName: string;
  theme: SiteTheme;
  hasCollections?: boolean;
  cartSlot?: ReactNode;
}

export function SiteNavBar({
  brandName,
  theme,
  hasCollections,
  cartSlot,
}: SiteNavBarProps): React.ReactElement {
  return (
    <nav className="st-nav">
      <Link to="/" className="st-brand">
        {theme.logoUrl ? (
          <img src={theme.logoUrl} alt={brandName} className="st-brand-logo" />
        ) : null}
        {brandName}
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div className="st-navlinks">
          <Link to="/">Home</Link>
          {hasCollections ? <Link to="/collections">Collections</Link> : null}
        </div>
        {cartSlot}
      </div>
    </nav>
  );
}
