import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/campus-api";

const legacyPages = new Set(["/admin", "/hod", "/regulations", "/dashboard"]);

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login" || path.startsWith("/api/") || path.includes(".")) {
    return NextResponse.next();
  }
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (legacyPages.has(path)) {
    return NextResponse.redirect(new URL("/ai-assistant", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
