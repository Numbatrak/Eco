import type { VisitSection as VisitSectionData } from "../../types/siteConfig";

export function VisitSection({ section }: { section: VisitSectionData }): React.ReactElement | null {
  if (!section.visible) return null;
  const cols: { title: string; body: string }[] = [];
  if (section.address) cols.push({ title: "Address", body: section.address });
  if (section.hours) cols.push({ title: "Hours", body: section.hours });
  if (section.contact) cols.push({ title: "Say hello", body: section.contact });

  return (
    <section className="st-section">
      <h3 className="st-section-title">{section.title || "Visit & hours"}</h3>
      <div className="st-visit">
        {cols.map((col) => (
          <div key={col.title} className="st-visit-col">
            <h5>{col.title}</h5>
            <p>{col.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
