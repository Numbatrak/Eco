"use client";

import type { ReactNode } from "react";
import type { PublicSiteProduct, SiteConfig } from "@platform/shared-types";
import { HeroSection } from "./HeroSection";
import { ProductsSection } from "./ProductsSection";
import { VisitSection } from "./VisitSection";
import { AnnouncementBar } from "./AnnouncementBar";
import { FeaturedCollectionsSection, type CollectionItem } from "./FeaturedCollectionsSection";
import { BrandStorySection } from "./BrandStorySection";
import { TrustBadgesSection } from "./TrustBadgesSection";
import { StorefrontShell } from "./StorefrontShell";

export interface StorefrontPreviewProps {
  brandName: string;
  config: SiteConfig;
  products: PublicSiteProduct[];
  collections?: CollectionItem[];
  hasCollections?: boolean;
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
  collections = [],
  hasCollections,
  onAddToCart,
  addingProductId,
  mobile,
  cartSlot,
}: StorefrontPreviewProps): React.ReactElement {
  const { theme, sections } = config;

  return (
    <StorefrontShell brandName={brandName} theme={theme} social={config.social} footer={config.footer} hasCollections={hasCollections} mobile={mobile} cartSlot={cartSlot}>
      {sections.map((section) => {
        switch (section.kind) {
          case "announcement":
            return <AnnouncementBar key={section.id} section={section} />;
          case "hero":
            return <HeroSection key={section.id} section={section} />;
          case "featured-collections":
            return (
              <FeaturedCollectionsSection
                key={section.id}
                section={section}
                collections={collections}
              />
            );
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
          case "brand-story":
            return <BrandStorySection key={section.id} section={section} />;
          case "trust-badges":
            return <TrustBadgesSection key={section.id} section={section} />;
          case "visit":
            return <VisitSection key={section.id} section={section} />;
          default:
            return null;
        }
      })}
    </StorefrontShell>
  );
}
