import { NextResponse, type NextRequest } from "next/server";
import { resolveSubdomain } from "./lib/subdomain";

const GUEST_ONLY_PATHS = new Set([
  "/dashboard/login",
  "/dashboard/signup",
  "/dashboard/forgot-password",
  "/dashboard/reset-password",
]);

const SESSION_COOKIE = "better-auth.session_token";

function isDashboardPath(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

function isGuestOnlyPath(pathname: string): boolean {
  return GUEST_ONLY_PATHS.has(pathname);
}

function isAuthExemptPath(pathname: string): boolean {
  return isGuestOnlyPath(pathname) || pathname.startsWith("/dashboard/2fa/");
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // --- Dashboard auth guard (cookie-level, fast first pass) ---
  if (isDashboardPath(pathname)) {
    const hasSession = request.cookies.has(SESSION_COOKIE);

    if (!hasSession && !isAuthExemptPath(pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/dashboard/login";
      return NextResponse.redirect(loginUrl);
    }

    if (hasSession && isGuestOnlyPath(pathname)) {
      const dashUrl = request.nextUrl.clone();
      dashUrl.pathname = "/dashboard";
      return NextResponse.redirect(dashUrl);
    }

    return NextResponse.next();
  }

  // --- Subdomain routing ---
  const host = request.headers.get("host");
  const baseDomain = process.env.BASE_DOMAIN ?? "numbatrak.com";
  const subdomain = resolveSubdomain(host, baseDomain);

  if (!subdomain) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/sites/${subdomain}${request.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico).*)"],
};
