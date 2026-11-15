/**
 * Talks directly to apps/api. Unlike apps/storefront (same-origin via a
 * Next.js rewrite), Numbatrak is its own Vite dev server, so this is genuine
 * cross-origin - `credentials: "include"` plus apps/api's CORS allow-list
 * (NUMBATRAK_APP_URL) are both required for the session cookie to work.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/**
 * The dev API - where merchants' WordPress sites send orders for now.
 * Switch this (or set VITE_PUBLIC_API_URL) when a production API exists.
 */
const DEV_API_URL = "https://api-dev.numbatrak.com";

function isLocalAddress(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost") || host.endsWith(".test");
  } catch {
    return true;
  }
}

/**
 * The API address merchants paste into WordPress, Fluent Forms, Elementor...
 * Never a local address: a merchant's website can't reach a developer's
 * machine, so running the app locally (VITE_API_URL=localhost) must not hand
 * out a localhost URL. Override with VITE_PUBLIC_API_URL.
 */
export const PUBLIC_API_BASE_URL: string =
  import.meta.env.VITE_PUBLIC_API_URL ?? (isLocalAddress(API_BASE_URL) ? DEV_API_URL : API_BASE_URL);

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
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
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
