"use client";

import type { TrustBadgesSection as TrustBadgesSectionData } from "@platform/shared-types";

export function TrustBadgesSection({
  section,
}: {
  section: TrustBadgesSectionData;
}): React.ReactElement | null {
  if (!section.visible) return null;

  return (
    <section className="st-trust-badges">
      <div className="st-trust-grid">
        {section.items.map((item, i) => (
          <div key={i} className="st-trust-item">
            <div className="st-trust-bar" />
            <h5 className="st-trust-title">{item.title}</h5>
            <p className="st-trust-body">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
