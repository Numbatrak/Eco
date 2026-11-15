import { randomBytes } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import {
  numbatrakAbandonedCarts,
  numbatrakCustomerOrders,
  numbatrakFormIntakeSettings,
  numbatrakForms,
  numbatrakProductOffers,
  numbatrakProducts,
  type Database,
  type Queryable,
} from "@platform/db";
import type { PublicFormLineItem, SubmitPublicNumbatrakFormResult } from "@platform/shared-types";
import { extractTrackingLinkCode } from "../../numbatrak-crm/lib/attribution.js";
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
}

/** Marker in a form's schema for a form that lives on the business's website, not in the builder. */
export interface ExternalFormMarker {
  provider: IntakeProvider;
}

export function externalFormProvider(schema: unknown): IntakeProvider | null {
  const external = (schema as { external?: { provider?: unknown } } | null)?.external;
  const provider = typeof external?.provider === "string" ? external.provider : null;
  return provider && isIntakeProvider(provider) ? provider : null;
}

export interface ExternalForm {
  id: string;
  name: string;
  provider: IntakeProvider;
  createdAt: string | null;
}

/** Website forms connected through Form Integrations, newest first. */
export async function listExternalForms(db: Database, organizationId: string): Promise<ExternalForm[]> {
  const rows = await db
    .select({
      id: numbatrakForms.id,
      name: numbatrakForms.name,
      schema: numbatrakForms.schema,
      createdAt: numbatrakForms.createdAt,
    })
    .from(numbatrakForms)
    .where(and(eq(numbatrakForms.organizationId, organizationId), sql`${numbatrakForms.schema} ? 'external'`))
    .orderBy(desc(numbatrakForms.createdAt));
  return rows.flatMap((r) => {
    const provider = externalFormProvider(r.schema);
    return provider ? [{ id: r.id, name: r.name, provider, createdAt: r.createdAt?.toISOString() ?? null }] : [];
  });
}

export class DuplicateFormNameError extends Error {}

/**
 * Registers a website form as a NumbaTrak form, so it's a funnel everywhere
 * (dashboard Funnel filter, reports, tracking links) and gets its own
 * webhook address. The name is the funnel's name, so it must be unique
 * among the business's forms (ignoring case and extra spaces).
 */
export async function createExternalForm(
  db: Database,
  organizationId: string,
  input: { name: string; provider: IntakeProvider },
): Promise<ExternalForm> {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Give the form a name");
  if (name.length > 120) throw new Error("Keep the name under 120 characters");

  const [clash] = await db
    .select({ id: numbatrakForms.id })
    .from(numbatrakForms)
    .where(
      and(
        eq(numbatrakForms.organizationId, organizationId),
        sql`lower(${numbatrakForms.name}) = lower(${name})`,
      ),
    )
    .limit(1);
  if (clash) throw new DuplicateFormNameError(`You already have a form called "${name}". Pick another name.`);

  const marker: ExternalFormMarker = { provider: input.provider };
  const [row] = await db
    .insert(numbatrakForms)
    .values({
      organizationId,
      name,
      funnelName: name,
      formToken: `form_live_${randomBytes(16).toString("hex")}`,
      schema: { fields: [], external: marker },
      active: true,
    })
    .returning({ id: numbatrakForms.id, name: numbatrakForms.name, createdAt: numbatrakForms.createdAt });
  if (!row) throw new Error("Failed to create form");
  return { id: row.id, name: row.name, provider: input.provider, createdAt: row.createdAt?.toISOString() ?? null };
}

export class UnknownIntakeFormError extends Error {}

/** The website form a webhook address points at; must be this org's, active, and a website form. */
export async function findExternalForm(db: Database, organizationId: string, formId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(formId)) return null;
  const [form] = await db
    .select()
    .from(numbatrakForms)
    .where(and(eq(numbatrakForms.id, formId), eq(numbatrakForms.organizationId, organizationId)))
    .limit(1);
  if (!form || !form.active || !externalFormProvider(form.schema)) return null;
  return form;
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
  form: IntakeTarget & { id: string },
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
  const organizationId = form.organizationId;
  const offer = await resolveOfferFromAnswer(db, organizationId, packageAnswer);

  const quantity = Math.min(Math.max(Number.parseInt(fields.quantity ?? "", 10) || 1, 1), 100);
  const items: PublicFormLineItem[] = offer
    ? [{ productId: offer.productId, quantity, variantId: offer.variantId, offerId: offer.id }]
    : [];

  // No hidden tl field? The page address the plugin reports (Elementor's
  // meta.page_url, a referrer...) may still carry ?tl=. A link made for a
  // different form is ignored by submitFormOrder, so ads stay per funnel.
  const pageUrl = Object.values(flat).find((v) => /^https?:\/\//i.test(v) && extractTrackingLinkCode(v)) ?? null;
  const code = fields.trackingLinkCode?.trim() || extractTrackingLinkCode(pageUrl) || null;

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
    form,
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

export interface RecentSubmission {
  kind: "order" | "abandoned_cart";
  id: string;
  formId: string | null;
  customerName: string | null;
  /** The offer it was matched to (orders), or the raw package answer (carts). */
  packageName: string | null;
  provider: string | null;
  receivedAt: string | null;
}

/**
 * The latest website submissions (anything saved with submitted details),
 * newest first - lets the setup walkthrough show "your test entry arrived".
 * An entry that landed as an abandoned cart usually means the package
 * wasn't recognised or a needed field was missing.
 */
export async function listRecentSubmissions(
  db: Database,
  organizationId: string,
  options: { formId?: string | null; limit?: number } = {},
): Promise<RecentSubmission[]> {
  const limit = options.limit ?? 5;
  const formId = options.formId ?? null;
  const providerOf = (data: unknown) =>
    data && typeof data === "object" && typeof (data as { provider?: unknown }).provider === "string"
      ? (data as { provider: string }).provider
      : null;

  const [orders, carts] = await Promise.all([
    db
      .select({
        id: numbatrakCustomerOrders.id,
        formId: numbatrakCustomerOrders.formId,
        customerName: numbatrakCustomerOrders.customerName,
        offerName: numbatrakCustomerOrders.offerName,
        submittedData: numbatrakCustomerOrders.submittedData,
        createdAt: numbatrakCustomerOrders.createdAt,
      })
      .from(numbatrakCustomerOrders)
      .where(
        and(
          eq(numbatrakCustomerOrders.organizationId, organizationId),
          isNotNull(numbatrakCustomerOrders.submittedData),
          ...(formId ? [eq(numbatrakCustomerOrders.formId, formId)] : []),
        ),
      )
      .orderBy(desc(numbatrakCustomerOrders.createdAt))
      .limit(limit),
    db
      .select({
        id: numbatrakAbandonedCarts.id,
        formId: numbatrakAbandonedCarts.formId,
        customerName: numbatrakAbandonedCarts.customerName,
        selectedPackage: numbatrakAbandonedCarts.selectedPackage,
        submittedData: numbatrakAbandonedCarts.submittedData,
        createdAt: numbatrakAbandonedCarts.createdAt,
        convertedToOrder: numbatrakAbandonedCarts.convertedToOrder,
      })
      .from(numbatrakAbandonedCarts)
      .where(
        and(
          eq(numbatrakAbandonedCarts.organizationId, organizationId),
          isNotNull(numbatrakAbandonedCarts.submittedData),
          ...(formId ? [eq(numbatrakAbandonedCarts.formId, formId)] : []),
        ),
      )
      .orderBy(desc(numbatrakAbandonedCarts.createdAt))
      .limit(limit),
  ]);

  const rows: RecentSubmission[] = [
    ...orders.map((o) => ({
      kind: "order" as const,
      id: o.id,
      formId: o.formId,
      customerName: o.customerName,
      packageName: o.offerName,
      provider: providerOf(o.submittedData),
      receivedAt: o.createdAt?.toISOString() ?? null,
    })),
    // A converted cart already shows up as its order.
    ...carts
      .filter((c) => !c.convertedToOrder)
      .map((c) => ({
        kind: "abandoned_cart" as const,
        id: c.id,
        formId: c.formId,
        customerName: c.customerName,
        packageName: c.selectedPackage,
        provider: providerOf(c.submittedData),
        receivedAt: c.createdAt?.toISOString() ?? null,
      })),
  ];
  return rows.sort((a, b) => (b.receivedAt ?? "").localeCompare(a.receivedAt ?? "")).slice(0, limit);
}
