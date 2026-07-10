"use client";

export function SiteFooter({ brandName }: { brandName: string }): React.ReactElement {
  return (
    <footer className="st-footer">
      <span>© {brandName}</span>
      <span>Built with your platform</span>
    </footer>
  );
}
