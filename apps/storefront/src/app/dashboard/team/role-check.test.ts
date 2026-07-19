import { describe, it, expect } from "vitest";

/**
 * Tests for the comma-joined role check pattern used in team/page.tsx.
 * Roles can arrive as comma-separated strings (e.g. "owner,editor") from
 * the organisation membership record, so strict equality checks are incorrect.
 */

function hasRole(memberRole: string, role: string): boolean {
  return memberRole
    .split(",")
    .map((r) => r.trim())
    .includes(role);
}

describe("hasRole", () => {
  it("returns true for an exact single-role match", () => {
    expect(hasRole("owner", "owner")).toBe(true);
  });

  it("returns false when the role is not present", () => {
    expect(hasRole("member", "owner")).toBe(false);
  });

  it('returns true for comma-joined role "owner,editor" when checking "owner"', () => {
    expect(hasRole("owner,editor", "owner")).toBe(true);
  });

  it('returns true for comma-joined role "owner,editor" when checking "editor"', () => {
    expect(hasRole("owner,editor", "editor")).toBe(true);
  });

  it("handles extra whitespace around role tokens", () => {
    expect(hasRole("owner , editor", "editor")).toBe(true);
  });

  it("does not partially match role names", () => {
    // "admin" should not match "superadmin"
    expect(hasRole("superadmin", "admin")).toBe(false);
  });

  it('returns false when checking "owner" on a "member,editor" role string', () => {
    expect(hasRole("member,editor", "owner")).toBe(false);
  });
});
