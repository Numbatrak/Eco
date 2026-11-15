/**
 * URL-safe slug helpers.
 *
 * Several modules had grown their own private `slugify` (auth/routes/register,
 * platform-admin/lib/affiliates-store, and three more on the client side) with
 * subtly different separators and length caps. New code should use this one.
 *
 * The output is deliberately restricted to `[a-z0-9-]` so a slug can be dropped
 * straight into a query string without encoding — several callers build URLs by
 * string concatenation rather than URLSearchParams, so a slug containing `&`,
 * `#`, `+`, `=` or a space would silently truncate the value.
 */

export interface SlugifyOptions {
  /** Hard cap on the result, applied before trailing separators are trimmed. */
  maxLength?: number;
  /** Returned when the input slugifies to nothing (e.g. "!!!" or non-Latin text). */
  fallback?: string;
}

export function slugify(value: string, options: SlugifyOptions = {}): string {
  const { maxLength = 40, fallback = "" } = options;

  const slug = value
    .normalize("NFKD")
    // Strip combining marks so "Adégún" slugs as "adegun" rather than losing the vowel.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    // Re-trim: slicing can leave a trailing separator behind.
    .replace(/-+$/g, "");

  return slug || fallback;
}

/**
 * Joins already-meaningful parts into one slug, dropping parts that slugify to
 * nothing. `slugJoin(["AdGuys", "TikTok"])` -> "adguys-tiktok".
 */
export function slugJoin(parts: Array<string | null | undefined>, options: SlugifyOptions = {}): string {
  const { maxLength = 60, fallback = "" } = options;
  const joined = parts
    .map((part) => (part ? slugify(part, { maxLength }) : ""))
    .filter(Boolean)
    .join("-");
  return joined.slice(0, maxLength).replace(/-+$/g, "") || fallback;
}

/** True when `value` is already a well-formed slug — used to validate caller-supplied codes. */
export function isSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
