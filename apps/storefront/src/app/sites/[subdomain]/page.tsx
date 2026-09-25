"use client";

import { useState } from "react";
import { useSite } from "../../../components/SiteProvider";
import { useCart } from "../../../components/CartContext";
import { StorefrontPreview } from "../../../components/storefront/StorefrontPreview";
import { FunnelPageClient } from "../../../components/storefront/FunnelPageClient";
import { MiniCart } from "../../../components/MiniCart";

export default function ShopPage(): React.ReactElement {
  const { site } = useSite();
  const { addItem } = useCart();
  const [addingId, setAddingId] = useState<string | null>(null);

  async function handleAdd(productId: string): Promise<void> {
    setAddingId(productId);
    try {
      await addItem(productId, 1);
    } catch {
      // The old page had local state for errorId, but here the error
      // toast or global state might handle it.
      // We could add local error state, but the CartContext usually
      // exposes an error if needed.
    } finally {
      setAddingId(null);
    }
  }

  // A "Funnel Store" renders its picked product's Funnel Mode page at the
  // site root instead of the catalog homepage. Falls back to the catalog
  // view below when the funnel isn't ready yet (no product picked, product
  // unpublished, or funnel content unpublished) - see findPublishedSiteBySubdomain.
  if (site.storeType === "funnel" && site.funnel) {
    return <FunnelPageClient funnel={site.funnel} subdomain={site.tenant.subdomain} />;
  }

  return (
    <StorefrontPreview
      brandName={site.tenant.name}
      config={site}
      products={site.products}
      collections={site.collections.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        imageUrl: c.imageUrl,
      }))}
      hasCollections={site.collections.length > 0}
      onAddToCart={handleAdd}
      addingProductId={addingId}
      cartSlot={<MiniCart />}
    />
  );
}
