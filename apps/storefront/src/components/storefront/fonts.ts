import type { FontChoice } from "@platform/shared-types";

/** Maps a whitelisted `FontChoice` to a real `font-family` value. */
export const FONT_FAMILY: Record<FontChoice, string> = {
  bricolage: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
  fraunces: '"Fraunces", ui-serif, Georgia, serif',
  "space-grotesk": '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
  inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
};

export const FONT_LABEL: Record<FontChoice, string> = {
  bricolage: "Bricolage Grotesque",
  fraunces: "Fraunces",
  "space-grotesk": "Space Grotesk",
  inter: "Inter",
};
