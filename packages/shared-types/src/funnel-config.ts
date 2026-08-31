import { z } from "zod";
import { publicSiteProductSchema } from "./commerce.js";

/**
 * Funnel Mode: a standalone, single-product landing page a merchant turns
 * on per-product (see product_funnel_config in packages/db), distinct from
 * tenant_site_config's whole-site sections in site-config.ts. Same shape
 * convention (discriminated union over a {id, visible} base) so the builder
 * UI can reuse the same array-editing pattern, but a separate schema/table
 * since this is per-product, not per-tenant.
 */

const funnelSectionBaseSchema = z.object({
  id: z.string().min(1),
  visible: z.boolean(),
});

export const funnelHeroSectionSchema = funnelSectionBaseSchema.extend({
  kind: z.literal("funnel-hero"),
  eyebrow: z.string().max(120).optional().default(""),
  headline: z.string().max(200),
  sub: z.string().max(500),
});
export type FunnelHeroSection = z.infer<typeof funnelHeroSectionSchema>;

export const funnelStorySectionSchema = funnelSectionBaseSchema.extend({
  kind: z.literal("funnel-story"),
  title: z.string().max(120),
  body: z.string().max(2000),
});
export type FunnelStorySection = z.infer<typeof funnelStorySectionSchema>;

export const funnelSolutionSectionSchema = funnelSectionBaseSchema.extend({
  kind: z.literal("funnel-solution"),
  title: z.string().max(120),
  body: z.string().max(2000),
});
export type FunnelSolutionSection = z.infer<typeof funnelSolutionSectionSchema>;

export const funnelHowItWorksStepSchema = z.object({
  title: z.string().max(120),
  body: z.string().max(500),
});
export type FunnelHowItWorksStep = z.infer<typeof funnelHowItWorksStepSchema>;

export const funnelHowItWorksSectionSchema = funnelSectionBaseSchema.extend({
  kind: z.literal("funnel-how-it-works"),
  title: z.string().max(120),
  steps: z.array(funnelHowItWorksStepSchema).min(1).max(8),
});
export type FunnelHowItWorksSection = z.infer<typeof funnelHowItWorksSectionSchema>;

export const funnelWhoItsForSectionSchema = funnelSectionBaseSchema.extend({
  kind: z.literal("funnel-who-its-for"),
  title: z.string().max(120),
  items: z.array(z.string().max(200)).min(1).max(10),
});
export type FunnelWhoItsForSection = z.infer<typeof funnelWhoItsForSectionSchema>;

export const funnelTestimonialSchema = z.object({
  quote: z.string().max(1000),
  author: z.string().max(120),
});
export type FunnelTestimonial = z.infer<typeof funnelTestimonialSchema>;

export const funnelTestimonialsSectionSchema = funnelSectionBaseSchema.extend({
  kind: z.literal("funnel-testimonials"),
  title: z.string().max(120),
  items: z.array(funnelTestimonialSchema).min(1).max(10),
});
export type FunnelTestimonialsSection = z.infer<typeof funnelTestimonialsSectionSchema>;

/**
 * A package is content-defined pricing, not a reusable offers/discounts
 * entity (that's a separate, later phase) - priceCents is the total for
 * `quantity` units, always resolved server-side, never trusted from the
 * client (see apps/api's funnel add-to-cart route).
 */
export const funnelPackageOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().max(120),
  quantity: z.number().int().positive().max(999),
  priceCents: z.number().int().nonnegative(),
  badge: z.string().max(60).optional(),
});
export type FunnelPackageOption = z.infer<typeof funnelPackageOptionSchema>;

export const funnelPackagesSectionSchema = funnelSectionBaseSchema.extend({
  kind: z.literal("funnel-packages"),
  title: z.string().max(120),
  options: z.array(funnelPackageOptionSchema).min(1).max(6),
});
export type FunnelPackagesSection = z.infer<typeof funnelPackagesSectionSchema>;

export const funnelGuaranteeSectionSchema = funnelSectionBaseSchema.extend({
  kind: z.literal("funnel-guarantee"),
  title: z.string().max(120),
  body: z.string().max(1000),
});
export type FunnelGuaranteeSection = z.infer<typeof funnelGuaranteeSectionSchema>;

export const funnelFaqItemSchema = z.object({
  question: z.string().max(200),
  answer: z.string().max(1000),
});
export type FunnelFaqItem = z.infer<typeof funnelFaqItemSchema>;

export const funnelFaqSectionSchema = funnelSectionBaseSchema.extend({
  kind: z.literal("funnel-faq"),
  title: z.string().max(120),
  items: z.array(funnelFaqItemSchema).min(1).max(15),
});
export type FunnelFaqSection = z.infer<typeof funnelFaqSectionSchema>;

/** Marks where the (code-rendered) inline order form appears - only its
 * heading/CTA copy is owner content. */
export const funnelOrderSectionSchema = funnelSectionBaseSchema.extend({
  kind: z.literal("funnel-order"),
  title: z.string().max(120),
  ctaLabel: z.string().max(60),
});
export type FunnelOrderSection = z.infer<typeof funnelOrderSectionSchema>;

export const funnelSectionSchema = z.discriminatedUnion("kind", [
  funnelHeroSectionSchema,
  funnelStorySectionSchema,
  funnelSolutionSectionSchema,
  funnelHowItWorksSectionSchema,
  funnelWhoItsForSectionSchema,
  funnelTestimonialsSectionSchema,
  funnelPackagesSectionSchema,
  funnelGuaranteeSectionSchema,
  funnelFaqSectionSchema,
  funnelOrderSectionSchema,
]);
export type FunnelSection = z.infer<typeof funnelSectionSchema>;
export type FunnelSectionKind = FunnelSection["kind"];

export const funnelConfigSchema = z.object({
  sections: z.array(funnelSectionSchema),
});
export type FunnelConfig = z.infer<typeof funnelConfigSchema>;

// GET-only response shape - isPublished is derived server-side (publishedAt
// !== null) and never accepted on the PUT body, which only ever writes
// sections.
export const funnelConfigResponseSchema = funnelConfigSchema.extend({
  isPublished: z.boolean(),
});
export type FunnelConfigResponse = z.infer<typeof funnelConfigResponseSchema>;

export const FUNNEL_SECTION_CATALOG: Array<{
  kind: FunnelSectionKind;
  label: string;
  description: string;
}> = [
  { kind: "funnel-hero", label: "Hero", description: "The problem headline that opens the page" },
  { kind: "funnel-story", label: "Story", description: "Why this product exists" },
  { kind: "funnel-solution", label: "Solution", description: "How this product solves it" },
  { kind: "funnel-how-it-works", label: "How It Works", description: "Step-by-step usage" },
  { kind: "funnel-who-its-for", label: "Who It's For", description: "Who this product is made for" },
  { kind: "funnel-testimonials", label: "Testimonials", description: "Social proof from customers" },
  { kind: "funnel-packages", label: "Packages", description: "Pricing tiers the buyer picks from" },
  { kind: "funnel-guarantee", label: "Guarantee", description: "Trust and risk-reversal copy" },
  { kind: "funnel-faq", label: "FAQ", description: "Common questions" },
  { kind: "funnel-order", label: "Order Form", description: "Where the inline order form appears" },
];

export function defaultFunnelSections(): FunnelSection[] {
  return [
    {
      id: "funnel-hero",
      kind: "funnel-hero",
      visible: true,
      eyebrow: "Introducing",
      headline: "Something worth trying.",
      sub: "A short line about the problem this product solves.",
    },
    {
      id: "funnel-story",
      kind: "funnel-story",
      visible: true,
      title: "Our story",
      body: "Tell buyers why this product exists.",
    },
    {
      id: "funnel-solution",
      kind: "funnel-solution",
      visible: true,
      title: "The solution",
      body: "Explain how this product solves the problem.",
    },
    {
      id: "funnel-how-it-works",
      kind: "funnel-how-it-works",
      visible: true,
      title: "How it works",
      steps: [
        { title: "Step 1", body: "Describe the first step." },
        { title: "Step 2", body: "Describe the second step." },
        { title: "Step 3", body: "Describe the third step." },
      ],
    },
    {
      id: "funnel-who-its-for",
      kind: "funnel-who-its-for",
      visible: true,
      title: "Who it's for",
      items: ["Anyone who wants a better result.", "People tired of what's out there."],
    },
    {
      id: "funnel-testimonials",
      kind: "funnel-testimonials",
      visible: true,
      title: "What customers say",
      items: [{ quote: "This changed everything for me.", author: "A happy customer" }],
    },
    {
      id: "funnel-packages",
      kind: "funnel-packages",
      visible: true,
      title: "Choose your package",
      options: [{ id: "single", label: "1 unit", quantity: 1, priceCents: 0 }],
    },
    {
      id: "funnel-guarantee",
      kind: "funnel-guarantee",
      visible: true,
      title: "Our guarantee",
      body: "Describe your guarantee or return policy.",
    },
    {
      id: "funnel-faq",
      kind: "funnel-faq",
      visible: true,
      title: "Frequently asked questions",
      items: [{ question: "How long does delivery take?", answer: "Describe your delivery timeline." }],
    },
    {
      id: "funnel-order",
      kind: "funnel-order",
      visible: true,
      title: "Order now",
      ctaLabel: "Place order",
    },
  ];
}

export const publicFunnelSchema = z.object({
  tenant: z.object({
    id: z.string(),
    name: z.string(),
    subdomain: z.string(),
  }),
  product: publicSiteProductSchema,
  sections: z.array(funnelSectionSchema),
});
export type PublicFunnel = z.infer<typeof publicFunnelSchema>;
