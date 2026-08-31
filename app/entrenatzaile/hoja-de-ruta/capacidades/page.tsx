import type { Metadata } from "next";
import HojaDeRutaClient from "../HojaDeRutaClient";
import { CAPACIDADES_CONTENIDO, CAPACIDADES_HERO } from "./_content";

const URL_CANONICA = "https://entrenatzaile.alainzulaika.com/hoja-de-ruta/capacidades";
const TITULO = `${CAPACIDADES_HERO.titulo} — Entrenatzaile`;

export const metadata: Metadata = {
  title: TITULO,
  description: CAPACIDADES_HERO.subtitulo,
  alternates: { canonical: URL_CANONICA },
  openGraph: {
    title: TITULO,
    description: CAPACIDADES_HERO.subtitulo,
    url: URL_CANONICA,
    siteName: "Entrenatzaile",
    locale: "es_ES",
    type: "website",
  },
};

// La misma Hoja de Ruta contada para quien no llega por el dolor de espalda,
// sino por la capacidad física que se pierde sin darse cuenta.
//
// Aquí no hay ventana ni token: siempre 90 €. Por eso es una página estática
// y no lee searchParams — un ?ventana=1 o un ?t= escritos a mano no cambian
// nada, ni siquiera aparecen en la ecuación.
//
// El formulario, los huecos y todo lo que pasa al reservar son exactamente
// los mismos que en /hoja-de-ruta: es el mismo componente.
export default function CapacidadesPage() {
  return (
    <HojaDeRutaClient
      contenido={CAPACIDADES_CONTENIDO}
      variante="evergreen"
      etiquetaVariante="capacidades"
    />
  );
}
