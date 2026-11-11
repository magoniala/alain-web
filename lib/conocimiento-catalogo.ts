// Catálogo de shows que leen las dos IAs comerciales (Prospectos de magia y
// Charlas). Vive en crm_conocimiento (carril magia, tipo "catalogo"): un
// documento por show + condiciones generales + notas de Alain. Se edita en
// /admin › Magia › Catálogo de shows y desde la caja «Me falta información»
// de las tarjetas. Alta inicial: scripts/crm/cargar-catalogo-shows.mjs.
//
// La caché de 1 h del conocimiento no estorba: si cambia el texto, cambia el
// prefijo cacheado y la siguiente llamada ya lee la versión nueva (pagando
// una escritura de caché).

import { supabaseCharlas } from "./charlas";
import CATALOGO_INICIAL from "./catalogo-inicial.json";

export const CARRIL_CATALOGO = "magia";
export const TIPO_CATALOGO = "catalogo";
export const CLAVE_NOTAS = "notas_alain";

export const PLANTILLA_SHOW = `## Para quién
- 

## Qué es
- 

## Formato y espacio
- 

## Aforo
- 

## Duración
- 

## Necesidades técnicas
- 

## Precio de referencia (+ IVA)
- SIN DATO

## Qué incluye
- 

## Cuándo proponerlo
- 
`;

export interface DocConocimiento {
  clave: string;
  carril: string;
  titulo: string | null;
  tipo: string;
  texto: string;
  activo: boolean;
  orden: number;
  actualizado_en: string;
}

/** Lo que la IA dice que le faltaba para contestar bien. */
export interface FaltaDato {
  que: string;
  documento: string | null;
}

/** Acepta lo que devuelva el modelo (lista de objetos o de textos) y lo deja limpio. */
export function normalizarFaltan(v: unknown): FaltaDato[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? { que: x, documento: null } : x && typeof x === "object" ? { que: String((x as Record<string, unknown>).que ?? ""), documento: (x as Record<string, unknown>).documento ? String((x as Record<string, unknown>).documento) : null } : null))
    .filter((x): x is FaltaDato => !!x && !!x.que.trim())
    .slice(0, 6);
}

/** Texto del catálogo activo, con el mismo formato que el resto del conocimiento. */
export async function textoCatalogo(): Promise<string> {
  const { data } = await supabaseCharlas().from("crm_conocimiento").select("clave, titulo, tipo, texto").eq("carril", CARRIL_CATALOGO).eq("tipo", TIPO_CATALOGO).eq("activo", true).order("orden").order("clave");
  return (data ?? []).map((c) => `<documento clave="${c.clave}" tipo="${c.tipo}" titulo="${c.titulo}">\n${c.texto}\n</documento>`).join("\n\n");
}

const fechaHoy = () => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()).replace(/\//g, "-");

/** Añade un bloque fechado al final de un documento del catálogo (o a las notas de Alain si no existe). Devuelve el título del documento. */
export async function anadirAlCatalogo(clave: string, texto: string, origen: string): Promise<{ clave: string; titulo: string }> {
  const sb = supabaseCharlas();
  const limpio = texto.trim();
  if (!limpio) throw new Error("Escribe la información que falta.");
  let { data: doc } = await sb.from("crm_conocimiento").select("clave, titulo, texto, tipo").eq("carril", CARRIL_CATALOGO).eq("clave", clave).maybeSingle();
  if (!doc || doc.tipo !== TIPO_CATALOGO) {
    ({ data: doc } = await sb.from("crm_conocimiento").select("clave, titulo, texto, tipo").eq("carril", CARRIL_CATALOGO).eq("clave", CLAVE_NOTAS).maybeSingle());
  }
  const bloque = `### Añadido el ${fechaHoy()} (${origen})\n${limpio}`;
  if (!doc) {
    const titulo = "Notas de Alain (datos añadidos desde la bandeja)";
    const { error } = await sb.from("crm_conocimiento").insert({ clave: CLAVE_NOTAS, carril: CARRIL_CATALOGO, titulo, tipo: TIPO_CATALOGO, texto: bloque, activo: true, orden: 69, actualizado_en: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { clave: CLAVE_NOTAS, titulo };
  }
  const { error } = await sb.from("crm_conocimiento").update({ texto: `${(doc.texto ?? "").trimEnd()}\n\n${bloque}`, actualizado_en: new Date().toISOString() }).eq("carril", CARRIL_CATALOGO).eq("clave", doc.clave);
  if (error) throw new Error(error.message);
  return { clave: doc.clave, titulo: doc.titulo ?? doc.clave };
}

/** Indicación para rehacer el borrador después de completar el catálogo. */
export function instruccionTrasCompletar(titulo: string, texto: string, extra?: string): string {
  return `Alain acaba de añadir al catálogo (documento «${titulo}») esta información, que ya está en el conocimiento: "${texto.trim()}". Úsala y redacta la respuesta completa (responder = true). Si con esto ya no falta nada, faltan_datos = [].${extra?.trim() ? ` Indicación de Alain: ${extra.trim()}` : ""}`;
}

export function claveDesdeTitulo(titulo: string): string {
  const base = titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `show_${base || "nuevo"}`;
}

/** Da de alta los documentos del catálogo inicial que no existan (nunca pisa lo editado). */
export async function sembrarCatalogo(): Promise<string[]> {
  const sb = supabaseCharlas();
  const { data } = await sb.from("crm_conocimiento").select("clave").eq("carril", CARRIL_CATALOGO);
  const hay = new Set((data ?? []).map((d) => d.clave));
  const nuevos = (CATALOGO_INICIAL as { clave: string; titulo: string; orden: number; texto: string }[])
    .filter((d) => !hay.has(d.clave))
    .map((d) => ({ ...d, carril: CARRIL_CATALOGO, tipo: TIPO_CATALOGO, activo: true, actualizado_en: new Date().toISOString() }));
  if (nuevos.length) {
    const { error } = await sb.from("crm_conocimiento").insert(nuevos);
    if (error) throw new Error(error.message);
  }
  return nuevos.map((d) => d.clave);
}
