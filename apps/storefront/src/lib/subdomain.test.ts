import { describe, it, expect } from "vitest";
import { resolveSubdomain } from "./subdomain";

const BASE_DOMAIN = "localhost:3000";

describe("resolveSubdomain", () => {
  it("extracts a single-level tenant subdomain", () => {
    expect(resolveSubdomain("acme.localhost:3000", BASE_DOMAIN)).toBe("acme");
  });

  it("is case-insensitive", () => {
    expect(resolveSubdomain("Acme.Localhost:3000", BASE_DOMAIN)).toBe("acme");
  });

  it("returns null for the bare base domain (no subdomain)", () => {
    expect(resolveSubdomain("localhost:3000", BASE_DOMAIN)).toBeNull();
  });

  it("returns null for an unrelated host", () => {
    expect(resolveSubdomain("evil.example.com", BASE_DOMAIN)).toBeNull();
  });

  it("returns null for a multi-level subdomain", () => {
    expect(resolveSubdomain("foo.bar.localhost:3000", BASE_DOMAIN)).toBeNull();
  });

  it("returns null for a missing host header", () => {
    expect(resolveSubdomain(null, BASE_DOMAIN)).toBeNull();
    expect(resolveSubdomain(undefined, BASE_DOMAIN)).toBeNull();
  });

  it.each(["www", "api", "admin", "app", "mail", "status", "blog", "help", "docs", "cdn", "assets"])(
    "treats %s as reserved, not a tenant subdomain",
    (reserved) => {
      expect(resolveSubdomain(`${reserved}.localhost:3000`, BASE_DOMAIN)).toBeNull();
    },
  );
});
