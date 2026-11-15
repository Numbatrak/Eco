/**
 * True for a Postgres unique-constraint violation (SQLSTATE 23505).
 *
 * drizzle-orm (0.45+) wraps driver errors in a DrizzleQueryError whose own
 * message is "Failed query: ..." and which carries the postgres error on
 * `.cause` - so the SQLSTATE has to be looked for down the cause chain, not
 * just on the error that was thrown.
 */
export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth++) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
