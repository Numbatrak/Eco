const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

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
    if (typeof record.error === "string") return record.error;
    if (typeof record.message === "string") return record.message;
  }
  if (status === 429) return "Too many attempts. Please try again later.";
  if (status === 401) return "Invalid credentials.";
  return "Something went wrong. Please try again.";
}

/**
 * Talks directly to apps/api (not routed through @platform/sdk, which isn't
 * built out yet). Better Auth uses httpOnly session cookies rather than a
 * bearer token, so `credentials: "include"` on every call is what carries
 * the session cross-origin - there's no token to attach or refresh here.
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
