import type { HeroSection as HeroSectionData } from "../../types/siteConfig";

export function HeroSection({ section }: { section: HeroSectionData }): React.ReactElement | null {
  if (!section.visible) return null;
  const hasImage = !!section.imageUrl;

  return (
    <section className={`st-hero${hasImage ? " has-image" : ""}`}>
      {hasImage ? (
        <>
          <img src={section.imageUrl!} alt="" className="st-hero-image" />
          <div className="st-hero-overlay" />
        </>
      ) : null}
      <div className={hasImage ? "st-hero-content" : undefined}>
        {section.eyebrow ? <span className="st-eyebrow">{section.eyebrow}</span> : null}
        <h1 className="st-headline">{section.headline}</h1>
        {section.sub ? <p className="st-sub">{section.sub}</p> : null}
        {section.ctaLabel ? (
          <a href={section.ctaUrl || "#"} className="st-cta">{section.ctaLabel}</a>
        ) : null}
      </div>
    </section>
  );
}
