/**
 * Decodes (does not verify) a JWT payload for display purposes only - e.g.
 * reading `sub`/`exp` to show a countdown. The server is the only party that
 * verifies signatures; nothing here should ever gate an authorization
 * decision.
 */
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  const segments = token.split(".");
  if (segments.length !== 3 || !segments[1]) {
    return null;
  }
  try {
    const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
