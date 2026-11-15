import { describe, expect, it } from "vitest";
import { DrizzleQueryError } from "drizzle-orm";
import { isUniqueViolation } from "./db-errors.js";

const pgUnique = Object.assign(new Error('duplicate key value violates unique constraint'), { code: "23505" });

describe("isUniqueViolation", () => {
  it("matches a bare postgres error", () => {
    expect(isUniqueViolation(pgUnique)).toBe(true);
  });

  it("matches the postgres error drizzle wraps on .cause", () => {
    expect(isUniqueViolation(new DrizzleQueryError("insert ...", [], pgUnique))).toBe(true);
  });

  it("ignores other errors", () => {
    const fk = Object.assign(new Error("fk"), { code: "23503" });
    expect(isUniqueViolation(new DrizzleQueryError("insert ...", [], fk))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});
