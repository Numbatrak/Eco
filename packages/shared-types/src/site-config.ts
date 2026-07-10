import { z } from "zod";

// ---------- Template ----------
export const templateIdSchema = z.enum(["market", "studio", "corner"]);
export type TemplateId = z.infer<typeof templateIdSchema>;

// ---------- Theme ----------
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected #rrggbb");
export const fontChoiceSchema = z.enum(["bricolage", "fraunces", "space-grotesk", "inter"]);
export type FontChoice = z.infer<typeof fontChoiceSchema>;

export const sitePaletteSchema = z.object({
  ink: hexColorSchema,
  bg: hexColorSchema,
  accent: hexColorSchema,
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

export const siteSectionSchema = z.discriminatedUnion("kind", [
  heroSectionSchema,
  productsSectionSchema,
  visitSectionSchema,
]);
export type SiteSection = z.infer<typeof siteSectionSchema>;
export type SiteSectionKind = SiteSection["kind"];

// ---------- Config ----------
export const siteConfigSchema = z.object({
  theme: siteThemeSchema,
  sections: z.array(siteSectionSchema),
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

/**
 * Seeded when a fresh tenant loads the builder for the first time, or when a
 * legacy `tenant_site_config` row fails to parse against the current schema.
 */
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
        id: "hero",
        kind: "hero",
        visible: true,
        eyebrow: "Small batch · fresh weekly",
        headline: "Something worth slowing down for.",
        sub: "A short line about what makes this shop yours - the people, the pace, the reason someone should come back.",
        ctaLabel: "See what's in",
      },
      {
        id: "products",
        kind: "products",
        visible: true,
        title: "On the counter today",
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
  };
}

export const TEMPLATE_PRESETS: Record<TemplateId, { palette: SitePalette; typography: SiteTypography }> = Object.fromEntries(
  (templateIdSchema.options as TemplateId[]).map((t) => [
    t,
    { palette: TEMPLATE_PALETTES[t], typography: TEMPLATE_TYPOGRAPHY[t] },
  ]),
) as Record<TemplateId, { palette: SitePalette; typography: SiteTypography }>;
