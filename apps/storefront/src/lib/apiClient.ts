/**
 * Browser calls go through Next's /api/:path* rewrite (see next.config.mjs)
 * so requests stay same-origin as whatever host the page is on
 * (localhost:3000 for the dashboard, {slug}.localhost:3000 for tenant sites).
 * That keeps the cart's SameSite=Lax cookie first-party and avoids CORS.
 *
 * Server-side (SSR fetchSite) hits the API directly - no browser, no cookie
 * constraints, and NEXT_PUBLIC_API_URL is authoritative.
 */
const API_BASE_URL =
  typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001")
    : "/api";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
  }
  if (status === 429) return "Too many attempts. Please try again in a moment.";
  return "Something went wrong. Please try again.";
}

/**
 * Talks directly to apps/api. `credentials: "include"` matters for the
 * client-side calls (cart/checkout) so the browser attaches/receives the
 * httpOnly cart_token_{subdomain} cookie; it's a harmless no-op for the
 * server-side site-resolution fetch, which needs no cookie.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    cache: "no-store",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");
  const body = contentType?.includes("application/json") ? await response.json() : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, body, extractErrorMessage(body, response.status));
  }

  return body as T;
}
