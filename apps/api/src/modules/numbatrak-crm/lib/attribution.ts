/**
 * Parses click-source attribution from a page URL's query string (and,
 * failing that, a referrer) into a short human-readable label for
 * numbatrak_customers.firstClickSource/lastClickSource.
 *
 * Server-side only, off data already flowing through the system today -
 * `pageUrl` is already sent by the public form-submit endpoint and stored on
 * abandoned carts, so a customer who clicked through from an ad already
 * carries utm_source/fbclid/etc. in that URL. No client/embed changes needed
 * to start capturing this.
 */

function extractQueryString(pageUrl: string | null | undefined): string | null {
  if (!pageUrl) return null;
  const idx = pageUrl.indexOf("?");
  if (idx === -1) return null;
  return pageUrl.slice(idx + 1);
}

function extractHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

function titleCase(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function parseAttributionSource(pageUrl?: string | null, referrer?: string | null): string | null {
  const queryString = extractQueryString(pageUrl);
  if (queryString) {
    const params = new URLSearchParams(queryString);
    const source = params.get("utm_source");
    if (source) {
      const medium = params.get("utm_medium");
      return medium ? `${titleCase(source)} / ${medium}` : titleCase(source);
    }
    if (params.get("fbclid")) return "Facebook Ads";
    if (params.get("ttclid")) return "TikTok Ads";
    if (params.get("gclid")) return "Google Ads";
  }

  const referrerHost = extractHost(referrer);
  if (referrerHost) return referrerHost;

  return "Direct";
}

/**
 * Same source (pageUrl's query string) as parseAttributionSource above, but
 * pulls the `tl` tracking-link code instead - used by submitFormOrder to
 * resolve which numbatrak_tracking_links row (media buyer + platform +
 * funnel/offer) this order should be attributed to.
 */
export function extractTrackingLinkCode(pageUrl?: string | null): string | null {
  const queryString = extractQueryString(pageUrl);
  if (!queryString) return null;
  return new URLSearchParams(queryString).get("tl");
}
