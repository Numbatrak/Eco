"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import { useSite } from "../../../../../components/SiteProvider";
import { useCart } from "../../../../../components/CartContext";
import { StorefrontShell } from "../../../../../components/storefront/StorefrontShell";
import { ProductsSection } from "../../../../../components/storefront/ProductsSection";
import { MiniCart } from "../../../../../components/MiniCart";

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): React.ReactElement {
  const { slug } = use(params);
  const { site } = useSite();
  const { addItem } = useCart();
  const [addingId, setAddingId] = useState<string | null>(null);

  const collection = site.collections.find((item) => item.slug === slug);
  if (!collection) {
    notFound();
  }

  const products = site.products.filter((product) => product.collectionId === collection.id);

  async function handleAdd(productId: string): Promise<void> {
    setAddingId(productId);
    try {
      await addItem(productId, 1);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <StorefrontShell
      brandName={site.tenant.name}
      theme={site.theme}
      hasCollections={site.collections.length > 0}
      cartSlot={<MiniCart />}
    >
      <ProductsSection
        section={{ id: collection.id, kind: "products", visible: true, title: collection.name }}
        products={products}
        onAdd={handleAdd}
        addingId={addingId}
      />
    </StorefrontShell>
  );
}
