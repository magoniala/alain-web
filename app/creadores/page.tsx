import type { Metadata } from "next";
import CreadoresClient from "./CreadoresClient";
import { CREADORES_HERO } from "./_content";

// La página vive en su propio subdominio: creadores.alainzulaika.com. El
// rewrite lo hace proxy.ts, que manda todo lo de ese host a /creadores. Por
// eso la canónica NO lleva el prefijo /creadores: esa ruta es de fichero, no
// una URL pública.
const BASE = "https://creadores.alainzulaika.com";

const TITULO = "Reserva tu reunión — Alain Zulaika";

// Fuera del índice de Google, y no por descuido: a esta página se llega por
// un Loom personalizado, uno a uno. No es una landing pública que quiera
// captar tráfico frío, y el copy está escrito dando por hecho que quien lee
// acaba de ver un vídeo. Si algún día se quiere pública, se quita el `robots`
// y se le pone la canónica de vuelta.
export const metadata: Metadata = {
  title: TITULO,
  description: CREADORES_HERO.descripcion,
  robots: { index: false, follow: false },
  openGraph: {
    title: TITULO,
    description: CREADORES_HERO.descripcion,
    url: BASE,
    siteName: "Alain Zulaika",
    locale: "es_ES",
    type: "website",
  },
};

export default function CreadoresPage() {
  return <CreadoresClient />;
}
