import type { SiteSocialLinks, SiteFooter as SiteFooterConfig } from "../../types/siteConfig";

export interface SiteFooterProps {
  brandName: string;
  social?: SiteSocialLinks;
  footer?: SiteFooterConfig;
}

export function SiteFooter({ brandName, social, footer }: SiteFooterProps): React.ReactElement {
  const hasSocial = footer?.showSocial !== false && social && Object.values(social).some(Boolean);
  const hasColumns = footer?.columns && footer.columns.length > 0;

  return (
    <footer className="st-footer">
      <div className="st-footer-main">
        <div className="st-footer-brand">
          <span className="st-footer-name">{brandName}</span>
          {footer?.tagline ? <span className="st-footer-tagline">{footer.tagline}</span> : null}
        </div>

        {hasColumns ? (
          <div className="st-footer-columns">
            {footer!.columns!.map((col, i) => (
              <div key={i} className="st-footer-col">
                <h5>{col.title}</h5>
                <ul>
                  {col.links.map((link, j) => (
                    <li key={j}>
                      <a href={link.url} target={link.url.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        {hasSocial ? (
          <div className="st-footer-social">
            {social!.instagram ? (
              <a href={social!.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">IG</a>
            ) : null}
            {social!.tiktok ? (
              <a href={social!.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok">TK</a>
            ) : null}
            {social!.twitter ? (
              <a href={social!.twitter} target="_blank" rel="noopener noreferrer" aria-label="Twitter">X</a>
            ) : null}
            {social!.facebook ? (
              <a href={social!.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">FB</a>
            ) : null}
            {social!.whatsapp ? (
              <a href={`https://wa.me/${social!.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">WA</a>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="st-footer-bottom">
        <span>&copy; {brandName}</span>
      </div>
    </footer>
  );
}
