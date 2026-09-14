import { describe, it, expect } from "vitest";
import { parseAttributionSource } from "./attribution.js";

describe("parseAttributionSource", () => {
  it("labels utm_source + utm_medium together", () => {
    expect(parseAttributionSource("https://example.com/funnel?utm_source=facebook&utm_medium=cpc")).toBe(
      "Facebook / cpc",
    );
  });

  it("labels utm_source alone", () => {
    expect(parseAttributionSource("https://example.com/funnel?utm_source=newsletter")).toBe("Newsletter");
  });

  it("falls back to a named ad platform from click ids when there's no utm_source", () => {
    expect(parseAttributionSource("https://example.com/funnel?fbclid=abc123")).toBe("Facebook Ads");
    expect(parseAttributionSource("https://example.com/funnel?ttclid=abc123")).toBe("TikTok Ads");
    expect(parseAttributionSource("https://example.com/funnel?gclid=abc123")).toBe("Google Ads");
  });

  it("falls back to the referrer's hostname when the URL has no query string", () => {
    expect(parseAttributionSource("https://example.com/funnel", "https://www.instagram.com/p/xyz")).toBe(
      "www.instagram.com",
    );
  });

  it("falls back to Direct when there is no query string and no referrer", () => {
    expect(parseAttributionSource("https://example.com/funnel")).toBe("Direct");
    expect(parseAttributionSource(null)).toBe("Direct");
    expect(parseAttributionSource(undefined)).toBe("Direct");
  });

  it("ignores an unparseable referrer rather than throwing", () => {
    expect(parseAttributionSource("https://example.com/funnel", "not-a-url")).toBe("Direct");
  });
});
