"use client";

import { Link } from "react-router-dom";
import { BrandTagline } from "../brand/BrandTagline";
import { NumbatrakLogo } from "../brand/NumbatrakLogo";
import "./LegalDocumentPage.css";

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  list?: string[];
};

type LegalDocumentPageProps = {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
};

export function LegalDocumentPage({
  title,
  lastUpdated,
  intro,
  sections,
}: LegalDocumentPageProps) {
  return (
    <div className="legal-container">
      <div className="legal-left-panel">
        <div className="legal-left-content">
          <div className="legal-logo">
            <NumbatrakLogo size="lg" variant="onDark" showWordmark />
            <BrandTagline className="mt-2 text-sm text-[#10B981]" />
          </div>

          <div className="legal-left-main">
            <h2 className="legal-left-title">Trust & transparency</h2>
            <p className="legal-left-description">
              Numbatrak helps teams run orders, logistics, and reporting in one
              secure workspace. These policies explain how we operate and how we
              handle your data.
            </p>
          </div>

          <div className="legal-left-footer">
            <Link to="/login" className="legal-back-link">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>

      <div className="legal-right-panel">
        <div className="legal-document">
          <div className="legal-mobile-header">
            <NumbatrakLogo size="md" variant="onDark" showWordmark />
            <Link to="/login" className="legal-mobile-back">
              Sign in
            </Link>
          </div>

          <header className="legal-header">
            <h1>{title}</h1>
            <p className="legal-meta">Last updated: {lastUpdated}</p>
            <p className="legal-intro">{intro}</p>
          </header>

          <div className="legal-sections">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="legal-section">
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                ))}
                {section.list && (
                  <ul>
                    {section.list.map((item) => (
                      <li key={item.slice(0, 48)}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <footer className="legal-footer">
            <p>
              Questions? Contact us at{" "}
              <a href="mailto:support@numbatrak.com">support@numbatrak.com</a>.
            </p>
            <p>
              See also:{" "}
              <Link to="/terms">Terms of Service</Link>
              {" · "}
              <Link to="/privacy">Privacy Policy</Link>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
