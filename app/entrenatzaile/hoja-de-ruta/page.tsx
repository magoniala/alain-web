import type { Metadata } from "next";
import HojaDeRutaClient from "./HojaDeRutaClient";
import { HOJA_RUTA_CONTENIDO, HOJA_RUTA_HERO } from "./_content";
import { contactoDeToken, etiquetaFechaVentana } from "@/lib/entrenatzaile-ventana";

type Busqueda = Promise<{ [key: string]: string | string[] | undefined }>;

const TITULO = `${HOJA_RUTA_HERO.titulo} — Entrenatzaile`;

function primero(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// La versión de la ventana no debe salir en Google: es un enlace privado para
// quien está dentro de sus 8 días, no una página pública.
//
// Se le pone noindex a cualquier URL que traiga token o ?ventana=1, aunque el
// token ya no valga: lo que no queremos indexado es la forma de la URL. Y se
// le QUITA la canónica. Con la canónica puesta, Google agruparía las dos URLs
// y podría aplicar el noindex a la del grupo, dejándote fuera del índice
// también la evergreen.
export async function generateMetadata({ searchParams }: { searchParams: Busqueda }): Promise<Metadata> {
  const params = await searchParams;
  const privada = primero(params.ventana) === "1" || Boolean(primero(params.t));

  return {
    title: TITULO,
    description: HOJA_RUTA_HERO.subtitulo,
    ...(privada
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

// Una sola plantilla, no dos páginas: el copy común vive en un único sitio y
// no puede desincronizarse.
//
// Quién ve la versión gratuita lo decide el token `t` del enlace, no el
// parámetro `?ventana=1`. Escribir ?ventana=1 a mano no regala nada: sin
// token válido y dentro de plazo, se pinta la de pago. El parámetro se sigue
// aceptando en la URL porque los correos lo llevan, pero ya no decide.
//
// Ante cualquier duda —sin token, token inventado, token de alguien cuya
// ventana expiró, o un error de base de datos— sale la de pago. Nunca un
// error en la cara del lead, y nunca el regalo por defecto.
export default async function HojaDeRutaPage({ searchParams }: { searchParams: Busqueda }) {
  const params = await searchParams;
  const contacto = await contactoDeToken(primero(params.t));
  const enVentana = contacto?.ventana.elegibilidad === "elegible";

  return (
    <HojaDeRutaClient
      contenido={HOJA_RUTA_CONTENIDO}
      variante={enVentana ? "ventana" : "evergreen"}
      finVentana={
        enVentana && contacto?.ventana.ultimo_dia
          ? etiquetaFechaVentana(contacto.ventana.ultimo_dia)
          : undefined
      }
    />
  );
}
