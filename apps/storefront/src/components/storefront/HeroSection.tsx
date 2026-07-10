"use client";

import type { HeroSection as HeroSectionData } from "@platform/shared-types";

export function HeroSection({ section }: { section: HeroSectionData }): React.ReactElement | null {
  if (!section.visible) return null;
  return (
    <section className="st-hero">
      {section.eyebrow ? <span className="st-eyebrow">{section.eyebrow}</span> : null}
      <h1 className="st-headline">{section.headline}</h1>
      {section.sub ? <p className="st-sub">{section.sub}</p> : null}
      {section.ctaLabel ? <span className="st-cta">{section.ctaLabel}</span> : null}
    </section>
  );
}
