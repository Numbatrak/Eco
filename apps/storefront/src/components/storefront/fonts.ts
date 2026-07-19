import type { FontChoice } from "@platform/shared-types";

/** Maps a whitelisted `FontChoice` to a real `font-family` value. */
export const FONT_FAMILY: Record<FontChoice, string> = {
  bricolage: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
  fraunces: '"Fraunces", ui-serif, Georgia, serif',
  "space-grotesk": '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
  inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
  "cormorant-garamond": '"Cormorant Garamond", ui-serif, Georgia, serif',
  manrope: '"Manrope", ui-sans-serif, system-ui, sans-serif',
  "playfair-display": '"Playfair Display", ui-serif, Georgia, serif',
  lato: '"Lato", ui-sans-serif, system-ui, sans-serif',
  "dm-serif-display": '"DM Serif Display", ui-serif, Georgia, serif',
  "work-sans": '"Work Sans", ui-sans-serif, system-ui, sans-serif',
};

export const FONT_LABEL: Record<FontChoice, string> = {
  bricolage: "Bricolage Grotesque",
  fraunces: "Fraunces",
  "space-grotesk": "Space Grotesk",
  inter: "Inter",
  "cormorant-garamond": "Cormorant Garamond",
  manrope: "Manrope",
  "playfair-display": "Playfair Display",
  lato: "Lato",
  "dm-serif-display": "DM Serif Display",
  "work-sans": "Work Sans",
};

/** Google Fonts import URL for all supported fonts. */
export const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Space+Grotesk:wght@400;500;600&family=Inter:wght@400;500;600&family=Cormorant+Garamond:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&family=Lato:wght@400;700&family=DM+Serif+Display&family=Work+Sans:wght@400;500;600&display=swap";
