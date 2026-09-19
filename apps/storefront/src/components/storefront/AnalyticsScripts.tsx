"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureAttribution, captureLastTouch } from "../../lib/attribution";
import { pageView, tiktokPageView } from "../../lib/analytics/pixelEvents";
import type { TiktokPixel } from "../../lib/analytics/pixelEvents";

/** Meta's standard base Pixel snippet, ported to TS - see Meta Events Manager. */
function loadMetaPixel(pixelId: string): void {
  if (typeof window === "undefined" || window.fbq) return;

  function fbq(...args: unknown[]): void {
    (fbq.queue ??= []).push(args);
  }
  fbq.queue = [] as unknown[];
  window.fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  fbq("init", pixelId);
}

const TIKTOK_DEFERRED_METHODS = [
  "page",
  "track",
  "identify",
  "instances",
  "debug",
  "on",
  "off",
  "once",
  "ready",
  "alias",
  "group",
  "enableCookie",
  "disableCookie",
  "holdConsent",
  "revokeConsent",
  "grantConsent",
];

/**
 * TikTok's standard base Pixel snippet (ttq), ported to TS - see TikTok
 * Events Manager > Pixel > Setup > Manually install pixel code. Mirrors
 * `loadMetaPixel` above (queue stub + async script injection), but TikTok's
 * own snippet additionally requires an explicit `ttq.load(pixelId)` call
 * before `ttq.page()`, which fbq doesn't need.
 */
function loadTiktokPixel(pixelId: string): void {
  if (typeof window === "undefined" || window.ttq) return;

  function setAndDefer(target: TiktokPixel, method: string): void {
    (target as unknown as Record<string, unknown>)[method] = (...args: unknown[]): void => {
      (target.queue ??= []).push([method, ...args]);
    };
  }

  function ttqBase(...args: unknown[]): void {
    (ttqBase.queue ??= []).push(args);
  }
  ttqBase.queue = [] as unknown[];
  const ttq = ttqBase as TiktokPixel;
  for (const method of TIKTOK_DEFERRED_METHODS) setAndDefer(ttq, method);

  ttq.load = (id: string): void => {
    const src = "https://analytics.tiktok.com/i18n/pixel/events.js";
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = `${src}?sdkid=${id}&lib=ttq`;
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript?.parentNode?.insertBefore(script, firstScript);
  };

  window.ttq = ttq;
  ttq.load(pixelId);
  ttq.page?.();
}

export function AnalyticsScripts({
  metaPixelId,
  tiktokPixelId,
}: {
  metaPixelId: string | null;
  tiktokPixelId: string | null;
}): null {
  const pathname = usePathname();

  useEffect(() => {
    captureAttribution();
    captureLastTouch();
  }, []);

  useEffect(() => {
    if (!metaPixelId) return;
    loadMetaPixel(metaPixelId);
  }, [metaPixelId]);

  useEffect(() => {
    if (!tiktokPixelId) return;
    loadTiktokPixel(tiktokPixelId);
  }, [tiktokPixelId]);

  useEffect(() => {
    if (!metaPixelId) return;
    pageView();
  }, [metaPixelId, pathname]);

  useEffect(() => {
    if (!tiktokPixelId) return;
    tiktokPageView();
  }, [tiktokPixelId, pathname]);

  return null;
}
