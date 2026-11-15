// Mirrors apps/api/src/lib/slug.ts (slugJoin) - only used to preview the code
// the server will derive; the server is the source of truth (and appends
// "-2", "-3"... if the code is already taken).
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function previewCode(parts: string[]): string {
  return parts.map(slugify).filter(Boolean).join("-").slice(0, 57).replace(/-+$/g, "");
}

export const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Same rule as the API: "shop.com/page" means https; only http(s) pages with a dotted host. */
export function normalizePageUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return /^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#]\S*)?$/i.test(withScheme) ? withScheme : null;
}

/**
 * Preview of the link the API will hand back (it builds the real one - see
 * buildTrackingUrl in the API's tracking-links lib). Display only.
 */
export function previewLink(pageUrl: string, tags: { code: string; platform: string; campaign: string; buyer: string }): string | null {
  const normalized = normalizePageUrl(pageUrl);
  if (!normalized || !tags.code) return null;
  try {
    const url = new URL(normalized);
    url.searchParams.set("tl", tags.code);
    url.searchParams.set("utm_source", slugify(tags.platform) || "ads");
    url.searchParams.set("utm_medium", "paid");
    if (tags.campaign) url.searchParams.set("utm_campaign", slugify(tags.campaign) || "offer");
    url.searchParams.set("utm_content", slugify(tags.buyer) || "buyer");
    return url.toString();
  } catch {
    return null;
  }
}
