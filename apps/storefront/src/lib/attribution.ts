"use client";

const STORAGE_KEY = "attribution";

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

/**
 * Sticky-first capture: only writes on the FIRST landing of a session
 * (Pattern 6) - if a shopper arrives via ?utm_source=facebook then clicks
 * around, later page navigations with empty UTMs must not overwrite it.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(STORAGE_KEY)) return;

  const params = new URLSearchParams(window.location.search);
  const attribution: Attribution = {
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

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
}

export function getAttribution(): Attribution | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Attribution;
  } catch {
    return undefined;
  }
}
