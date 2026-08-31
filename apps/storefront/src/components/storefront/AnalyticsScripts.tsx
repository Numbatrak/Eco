"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureAttribution, captureLastTouch } from "../../lib/attribution";
import { pageView } from "../../lib/analytics/pixelEvents";

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

export function AnalyticsScripts({ metaPixelId }: { metaPixelId: string | null }): null {
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
    if (!metaPixelId) return;
    pageView();
  }, [metaPixelId, pathname]);

  return null;
}
