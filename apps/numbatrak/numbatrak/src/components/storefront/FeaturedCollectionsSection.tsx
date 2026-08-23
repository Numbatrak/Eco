import { Link } from "react-router-dom";
import type { FeaturedCollectionsSection as FeaturedCollectionsSectionData } from "../../types/siteConfig";

export interface CollectionItem {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string | null;
}

export interface FeaturedCollectionsSectionProps {
  section: FeaturedCollectionsSectionData;
  collections: CollectionItem[];
}

export function FeaturedCollectionsSection({
  section,
  collections,
}: FeaturedCollectionsSectionProps): React.ReactElement | null {
  if (!section.visible) return null;

  const items = collections.slice(0, section.maxItems ?? 3);

  return (
    <section className="st-section">
      {section.eyebrow ? <span className="st-eyebrow">{section.eyebrow}</span> : null}
      <h3 className="st-section-title">{section.title || "Collections"}</h3>
      {items.length === 0 ? (
        <div className="st-empty">No collections to show yet.</div>
      ) : (
        <div className="st-collections-grid">
          {items.map((col) => (
            <Link
              key={col.id}
              to={`/collections/${col.slug}`}
              className="st-collection-card"
            >
              {col.imageUrl ? (
                <img src={col.imageUrl} alt={col.name} className="st-collection-image filled" />
              ) : (
                <div className="st-collection-image" />
              )}
              <h4>{col.name}</h4>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
