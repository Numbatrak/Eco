import type { LegalSection } from "./LegalDocumentPage";

export const TERMS_LAST_UPDATED = "June 29, 2025";

export const TERMS_INTRO =
  "These Terms of Service (“Terms”) govern your access to and use of Numbatrak, a multi-tenant operations platform for managing orders, deliveries, inventory, expenses, and related business data. By creating an account or using the service, you agree to these Terms.";

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "service",
    title: "1. The service",
    paragraphs: [
      "Numbatrak provides a cloud-based workspace where organizations can track orders, manage delivery agents and waybills, maintain product catalogs and inventory, record expenses, build order forms, and view operational analytics.",
      "Features and availability may change as we improve the platform. We will make reasonable efforts to notify organization owners of material changes that affect how you use the service.",
    ],
  },
  {
    id: "accounts",
    title: "2. Accounts and organizations",
    paragraphs: [
      "You must provide accurate registration information and keep your credentials secure. You are responsible for all activity under your account.",
      "Numbatrak is organization-scoped: users belong to one or more organizations and receive permissions based on their role within each organization (such as Owner, Admin, Manager, Customer Relations, or Agent). You may only access data for organizations you are a member of.",
      "Organization owners and admins are responsible for inviting members, assigning roles, and ensuring their team complies with these Terms.",
    ],
  },
  {
    id: "acceptable-use",
    title: "3. Acceptable use",
    paragraphs: [
      "You agree not to misuse Numbatrak. Prohibited conduct includes, without limitation:",
    ],
    list: [
      "Accessing or attempting to access another organization’s data without authorization.",
      "Uploading unlawful, fraudulent, or misleading content.",
      "Interfering with the security, integrity, or availability of the platform.",
      "Reverse engineering, scraping, or reselling the service except as expressly permitted.",
      "Using the service to process personal data in violation of applicable law.",
    ],
  },
  {
    id: "customer-data",
    title: "4. Your data and customer information",
    paragraphs: [
      "You retain ownership of the business data you enter into Numbatrak, including orders, customer contact details collected through your forms, delivery records, and financial snapshots.",
      "You are the data controller for customer and end-user information your organization collects. You must have a lawful basis to collect and process that information and must comply with applicable privacy laws, including Nigeria’s Nigeria Data Protection Act where it applies.",
      "You grant us a limited license to host, process, and display your data solely to provide and improve the service, as described in our Privacy Policy.",
    ],
  },
  {
    id: "order-forms",
    title: "5. Public order forms and integrations",
    paragraphs: [
      "If you publish order forms or embed them on external sites, you are responsible for the content of those forms, how they are presented to customers, and fulfillment of orders submitted through them.",
      "We may apply technical safeguards such as rate limiting and token validation on public submission endpoints to protect the platform and your organization.",
    ],
  },
  {
    id: "fees",
    title: "6. Fees and billing",
    paragraphs: [
      "Certain features may be offered at no charge during early access or trial periods. We reserve the right to introduce paid plans in the future. If we do, we will provide notice before charging your organization.",
    ],
  },
  {
    id: "ip",
    title: "7. Intellectual property",
    paragraphs: [
      "Numbatrak, including its software, branding, and documentation, is owned by us or our licensors. These Terms do not grant you any rights to our trademarks or underlying technology except the limited right to use the service as intended.",
    ],
  },
  {
    id: "availability",
    title: "8. Service availability",
    paragraphs: [
      "We aim to keep Numbatrak available and reliable but do not guarantee uninterrupted access. Maintenance, updates, or events outside our control may cause temporary downtime.",
      "Historical order economics (unit price, cost, and profit) are snapshotted at order creation. You should not rely on the service as your sole record-keeping system; maintain appropriate backups of critical business records.",
    ],
  },
  {
    id: "liability",
    title: "9. Disclaimers and limitation of liability",
    paragraphs: [
      "The service is provided “as is” to the fullest extent permitted by law. We disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement.",
      "To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits, revenue, data, or business opportunities arising from your use of Numbatrak.",
      "Our total liability for any claim relating to the service is limited to the greater of amounts you paid us in the twelve months before the claim or one hundred US dollars (USD $100).",
    ],
  },
  {
    id: "termination",
    title: "10. Suspension and termination",
    paragraphs: [
      "You may stop using the service at any time. We may suspend or terminate access if you materially breach these Terms, pose a security risk, or if required by law.",
      "Upon termination, your right to access the service ends. We may retain or delete organization data according to our Privacy Policy and applicable law.",
    ],
  },
  {
    id: "changes",
    title: "11. Changes to these Terms",
    paragraphs: [
      "We may update these Terms from time to time. The “Last updated” date at the top reflects the latest revision. Continued use after changes become effective constitutes acceptance of the revised Terms.",
    ],
  },
  {
    id: "law",
    title: "12. Governing law",
    paragraphs: [
      "These Terms are governed by the laws of the Federal Republic of Nigeria, without regard to conflict-of-law principles. Disputes shall be subject to the exclusive jurisdiction of courts in Nigeria, unless mandatory law requires otherwise.",
    ],
  },
];
