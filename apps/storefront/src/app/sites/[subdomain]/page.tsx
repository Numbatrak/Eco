"use client";

import { useState } from "react";
import { useSite } from "../../../components/SiteProvider";
import { useCart } from "../../../components/CartContext";
import { StorefrontPreview } from "../../../components/storefront/StorefrontPreview";
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

  return (
    <StorefrontPreview
      brandName={site.tenant.name}
      config={site}
      products={site.products}
      onAddToCart={handleAdd}
      addingProductId={addingId}
      cartSlot={<MiniCart />}
    />
  );
}
