"use client";

import type { CSSProperties, ReactNode } from "react";
import type { PublicSiteProduct, SiteConfig } from "@platform/shared-types";
import "./storefront.css";
import { FONT_FAMILY } from "./fonts";
import { HeroSection } from "./HeroSection";
import { ProductsSection } from "./ProductsSection";
import { VisitSection } from "./VisitSection";
import { SiteNavBar } from "./SiteNavBar";
import { SiteFooter } from "./SiteFooter";

export interface StorefrontPreviewProps {
  brandName: string;
  config: SiteConfig;
  products: PublicSiteProduct[];
  /** Optional add-to-cart handler; when omitted, product cards render without the button. */
  onAddToCart?: (productId: string) => void | Promise<void>;
  addingProductId?: string | null;
  /** Renders the mobile-narrow layout — used by the builder's device toggle. */
  mobile?: boolean;
  /** Slot in the nav (e.g. the mini-cart button on the public site). */
  cartSlot?: ReactNode;
}

export function StorefrontPreview({
  brandName,
  config,
  products,
  onAddToCart,
  addingProductId,
  mobile,
  cartSlot,
}: StorefrontPreviewProps): React.ReactElement {
  const { theme, sections } = config;

  const style: CSSProperties = {
    ["--st-ink" as string]: theme.palette.ink,
    ["--st-bg" as string]: theme.palette.bg,
    ["--st-accent" as string]: theme.palette.accent,
    ["--st-display" as string]: FONT_FAMILY[theme.typography.display],
    ["--st-body" as string]: FONT_FAMILY[theme.typography.body],
  };

  return (
    <div
      className={`storefront-theme${mobile ? " mobile" : ""}`}
      data-template={theme.templateId}
      style={style}
    >
      <SiteNavBar brandName={brandName} theme={theme} cartSlot={cartSlot} />
      {sections.map((section) => {
        switch (section.kind) {
          case "hero":
            return <HeroSection key={section.id} section={section} />;
          case "products":
            return (
              <ProductsSection
                key={section.id}
                section={section}
                products={products}
                onAdd={onAddToCart}
                addingId={addingProductId}
              />
            );
          case "visit":
            return <VisitSection key={section.id} section={section} />;
          default:
            return null;
        }
      })}
      <SiteFooter brandName={brandName} />
    </div>
  );
}
