"use client";

const STORAGE_KEY = "attribution";
const LAST_TOUCH_STORAGE_KEY = "last_attribution";

export interface Attribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  landingPath?: string;
  fbclid?: string;
  ttclid?: string;
  gclid?: string;
}

function readCurrentAttribution(): Attribution {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get("utm_source") ?? undefined,
    utmMedium: params.get("utm_medium") ?? undefined,
    utmCampaign: params.get("utm_campaign") ?? undefined,
    utmTerm: params.get("utm_term") ?? undefined,
    utmContent: params.get("utm_content") ?? undefined,
    referrer: document.referrer || undefined,
    landingPath: window.location.pathname,
    fbclid: params.get("fbclid") ?? undefined,
    ttclid: params.get("ttclid") ?? undefined,
    gclid: params.get("gclid") ?? undefined,
  };
}

function readStored(key: string): Attribution | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = sessionStorage.getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Attribution;
  } catch {
    return undefined;
  }
}

/**
 * Sticky-first capture: only writes on the FIRST landing of a session
 * (Pattern 6) - if a shopper arrives via ?utm_source=facebook then clicks
 * around, later page navigations with empty UTMs must not overwrite it.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(STORAGE_KEY)) return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(readCurrentAttribution()));
}

export function getAttribution(): Attribution | undefined {
  return readStored(STORAGE_KEY);
}

/**
 * Last-touch capture: always overwrites, unlike captureAttribution's sticky
 * guard - ad clicks are always full page loads, so the same mount-only
 * effect that fires captureAttribution is also the right place for this.
 */
export function captureLastTouch(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LAST_TOUCH_STORAGE_KEY, JSON.stringify(readCurrentAttribution()));
}

export function getLastAttribution(): Attribution | undefined {
  return readStored(LAST_TOUCH_STORAGE_KEY);
}
