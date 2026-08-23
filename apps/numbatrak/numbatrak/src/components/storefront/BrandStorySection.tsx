import type { BrandStorySection as BrandStorySectionData } from "../../types/siteConfig";

export function BrandStorySection({
  section,
}: {
  section: BrandStorySectionData;
}): React.ReactElement | null {
  if (!section.visible) return null;

  return (
    <section className="st-brand-story">
      {section.eyebrow ? <span className="st-eyebrow">{section.eyebrow}</span> : null}
      <h2 className="st-brand-headline">{section.headline}</h2>
      <p className="st-brand-body">{section.body}</p>
      {section.ctaLabel ? (
        <a href={section.ctaUrl || "#"} className="st-brand-cta">
          {section.ctaLabel} →
        </a>
      ) : null}
    </section>
  );
}
