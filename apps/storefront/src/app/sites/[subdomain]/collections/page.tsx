"use client";

import Link from "next/link";
import { useSite } from "../../../../components/SiteProvider";
import { StorefrontShell } from "../../../../components/storefront/StorefrontShell";
import { MiniCart } from "../../../../components/MiniCart";

export default function CollectionsPage(): React.ReactElement {
  const { site } = useSite();
  const collections = site.collections;

  return (
    <StorefrontShell
      brandName={site.tenant.name}
      theme={site.theme}
      hasCollections={collections.length > 0}
      cartSlot={<MiniCart />}
    >
      <section className="st-section">
        <h3 className="st-section-title">Collections</h3>
        {collections.length === 0 ? (
          <div className="st-empty">No collections to show yet.</div>
        ) : (
          <div className="st-grid">
            {collections.map((collection) => (
              <Link key={collection.id} href={`/collections/${collection.slug}`} className="st-card st-card-link">
                {collection.imageUrl ? (
                  <img
                    src={collection.imageUrl}
                    alt={collection.name}
                    className="st-card-image filled"
                  />
                ) : (
                  <div className="st-card-image" />
                )}
                <h4>{collection.name}</h4>
                {collection.description ? <p>{collection.description}</p> : null}
              </Link>
            ))}
          </div>
        )}
      </section>
    </StorefrontShell>
  );
}
