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

  // --- Force HTTPS ---
  // The cart-token cookie is Secure in production (cart-cookie.ts), so a
  // storefront page loaded over plain HTTP can never actually store it -
  // every subsequent add-to-cart call then 404s with cart_not_found. Cloudflare
  // isn't set to redirect HTTP->HTTPS for tenant subdomains, so enforce it
  // here instead. Once the page itself loads over HTTPS, same-origin fetches
  // it makes (including /api/*, which this middleware doesn't otherwise run
  // on - see matcher below) inherit that scheme automatically.
  if (request.headers.get("x-forwarded-proto") === "http") {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 308);
  }

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
