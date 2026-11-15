import { randomBytes } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { and, eq } from "drizzle-orm";
import {
  numbatrakFormIntakeSettings,
  numbatrakForms,
  numbatrakProductOffers,
  numbatrakProducts,
  type Database,
  type Queryable,
} from "@platform/db";
import type { PublicFormLineItem, SubmitPublicNumbatrakFormResult } from "@platform/shared-types";
import { extractTrackingLinkCode } from "../../numbatrak-crm/lib/attribution.js";
import { findActiveTrackingLinkByCode } from "../../numbatrak-tracking-links/lib/tracking-links.js";
import { submitFormOrder, type IntakeTarget } from "./intake.js";
import { buildSubmittedData, detectFields, extractOfferId, flattenSubmission } from "./payload.js";

/** Plugins the org-wide intake address is set up for; also stored as the submission's source. */
export const INTAKE_PROVIDERS = ["fluent-forms", "elementor", "wpforms", "other"] as const;
export type IntakeProvider = (typeof INTAKE_PROVIDERS)[number];

export function isIntakeProvider(value: string): value is IntakeProvider {
  return (INTAKE_PROVIDERS as readonly string[]).includes(value);
}

function newIntakeToken(): string {
  return `intake_${randomBytes(20).toString("hex")}`;
}

export async function getOrCreateIntakeToken(db: Database, organizationId: string): Promise<string> {
  const [existing] = await db
    .select({ token: numbatrakFormIntakeSettings.token })
    .from(numbatrakFormIntakeSettings)
    .where(eq(numbatrakFormIntakeSettings.organizationId, organizationId))
    .limit(1);
  if (existing) return existing.token;
  await db
    .insert(numbatrakFormIntakeSettings)
    .values({ organizationId, token: newIntakeToken() })
    .onConflictDoNothing({ target: numbatrakFormIntakeSettings.organizationId });
  // Re-read so two first visits at once both see the row that won.
  const [row] = await db
    .select({ token: numbatrakFormIntakeSettings.token })
    .from(numbatrakFormIntakeSettings)
    .where(eq(numbatrakFormIntakeSettings.organizationId, organizationId))
    .limit(1);
  if (!row) throw new Error("Failed to create intake address");
  return row.token;
}

/** Replaces the token; the old address stops working immediately. */
export async function rotateIntakeToken(db: Database, organizationId: string): Promise<string> {
  const token = newIntakeToken();
  await db
    .insert(numbatrakFormIntakeSettings)
    .values({ organizationId, token })
    .onConflictDoUpdate({
      target: numbatrakFormIntakeSettings.organizationId,
      set: { token, rotatedAt: new Date() },
    });
  return token;
}

export async function findOrgByIntakeToken(db: Database, token: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: numbatrakFormIntakeSettings.organizationId })
    .from(numbatrakFormIntakeSettings)
    .where(eq(numbatrakFormIntakeSettings.token, token))
    .limit(1);
  return row?.organizationId ?? null;
}

interface ResolvedOffer {
  id: string;
  productId: string;
  variantId: string | null;
  label: string;
  productName: string;
}

const normalizeLabel = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Finds the offer a package answer points at. The reliable path is the offer
 * ID we hand out as each option's value. As a fallback for forms set up
 * before that, an answer that is (or starts with) exactly one active offer's
 * name also counts; two offers with the same name count as no match.
 */
export async function resolveOfferFromAnswer(
  db: Queryable,
  organizationId: string,
  answer: string | null,
): Promise<ResolvedOffer | null> {
  if (!answer) return null;
  const offerId = extractOfferId(answer);

  const rows = await db
    .select({
      id: numbatrakProductOffers.id,
      productId: numbatrakProductOffers.productId,
      variantId: numbatrakProductOffers.variantId,
      label: numbatrakProductOffers.label,
      productName: numbatrakProducts.name,
    })
    .from(numbatrakProductOffers)
    .innerJoin(numbatrakProducts, eq(numbatrakProducts.id, numbatrakProductOffers.productId))
    .where(
      and(
        eq(numbatrakProductOffers.organizationId, organizationId),
        eq(numbatrakProductOffers.active, true),
        ...(offerId ? [eq(numbatrakProductOffers.id, offerId)] : []),
      ),
    );

  if (offerId) return rows[0] ?? null;

  const wanted = normalizeLabel(answer);
  const matches = rows.filter((row) => {
    const label = normalizeLabel(row.label);
    if (!label) return false;
    if (wanted === label) return true;
    // "Buy 2 Get 2 Free — ₦65,000": the name, then a non-word character.
    return wanted.startsWith(label) && /^[^\p{L}\p{N}]/u.test(wanted.slice(label.length));
  });
  return matches.length === 1 ? matches[0]! : null;
}

export interface OrgIntakeInput {
  provider: IntakeProvider;
  body: unknown;
  /** Optional `?funnel=` on the address, for forms not tied to a tracking link. */
  funnel?: string | null;
}

/**
 * Intake for the org-wide address: reads the fields by their usual names,
 * turns the package answer into a real offer (true units, cost and price
 * come from the offer, not the form), and files the order under the form
 * the tracking link belongs to - or under the business alone when there's
 * no link.
 */
export async function submitOrgIntake(
  db: Database,
  organizationId: string,
  input: OrgIntakeInput,
  logger?: FastifyBaseLogger,
): Promise<SubmitPublicNumbatrakFormResult & { offerMatched: boolean }> {
  const flat = flattenSubmission(input.body);
  const fields = detectFields(flat);

  // The package field is often still called "input_radio" or similar; any
  // value carrying one of our offer IDs is the package.
  const packageAnswer =
    (fields.package && extractOfferId(fields.package) ? fields.package : null) ??
    Object.values(flat).find((v) => extractOfferId(v) !== null) ??
    fields.package ??
    null;
  const offer = await resolveOfferFromAnswer(db, organizationId, packageAnswer);

  const quantity = Math.min(Math.max(Number.parseInt(fields.quantity ?? "", 10) || 1, 1), 100);
  const items: PublicFormLineItem[] = offer
    ? [{ productId: offer.productId, quantity, variantId: offer.variantId, offerId: offer.id }]
    : [];

  const funnel = input.funnel?.trim() || null;
  let target: IntakeTarget = {
    id: null,
    organizationId,
    name: funnel ?? offer?.productName ?? "Website form",
    funnelName: funnel ?? offer?.productName ?? null,
    subBrand: null,
    schema: {},
  };

  // No hidden tl field? The page address the plugin reports (Elementor's
  // meta.page_url, a referrer...) may still carry ?tl=.
  const pageUrl = Object.values(flat).find((v) => /^https?:\/\//i.test(v) && extractTrackingLinkCode(v)) ?? null;
  const code = fields.trackingLinkCode?.trim() || extractTrackingLinkCode(pageUrl) || null;
  if (code) {
    const link = await findActiveTrackingLinkByCode(db, organizationId, code);
    if (link?.formId) {
      const [form] = await db
        .select()
        .from(numbatrakForms)
        .where(and(eq(numbatrakForms.id, link.formId), eq(numbatrakForms.organizationId, organizationId)))
        .limit(1);
      if (form) target = form;
    }
  }

  const fieldValues: Record<string, unknown> = {
    customer_name: fields.name,
    first_name: fields.name ? undefined : fields.firstName,
    last_name: fields.name ? undefined : fields.lastName,
    phone: fields.phone,
    whatsapp: fields.whatsapp,
    address: fields.address,
    state: fields.state,
  };

  const result = await submitFormOrder(
    db,
    target,
    {
      fieldValues,
      items,
      source: input.provider,
      pageUrl,
      offerName: offer?.label ?? null,
      packageName: offer ? null : (packageAnswer ?? null),
      trackingLinkCode: code,
      notes: fields.notes ?? null,
      skipSchemaValidation: true,
      submittedData: buildSubmittedData(input.provider, flat),
    },
    logger,
  );
  return { ...result, offerMatched: offer !== null };
}
