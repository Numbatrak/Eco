import { LegalDocumentPage } from "./legal/LegalDocumentPage";
import {
  PRIVACY_INTRO,
  PRIVACY_LAST_UPDATED,
  PRIVACY_SECTIONS,
} from "./legal/privacyContent";

export function PrivacyPolicyPage() {
  return (
    <LegalDocumentPage
      title="Privacy Policy"
      lastUpdated={PRIVACY_LAST_UPDATED}
      intro={PRIVACY_INTRO}
      sections={PRIVACY_SECTIONS}
    />
  );
}
