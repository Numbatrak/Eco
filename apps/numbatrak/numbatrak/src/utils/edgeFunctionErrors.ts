/**
 * Extract a user-facing message from a Supabase Edge Function invoke result.
 */
export async function parseEdgeFunctionError(
  data: unknown,
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): Promise<string> {
  if (data && typeof data === "object" && "error" in data) {
    const message = (data as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  if (
    error &&
    typeof error === "object" &&
    "context" in error &&
    typeof (error as { context?: { json?: () => Promise<unknown> } }).context
      ?.json === "function"
  ) {
    try {
      const body = await (
        error as { context: { json: () => Promise<unknown> } }
      ).context.json();
      if (body && typeof body === "object" && "error" in body) {
        const message = (body as { error?: unknown }).error;
        if (typeof message === "string" && message.trim()) {
          return message;
        }
      }
    } catch {
      // Response body may already be consumed or invalid JSON.
    }
  }

  if (error instanceof Error) {
    if (error.message.includes("non-2xx")) {
      return fallback;
    }
    return error.message;
  }

  return fallback;
}
