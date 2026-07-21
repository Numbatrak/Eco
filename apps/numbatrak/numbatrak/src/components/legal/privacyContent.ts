import type { LegalSection } from "./LegalDocumentPage";

export const PRIVACY_LAST_UPDATED = "June 29, 2025";

export const PRIVACY_INTRO =
  "This Privacy Policy explains how Numbatrak (“we”, “us”) collects, uses, and protects information when you use our operations platform. It applies to account holders, organization members, and individuals whose data is processed through an organization’s use of the service.";

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "controller",
    title: "1. Who processes your data",
    paragraphs: [
      "Numbatrak acts as a data processor for organization business data (orders, deliveries, inventory, expenses, and related records) and as a data controller for account, authentication, and platform administration data.",
      "If you are a customer who submits an order through an organization’s public form, that organization is typically the data controller for your order and contact details. Contact the organization directly for questions about how they use your information.",
    ],
  },
  {
    id: "collect",
    title: "2. Information we collect",
    paragraphs: ["We collect the following categories of information:"],
    list: [
      "Account data: email address, password hash, verification status, and profile details you provide.",
      "Organization data: organization name, membership, role assignments, and invitations.",
      "Operational data: orders, form responses, product and inventory records, delivery and waybill information, agent records, expenses, follow-ups, and analytics derived from this data.",
      "Customer data submitted via forms: names, phone numbers, addresses, and order details as configured by your organization.",
      "Technical data: IP address, browser type, device information, session identifiers, and usage logs needed for security and troubleshooting.",
      "Communications: emails we send for verification, password reset, and organization invitations.",
    ],
  },
  {
    id: "use",
    title: "3. How we use information",
    paragraphs: ["We use collected information to:"],
    list: [
      "Provide, maintain, and secure the Numbatrak platform.",
      "Authenticate users and enforce organization-scoped access controls.",
      "Send transactional messages such as email verification and password reset links.",
      "Generate dashboards, reports, and operational analytics for your organization.",
      "Detect abuse, prevent fraud, and protect the integrity of public order forms.",
      "Comply with legal obligations and respond to lawful requests.",
    ],
  },
  {
    id: "org-scoping",
    title: "4. Organization boundaries and access control",
    paragraphs: [
      "Data in Numbatrak is isolated by organization. Row-level security policies ensure users can only access records belonging to organizations they are members of, according to their assigned role.",
      "Permissions within an organization (such as viewing orders, managing agents, or editing products) are enforced at the database layer, not only in the user interface.",
    ],
  },
  {
    id: "sharing",
    title: "5. When we share information",
    paragraphs: [
      "We do not sell your personal information. We may share data in these limited circumstances:",
    ],
    list: [
      "With service providers who host infrastructure, deliver email, or support authentication, under contracts that require appropriate safeguards.",
      "With other members of your organization, according to role-based permissions you or your admins configure.",
      "When required by law, regulation, legal process, or to protect rights, safety, and security.",
      "In connection with a merger, acquisition, or asset sale, with notice where required by law.",
    ],
  },
  {
    id: "security",
    title: "6. Data security",
    paragraphs: [
      "We use industry-standard measures including encrypted connections (HTTPS), authenticated access, and database-level security policies. Passwords are stored using secure hashing; we never store plaintext passwords.",
      "No method of transmission or storage is completely secure. You are responsible for safeguarding your account credentials and promptly reporting suspected unauthorized access.",
    ],
  },
  {
    id: "retention",
    title: "7. Data retention",
    paragraphs: [
      "We retain account and organization data for as long as your account or organization remains active and as needed to provide the service.",
      "Operational records may be retained to support reporting, audit requirements, and dispute resolution. You may request deletion of your account subject to legal and contractual obligations.",
    ],
  },
  {
    id: "rights",
    title: "8. Your rights",
    paragraphs: [
      "Depending on applicable law (including Nigeria’s data protection framework), you may have rights to access, correct, delete, or restrict processing of your personal data, and to object to certain processing.",
      "Account holders can update email and profile information in the application. For other requests, contact us at support@numbatrak.com. We will respond within a reasonable timeframe.",
    ],
  },
  {
    id: "cookies",
    title: "9. Cookies and local storage",
    paragraphs: [
      "We use browser local storage and session mechanisms to keep you signed in, remember your selected organization, and store theme preferences.",
      "These are essential for core functionality rather than third-party advertising trackers.",
    ],
  },
  {
    id: "third-parties",
    title: "10. Third-party services",
    paragraphs: [
      "Numbatrak is built on managed infrastructure including Supabase (database, authentication, and edge functions). Those providers process data on our behalf under their own security and privacy commitments.",
      "If you embed order forms on external websites, those sites may have their own tracking and privacy practices outside our control.",
    ],
  },
  {
    id: "transfers",
    title: "11. International data transfers",
    paragraphs: [
      "Your data may be processed in countries other than your own where our infrastructure providers operate. We take steps to ensure appropriate safeguards are in place when data crosses borders.",
    ],
  },
  {
    id: "children",
    title: "12. Children’s privacy",
    paragraphs: [
      "Numbatrak is a business operations tool not directed at children under 16. We do not knowingly collect personal information from children. If you believe we have done so, contact us and we will take appropriate steps to delete it.",
    ],
  },
  {
    id: "changes",
    title: "13. Changes to this policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. Material changes will be reflected in the “Last updated” date. We encourage you to review this page periodically.",
    ],
  },
];
