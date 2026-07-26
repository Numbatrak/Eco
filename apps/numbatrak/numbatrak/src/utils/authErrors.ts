/** True when Supabase session storage has a stale or revoked refresh token. */
export function isInvalidRefreshTokenError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : String(error ?? "");

  return (
    message.includes("Invalid Refresh Token") ||
    message.includes("Refresh Token Not Found")
  );
}
