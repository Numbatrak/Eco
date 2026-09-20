"use client";

/**
 * Loosely typed to cover both how this file calls it (track/trackCustom/page)
 * and how AnalyticsScripts.tsx builds it (queue stub + load), since TikTok's
 * ttq object grows extra deferred methods dynamically at load time.
 */
export interface TiktokPixel {
  (...args: unknown[]): void;
  queue?: unknown[];
  track?: (...args: unknown[]) => void;
  trackCustom?: (...args: unknown[]) => void;
  page?: () => void;
  load?: (pixelId: string) => void;
}

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] };
    ttq?: TiktokPixel;
  }
}

function track(eventName: string, params?: Record<string, unknown>, eventId?: string): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (eventId) {
    window.fbq("track", eventName, params, { eventID: eventId });
  } else {
    window.fbq("track", eventName, params);
  }
}

// TikTok's SDK splits standard events (`ttq.track`) from custom ones
// (`ttq.trackCustom`) - Meta's fbq takes any event name through the same
// `track` call, so this list exists only on the TikTok side of this file.
// ASSUMPTION: reconstructed from TikTok's publicly documented standard
// event names, not verified against a live pixel - confirm before shipping.
const TIKTOK_STANDARD_EVENTS = new Set([
  "AddPaymentInfo",
  "AddToCart",
  "AddToWishlist",
  "ClickButton",
  "CompletePayment",
  "CompleteRegistration",
  "Contact",
  "Download",
  "InitiateCheckout",
  "PlaceAnOrder",
  "Search",
  "SubmitForm",
  "Subscribe",
  "ViewContent",
]);

function tiktokTrack(eventName: string, params?: Record<string, unknown>, eventId?: string): void {
  if (typeof window === "undefined" || typeof window.ttq?.track !== "function") return;
  const options = eventId ? { event_id: eventId } : undefined;
  if (TIKTOK_STANDARD_EVENTS.has(eventName)) {
    window.ttq.track(eventName, params, options);
  } else {
    window.ttq.trackCustom?.(eventName, params, options);
  }
}

export function pageView(): void {
  track("PageView");
}

/** TikTok's own snippet already fires PageView via `ttq.page()` on load - this covers subsequent client-side route changes, mirroring `pageView` above. */
export function tiktokPageView(): void {
  if (typeof window === "undefined" || typeof window.ttq?.page !== "function") return;
  window.ttq.page();
}

export function viewCategory(collectionId: string): void {
  track("ViewCategory", { content_ids: [collectionId], content_type: "product_group" });
}

/** ViewCategory isn't a TikTok standard event, so this goes through trackCustom (see TIKTOK_STANDARD_EVENTS above). */
export function tiktokViewCategory(collectionId: string): void {
  tiktokTrack("ViewCategory", { content_ids: [collectionId], content_type: "product_group" });
}

// content_ids is always a PRODUCT id, never a variant id (Pattern 7) - the
// catalog feed and every event below must agree on this or catalog match
// rate silently drops to ~0%.
export function viewContent(productId: string, valueCents: number, currency: string): void {
  track("ViewContent", {
    content_ids: [productId],
    content_type: "product",
    value: valueCents / 100,
    currency,
  });
}

export function tiktokViewContent(productId: string, valueCents: number, currency: string): void {
  tiktokTrack("ViewContent", {
    content_id: productId,
    content_type: "product",
    value: valueCents / 100,
    currency,
  });
}

export function search(query: string): void {
  track("Search", { search_string: query });
}

export function tiktokSearch(query: string): void {
  tiktokTrack("Search", { query });
}

export function addToCart(productId: string, valueCents: number, currency: string): void {
  track("AddToCart", {
    content_ids: [productId],
    content_type: "product",
    value: valueCents / 100,
    currency,
  });
}

export function tiktokAddToCart(productId: string, valueCents: number, currency: string): void {
  tiktokTrack("AddToCart", {
    content_id: productId,
    content_type: "product",
    value: valueCents / 100,
    currency,
  });
}

export function initiateCheckout(valueCents: number, currency: string, productIds: string[]): void {
  track("InitiateCheckout", {
    content_ids: productIds,
    content_type: "product",
    value: valueCents / 100,
    currency,
  });
}

export function tiktokInitiateCheckout(valueCents: number, currency: string, productIds: string[]): void {
  tiktokTrack("InitiateCheckout", {
    content_id: productIds[0],
    content_type: "product",
    value: valueCents / 100,
    currency,
  });
}

/** event_id = order id, matching the server CAPI event_id for dedup. */
export function purchase(orderId: string, valueCents: number, currency: string): void {
  track("Purchase", { value: valueCents / 100, currency }, orderId);
}

/**
 * TikTok's Purchase-equivalent standard event is "CompletePayment" (there is
 * no event literally named "Purchase"). event_id = order id, matching the
 * server-side TikTok Events API event_id in tiktok-events.ts for dedup.
 */
export function tiktokPurchase(orderId: string, valueCents: number, currency: string): void {
  tiktokTrack("CompletePayment", { value: valueCents / 100, currency }, orderId);
}
