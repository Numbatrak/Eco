/** Build /verify-email URL with optional source and post-verify redirect. */
export function buildVerifyEmailPath(options?: {
  from?: "signup" | "login";
  redirect?: string | null;
}): string {
  const params = new URLSearchParams();
  if (options?.from) {
    params.set("from", options.from);
  }
  if (options?.redirect?.startsWith("/") && !options.redirect.startsWith("//")) {
    params.set("redirect", options.redirect);
  }
  const query = params.toString();
  return query ? `/verify-email?${query}` : "/verify-email";
}

/** Auth page to return to from verify-email based on signup vs sign-in flow. */
export function getVerifyEmailBackPath(from: string | null): "/signup" | "/login" {
  return from === "signup" ? "/signup" : "/login";
}
