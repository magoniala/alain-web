import { NextRequest, NextResponse } from "next/server";

// Rutas que no tienen versión /es — el middleware no debe tocarlas
const NO_REDIRECT_PATHS = [
  "/premios-mira",
  "/arrogante",
  "/gilipollas",
  "/aviso-legal",
  "/privacidad",
  "/cookies",
  "/entrenatzaile",
  "/magic",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  // Subdominio dedicado: entrenatzaile.alainzulaika.com. La landing de
  // valoración gratuita vive en /valoracion (euskera) y /es/valoracion
  // (castellano), igual que el resto del sitio (bare path = eu, /es = es).
  // La raíz del subdominio redirige a /guias (landing de captación).
  if (hostname.startsWith("entrenatzaile.")) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/guias";
      return NextResponse.redirect(url);
    }
    // Páginas legales: viven en la raíz del sitio, no bajo /entrenatzaile.
    // La de privacidad es la excepción: tiene su propia versión con la
    // estética de Entrenatzaile en /entrenatzaile/privacidad.
    if (
      NO_REDIRECT_PATHS.some(
        (p) => p !== "/entrenatzaile" && p !== "/privacidad" && (pathname === p || pathname.startsWith(p + "/"))
      )
    ) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = `/entrenatzaile${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Rutas sin versión /es: pasar siempre sin redirigir
  if (NO_REDIRECT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

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
