import { z } from "zod";

/**
 * Mirrors @platform/shared-types's site-config.ts by hand - numbatrak has
 * its own standalone pnpm-workspace.yaml (needed for its Cloudflare Workers
 * deploy) and isn't a member of the root workspace, so it can't resolve
 * `@platform/*` packages. Keep in sync with
 * packages/shared-types/src/site-config.ts by hand.
 */

// ---------- Template ----------
export const templateIdSchema = z.enum(["market", "studio", "corner"]);
export type TemplateId = z.infer<typeof templateIdSchema>;

// ---------- Theme ----------
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected #rrggbb");
export const fontChoiceSchema = z.enum([
  "bricolage",
  "fraunces",
  "space-grotesk",
  "inter",
  "cormorant-garamond",
  "manrope",
  "playfair-display",
  "lato",
  "dm-serif-display",
  "work-sans",
]);
export type FontChoice = z.infer<typeof fontChoiceSchema>;

export const sitePaletteSchema = z.object({
  ink: hexColorSchema,
  bg: hexColorSchema,
  accent: hexColorSchema,
  accentInk: hexColorSchema.optional(),
  muted: hexColorSchema.optional(),
});
export type SitePalette = z.infer<typeof sitePaletteSchema>;

export const siteTypographySchema = z.object({
  display: fontChoiceSchema,
  body: fontChoiceSchema,
});
export type SiteTypography = z.infer<typeof siteTypographySchema>;

export const siteThemeSchema = z.object({
  templateId: templateIdSchema,
  palette: sitePaletteSchema,
  typography: siteTypographySchema,
  logoUrl: z.string().nullable().optional(),
});
export type SiteTheme = z.infer<typeof siteThemeSchema>;

// ---------- Social links ----------
export const siteSocialLinksSchema = z.object({
  instagram: z.string().max(200).optional(),
  tiktok: z.string().max(200).optional(),
  twitter: z.string().max(200).optional(),
  facebook: z.string().max(200).optional(),
  whatsapp: z.string().max(30).optional(),
});
export type SiteSocialLinks = z.infer<typeof siteSocialLinksSchema>;

// ---------- Footer config ----------
export const siteFooterSchema = z.object({
  tagline: z.string().max(200).optional(),
  showSocial: z.boolean().optional(),
  columns: z
    .array(
      z.object({
        title: z.string().max(60),
        links: z.array(
          z.object({
            label: z.string().max(60),
            url: z.string().max(300),
          }),
        ),
      }),
    )
    .optional(),
});
export type SiteFooter = z.infer<typeof siteFooterSchema>;

// ---------- Sections ----------
const sectionBaseSchema = z.object({
  id: z.string().min(1),
  visible: z.boolean(),
});

export const heroSectionSchema = sectionBaseSchema.extend({
  kind: z.literal("hero"),
  eyebrow: z.string().max(120).optional().default(""),
  headline: z.string().max(200),
  sub: z.string().max(500),
  ctaLabel: z.string().max(60),
  ctaUrl: z.string().max(300).optional(),
  imageUrl: z.string().max(2000).optional(),
});
export type HeroSection = z.infer<typeof heroSectionSchema>;

export const productsSectionSchema = sectionBaseSchema.extend({
  kind: z.literal("products"),
  title: z.string().max(120).optional().default("On the counter today"),
});
export type ProductsSection = z.infer<typeof productsSectionSchema>;

export const visitSectionSchema = sectionBaseSchema.extend({
  kind: z.literal("visit"),
  title: z.string().max(120).optional().default("Visit & hours"),
  address: z.string().max(500).optional().default(""),
  hours: z.string().max(500).optional().default(""),
  contact: z.string().max(500).optional().default(""),
});
export type VisitSection = z.infer<typeof visitSectionSchema>;

export const announcementSectionSchema = sectionBaseSchema.extend({
  kind: z.literal("announcement"),
  messages: z.array(z.string().max(200)).min(1).max(8),
});
export type AnnouncementSection = z.infer<typeof announcementSectionSchema>;

export const featuredCollectionsSectionSchema = sectionBaseSchema.extend({
  kind: z.literal("featured-collections"),
  title: z.string().max(120).optional().default("Collections"),
  eyebrow: z.string().max(120).optional().default(""),
  maxItems: z.number().int().min(1).max(6).optional().default(3),
});
export type FeaturedCollectionsSection = z.infer<typeof featuredCollectionsSectionSchema>;

export const brandStorySectionSchema = sectionBaseSchema.extend({
  kind: z.literal("brand-story"),
  eyebrow: z.string().max(120).optional().default(""),
  headline: z.string().max(200),
  body: z.string().max(1000),
  ctaLabel: z.string().max(60).optional(),
  ctaUrl: z.string().max(300).optional(),
});
export type BrandStorySection = z.infer<typeof brandStorySectionSchema>;

export const trustBadgeItemSchema = z.object({
  title: z.string().max(80),
  body: z.string().max(200),
});
export type TrustBadgeItem = z.infer<typeof trustBadgeItemSchema>;

export const trustBadgesSectionSchema = sectionBaseSchema.extend({
  kind: z.literal("trust-badges"),
  items: z.array(trustBadgeItemSchema).min(1).max(6),
});
export type TrustBadgesSection = z.infer<typeof trustBadgesSectionSchema>;

export const siteSectionSchema = z.discriminatedUnion("kind", [
  heroSectionSchema,
  productsSectionSchema,
  visitSectionSchema,
  announcementSectionSchema,
  featuredCollectionsSectionSchema,
  brandStorySectionSchema,
  trustBadgesSectionSchema,
]);
export type SiteSection = z.infer<typeof siteSectionSchema>;
export type SiteSectionKind = SiteSection["kind"];

// ---------- Config ----------
export const siteConfigSchema = z.object({
  theme: siteThemeSchema,
  sections: z.array(siteSectionSchema),
  social: siteSocialLinksSchema.optional(),
  footer: siteFooterSchema.optional(),
});
export type SiteConfig = z.infer<typeof siteConfigSchema>;

// ---------- Presets ----------
const TEMPLATE_PALETTES: Record<TemplateId, SitePalette> = {
  market: { ink: "#191510", bg: "#FBF7F0", accent: "#D98E2B" },
  studio: { ink: "#16231F", bg: "#F3F1E7", accent: "#2F6B5E" },
  corner: { ink: "#171B26", bg: "#F5F1EC", accent: "#A23E48" },
};

const TEMPLATE_TYPOGRAPHY: Record<TemplateId, SiteTypography> = {
  market: { display: "bricolage", body: "space-grotesk" },
  studio: { display: "fraunces", body: "inter" },
  corner: { display: "bricolage", body: "space-grotesk" },
};

export function defaultSiteConfig(templateId: TemplateId = "market"): SiteConfig {
  return {
    theme: {
      templateId,
      palette: TEMPLATE_PALETTES[templateId],
      typography: TEMPLATE_TYPOGRAPHY[templateId],
      logoUrl: null,
    },
    sections: [
      {
        id: "announcement",
        kind: "announcement",
        visible: false,
        messages: ["Free shipping on orders over ₦50,000", "New arrivals every week"],
      },
      {
        id: "hero",
        kind: "hero",
        visible: true,
        eyebrow: "Small batch · fresh weekly",
        headline: "Something worth slowing down for.",
        sub: "A short line about what makes this shop yours - the people, the pace, the reason someone should come back.",
        ctaLabel: "See what's in",
      },
      {
        id: "featured-collections",
        kind: "featured-collections",
        visible: false,
        eyebrow: "Browse",
        title: "Collections",
        maxItems: 3,
      },
      {
        id: "products",
        kind: "products",
        visible: true,
        title: "On the counter today",
      },
      {
        id: "brand-story",
        kind: "brand-story",
        visible: false,
        eyebrow: "",
        headline: "Our story",
        body: "Tell your customers what makes your brand special. What you stand for, why you started, and why they should care.",
        ctaLabel: "",
      },
      {
        id: "trust-badges",
        kind: "trust-badges",
        visible: false,
        items: [
          { title: "Fast delivery", body: "Orders ship within 24 hours." },
          { title: "Secure payment", body: "All transactions are encrypted and safe." },
          { title: "Quality guaranteed", body: "We stand behind everything we sell." },
          { title: "Easy returns", body: "Not happy? Return within 7 days." },
        ],
      },
      {
        id: "visit",
        kind: "visit",
        visible: true,
        title: "Visit & hours",
        address: "14 Aina Street\nLagos, NG",
        hours: "Mon–Fri · 7am–5pm\nSat–Sun · 8am–3pm",
        contact: "hello@yourshop.com",
      },
    ],
    social: {},
    footer: { tagline: "", showSocial: true },
  };
}

export const TEMPLATE_PRESETS: Record<TemplateId, { palette: SitePalette; typography: SiteTypography }> = Object.fromEntries(
  (templateIdSchema.options as TemplateId[]).map((t) => [
    t,
    { palette: TEMPLATE_PALETTES[t], typography: TEMPLATE_TYPOGRAPHY[t] },
  ]),
) as Record<TemplateId, { palette: SitePalette; typography: SiteTypography }>;

export const FONT_PAIRINGS: Array<{ display: FontChoice; body: FontChoice; label: string }> = [
  { display: "bricolage", body: "space-grotesk", label: "Bricolage + Space Grotesk" },
  { display: "fraunces", body: "inter", label: "Fraunces + Inter" },
  { display: "cormorant-garamond", body: "manrope", label: "Cormorant + Manrope" },
  { display: "playfair-display", body: "lato", label: "Playfair + Lato" },
  { display: "dm-serif-display", body: "work-sans", label: "DM Serif + Work Sans" },
];

export const SECTION_CATALOG: Array<{ kind: SiteSectionKind; label: string; description: string }> = [
  { kind: "announcement", label: "Announcement Bar", description: "Scrolling messages at the top of your store" },
  { kind: "hero", label: "Hero", description: "Large banner with headline and call to action" },
  { kind: "featured-collections", label: "Featured Collections", description: "Showcase your top collections" },
  { kind: "products", label: "Products", description: "Display your product catalog" },
  { kind: "brand-story", label: "Brand Story", description: "Tell your brand's story" },
  { kind: "trust-badges", label: "Trust Badges", description: "Highlight your store's promises" },
  { kind: "visit", label: "Visit & Hours", description: "Share your location and hours" },
];
