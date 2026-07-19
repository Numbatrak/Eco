"use client";

import type { CSSProperties, ReactNode } from "react";
import type { SiteTheme, SiteSocialLinks, SiteFooter as SiteFooterConfig } from "@platform/shared-types";
import "./storefront.css";
import { FONT_FAMILY } from "./fonts";
import { SiteNavBar } from "./SiteNavBar";
import { SiteFooter } from "./SiteFooter";

export interface StorefrontShellProps {
  brandName: string;
  theme: SiteTheme;
  social?: SiteSocialLinks;
  footer?: SiteFooterConfig;
  hasCollections?: boolean;
  cartSlot?: ReactNode;
  mobile?: boolean;
  children: ReactNode;
}

export function StorefrontShell({
  brandName,
  theme,
  social,
  footer,
  hasCollections,
  cartSlot,
  mobile,
  children,
}: StorefrontShellProps): React.ReactElement {
  const style: CSSProperties = {
    ["--st-ink" as string]: theme.palette.ink,
    ["--st-bg" as string]: theme.palette.bg,
    ["--st-accent" as string]: theme.palette.accent,
    ["--st-accent-ink" as string]: theme.palette.accentInk || theme.palette.bg,
    ["--st-muted" as string]: theme.palette.muted || `${theme.palette.ink}99`,
    ["--st-display" as string]: FONT_FAMILY[theme.typography.display],
    ["--st-body" as string]: FONT_FAMILY[theme.typography.body],
  };

  return (
    <div
      className={`storefront-theme${mobile ? " mobile" : ""}`}
      data-template={theme.templateId}
      style={style}
    >
      <SiteNavBar brandName={brandName} theme={theme} hasCollections={hasCollections} cartSlot={cartSlot} />
      {children}
      <SiteFooter brandName={brandName} social={social} footer={footer} />
    </div>
  );
}
