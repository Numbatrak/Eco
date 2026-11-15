import { describe, expect, it } from "vitest";
import { buildTrackingUrl, trackingLinkAppliesToForm } from "./tracking-links.js";

describe("trackingLinkAppliesToForm", () => {
  it("attributes submissions through the link's own form", () => {
    expect(trackingLinkAppliesToForm({ formId: "form-a" }, "form-a")).toBe(true);
  });

  it("ignores a link's code pasted onto a different form", () => {
    expect(trackingLinkAppliesToForm({ formId: "form-a" }, "form-b")).toBe(false);
  });
});

describe("buildTrackingUrl", () => {
  const link = {
    code: "kayode-tiktok-discount",
    platform: "TikTok",
    mediaBuyerName: "Kayode",
    offerLabel: "Discount Bundle",
  };

  it("adds tl plus UTM tags to the landing page", () => {
    const url = new URL(buildTrackingUrl("https://toheebyusuf.com/sink-flusher", link, "Sink form")!);
    expect(url.origin + url.pathname).toBe("https://toheebyusuf.com/sink-flusher");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      tl: "kayode-tiktok-discount",
      utm_source: "tiktok",
      utm_medium: "paid",
      utm_campaign: "discount-bundle",
      utm_content: "kayode",
    });
  });

  it("assumes https when the scheme is left off", () => {
    expect(buildTrackingUrl("shop.com/p", link, null)).toMatch(/^https:\/\/shop\.com\/p\?tl=/);
  });

  it("keeps the page's own params and fragment, replacing stale tags", () => {
    const url = new URL(buildTrackingUrl("https://shop.com/p?ref=x&tl=old#order", link, null)!);
    expect(url.searchParams.get("ref")).toBe("x");
    expect(url.searchParams.getAll("tl")).toEqual(["kayode-tiktok-discount"]);
    expect(url.hash).toBe("#order");
  });

  it("uses the form name as the campaign for whole-form links", () => {
    const url = new URL(buildTrackingUrl("https://shop.com", { ...link, offerLabel: null }, "Sink Flusher")!);
    expect(url.searchParams.get("utm_campaign")).toBe("sink-flusher");
  });

  it("returns null without a page", () => {
    expect(buildTrackingUrl(null, link, null)).toBeNull();
  });
});
