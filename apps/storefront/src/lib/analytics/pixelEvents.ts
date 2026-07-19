"use client";

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[] };
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

export function pageView(): void {
  track("PageView");
}

export function viewCategory(collectionId: string): void {
  track("ViewCategory", { content_ids: [collectionId], content_type: "product_group" });
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

export function search(query: string): void {
  track("Search", { search_string: query });
}

export function addToCart(productId: string, valueCents: number, currency: string): void {
  track("AddToCart", {
    content_ids: [productId],
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

/** event_id = order id, matching the server CAPI event_id for dedup. */
export function purchase(orderId: string, valueCents: number, currency: string): void {
  track("Purchase", { value: valueCents / 100, currency }, orderId);
}
