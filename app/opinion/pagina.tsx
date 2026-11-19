import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { esIdioma, esOrigen, eventoDe, type Idioma } from "@/lib/opinion";
import FormularioOpinion from "./FormularioOpinion";

export type Busqueda = Promise<{ [key: string]: string | string[] | undefined }>;

const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Página de opinión de un evento. La usan /opinion-mirariak2026 (URL fija,
// ya repartida) y /opinion/<evento> (cualquier evento de lib/opinion.ts).
//
// Idioma: ?l=es|eu (lo pone el mail según el idioma de la reserva); si no,
// la cookie `lang`; y si tampoco, euskera, el idioma por defecto del sitio.
// ?e= dice de dónde viene la respuesta (gracias | salida | mail | voz).
export async function PaginaOpinion({ evento, searchParams }: { evento: string; searchParams: Busqueda }) {
  const ev = eventoDe(evento);
  if (!ev) notFound();
  const params = await searchParams;
  const l = primero(params.l);
  const lang = (await cookies()).get("lang")?.value;
  const idioma: Idioma = esIdioma(l) ? l : esIdioma(lang) ? lang : "eu";
  const e = primero(params.e);
  return (
    <FormularioOpinion
      evento={ev.clave}
      nombreEvento={ev.nombre}
      origen={esOrigen(e) ? e : null}
      idiomaInicial={idioma}
      resenaUrl={process.env.GOOGLE_REVIEW_URL?.trim() || ""}
    />
  );
}
