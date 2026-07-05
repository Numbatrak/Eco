const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
  method?: "GET" | "POST" | "PATCH" | "DELETE";
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
