import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // If the user already has a language preference set, respect it
  if (request.cookies.has("lang")) return NextResponse.next();

  const acceptLang = request.headers.get("accept-language") ?? "";
  const primary = acceptLang.split(",")[0].split("-")[0].toLowerCase();
  const isBasque = primary === "eu";
  const isOnEsPage = pathname.startsWith("/es");

  if (!isBasque && !isOnEsPage) {
    // Redirect non-Basque browser to /es/ equivalent
    const url = request.nextUrl.clone();
    url.pathname = "/es" + (pathname === "/" ? "/" : pathname);
    const res = NextResponse.redirect(url);
    res.cookies.set("lang", "es", { path: "/", maxAge: 31536000 });
    return res;
  }

  // Set Basque preference so we stop checking on every request
  const res = NextResponse.next();
  res.cookies.set("lang", "eu", { path: "/", maxAge: 31536000 });
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|.*\\..*).*)" ],
};
