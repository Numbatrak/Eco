import { NextResponse, type NextRequest } from "next/server";
import { resolveSubdomain } from "./lib/subdomain";

export function middleware(request: NextRequest): NextResponse {
  const host = request.headers.get("host");
  const baseDomain = process.env.BASE_DOMAIN ?? "localhost:3000";
  const subdomain = resolveSubdomain(host, baseDomain);

  if (!subdomain) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/sites/${subdomain}${request.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
