import type { Metadata } from "next";
import HojaDeRutaClient from "./HojaDeRutaClient";
import { HOJA_RUTA_HERO } from "./_content";

type Busqueda = Promise<{ [key: string]: string | string[] | undefined }>;

const TITULO = `${HOJA_RUTA_HERO.titulo} — Entrenatzaile`;

// La versión de la ventana (?ventana=1) no debe salir en Google: es un enlace
// privado para quien está dentro de sus 8 días, no una página pública.
//
// Cuando lleva el parámetro se le pone noindex y se le QUITA la canónica. Con
// la canónica puesta, Google agruparía las dos URLs y podría aplicar el
// noindex a la del grupo, dejándote fuera del índice también la evergreen.
export async function generateMetadata({ searchParams }: { searchParams: Busqueda }): Promise<Metadata> {
  const { ventana } = await searchParams;
  const esVentana = ventana === "1";

  return {
    title: TITULO,
    description: HOJA_RUTA_HERO.subtitulo,
    ...(esVentana
      ? { robots: { index: false, follow: false } }
      : { alternates: { canonical: "https://entrenatzaile.alainzulaika.com/hoja-de-ruta" } }),
    openGraph: {
      title: TITULO,
      description: HOJA_RUTA_HERO.subtitulo,
      url: "https://entrenatzaile.alainzulaika.com/hoja-de-ruta",
      siteName: "Entrenatzaile",
      locale: "es_ES",
      type: "website",
    },
  };
}

// Una sola plantilla, no dos páginas: ?ventana=1 pinta la versión de la
// ventana (gratis 8 días) y cualquier otra cosa, la evergreen (90 €). El
// copy común vive en un único sitio y no puede desincronizarse.
export default async function HojaDeRutaPage({ searchParams }: { searchParams: Busqueda }) {
  const { ventana } = await searchParams;
  return <HojaDeRutaClient variante={ventana === "1" ? "ventana" : "evergreen"} />;
}
