import type { AnnouncementSection } from "../../types/siteConfig";

export function AnnouncementBar({
  section,
}: {
  section: AnnouncementSection;
}): React.ReactElement | null {
  if (!section.visible || section.messages.length === 0) return null;

  const items = [...section.messages, ...section.messages];

  return (
    <div className="st-announcement">
      <div className="st-announcement-track">
        {items.map((msg, i) => (
          <span key={i} className="st-announcement-item">
            <span className="st-announcement-dot" aria-hidden />
            <span>{msg}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
