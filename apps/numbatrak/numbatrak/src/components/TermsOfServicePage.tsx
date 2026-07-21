import { LegalDocumentPage } from "./legal/LegalDocumentPage";
import {
  TERMS_INTRO,
  TERMS_LAST_UPDATED,
  TERMS_SECTIONS,
} from "./legal/termsContent";

export function TermsOfServicePage() {
  return (
    <LegalDocumentPage
      title="Terms of Service"
      lastUpdated={TERMS_LAST_UPDATED}
      intro={TERMS_INTRO}
      sections={TERMS_SECTIONS}
    />
  );
}
