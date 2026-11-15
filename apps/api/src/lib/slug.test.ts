import { describe, expect, it } from "vitest";
import { isSlug, slugify, slugJoin } from "./slug.js";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Ad Guys & Co")).toBe("ad-guys-co");
  });

  it("keeps accented letters as their base letter", () => {
    expect(slugify("Adégún")).toBe("adegun");
  });

  it("never leaves characters that would break a query string", () => {
    expect(slugify("a&b#c+d=e f?g")).toMatch(/^[a-z0-9-]+$/);
  });

  it("does not leave a trailing hyphen after truncating", () => {
    expect(slugify("abcd efgh", { maxLength: 5 })).toBe("abcd");
  });

  it("falls back when nothing survives", () => {
    expect(slugify("!!!", { fallback: "link" })).toBe("link");
  });
});

describe("slugJoin", () => {
  it("joins parts and drops empty ones", () => {
    expect(slugJoin(["AdGuys", "TikTok", null, "", "!!!"])).toBe("adguys-tiktok");
  });

  it("caps total length without a trailing hyphen", () => {
    const joined = slugJoin(["aaaa", "bbbb"], { maxLength: 5 });
    expect(joined).toBe("aaaa");
  });

  it("produces a valid slug", () => {
    expect(isSlug(slugJoin(["Media Buyer", "Facebook Ads", "BF test #2"]))).toBe(true);
  });
});

describe("isSlug", () => {
  it("accepts slugs and legacy hex codes", () => {
    expect(isSlug("adguys-tiktok")).toBe(true);
    expect(isSlug("a1b2c3d4")).toBe(true);
  });

  it("rejects separators at the edges, doubles and uppercase", () => {
    expect(isSlug("-a")).toBe(false);
    expect(isSlug("a--b")).toBe(false);
    expect(isSlug("Ab")).toBe(false);
  });
});
