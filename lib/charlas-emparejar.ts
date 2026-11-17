// Emparejar correos de centros que no entran solos (17-11-2026).
//
// Caso que lo motivó: Patricia Rivas (Navarro Villoslada) escribió un correo
// nuevo, sin hilo, desde d356493@educacion.navarra.es. Ese dominio lo
// comparten todos los centros públicos de Navarra, así que ni el email ni el
// dominio sirven y el correo se perdía. Aquí:
//   - una regla automática más, solo si no hay duda (buzón con el mismo
//     prefijo que el del centro dentro del mismo dominio);
//   - qué correos sin centro van a «Sin emparejar» en vez de descartarse;
//   - los centros candidatos que se le proponen a Alain para asociarlo a mano.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Correo personal: el dominio no dice nada del centro ni del buzón. */
export const DOMINIOS_PERSONALES = new Set([
  "gmail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es", "yahoo.com", "yahoo.es",
  "icloud.com", "live.com", "msn.com", "euskalnet.net", "telefonica.net", "me.com", "protonmail.com",
]);

/** Buzones genéricos que no identifican a un centro aunque coincidan. */
const BUZONES_GENERICOS = new Set(["info", "secretaria", "idazkaritza", "administracion", "administrazioa", "direccion", "zuzendaritza", "contacto", "harremanak", "orientacion", "orientazioa"]);

export const parteLocal = (e: string) => (e.split("@")[0] ?? "").toLowerCase();
export const dominioDe = (e: string) => (e.split("@")[1] ?? "").toLowerCase();
const digitosIniciales = (s: string) => /^\d+/.exec(s)?.[0] ?? "";

/**
 * ¿El buzón `de` es de la misma casa que el buzón `centro` (mismo dominio)?
 *  - mismo prefijo seguido de separador: ieslekar-zuzendaria@ ↔ ieslekar@
 *  - mismo código numérico inicial (centros públicos vascos): 014299ib@ ↔ 014299aa@
 */
export function buzonParecido(de: string, centro: string): boolean {
  if (!de || !centro || de === centro) return de === centro && !!de;
  if (centro.length >= 5 && !BUZONES_GENERICOS.has(centro) && new RegExp(`^${centro.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[-._]`).test(de)) return true;
  const a = digitosIniciales(de);
  return a.length >= 5 && a === digitosIniciales(centro);
}

// Palabras que no distinguen un centro de otro en su nombre.
const VACIAS = new Set(("ies bhi ipi ieso cpeip ceip cip colegio ikastola ikastetxea institutoa instituto institutua eskola lizeoa liceo escuela de del la el los las san santa sta " +
  "bigarren hezkuntzako hezkuntza haur lehen eta educacion secundaria obligatoria publico publica centro integrado politecnico formacion profesional sagrado corazon maria jesus colegios").split(" "));
const sinAcentos = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** Palabras con las que se reconoce un centro (sin las comunes ni lo que va entre paréntesis). */
export const palabrasNombre = (nombre: string) =>
  sinAcentos(nombre).replace(/\(.*?\)/g, " ").split(/[^a-z0-9]+/).filter((w) => w.length >= 5 && !VACIAS.has(w));

export interface Candidato {
  centro_id: string;
  nombre: string;
  motivo: string;
}

interface Huerfano {
  id: string;
  de: string | null;
  asunto: string | null;
  texto?: string | null;
  fecha: string | null;
  referencias?: string[] | null;
  in_reply_to?: string | null;
}

const hora = (iso: string) => new Date(iso).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Candidatos para cada correo de «Sin emparejar», por orden de fiabilidad (máximo 4). El texto debe llegar sin lo citado (quitarCita). */
export async function candidatosHuerfanos(sb: SupabaseClient, huerfanos: Huerfano[]): Promise<Record<string, Candidato[]>> {
  const out: Record<string, Candidato[]> = {};
  if (!huerfanos.length) return out;

  const centros: { id: string; nombre: string; emails: string[] }[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data } = await sb.from("charlas_centros").select("id, nombre, email_centro, responsable_email, ampa_email").range(desde, desde + 999);
    for (const c of data ?? []) {
      const emails = [c.email_centro, c.responsable_email, c.ampa_email].join(" ").toLowerCase().match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
      centros.push({ id: c.id, nombre: c.nombre, emails });
    }
    if (!data || data.length < 1000) break;
  }
  const nombreDe = new Map(centros.map((c) => [c.id, c.nombre]));
  // En cuántos centros sale cada palabra del nombre: las repetidas no identifican.
  const frecuencia = new Map<string, number>();
  for (const c of centros) for (const w of new Set(palabrasNombre(c.nombre))) frecuencia.set(w, (frecuencia.get(w) ?? 0) + 1);

  // Lo que Alain envió en los 14 días anteriores al más antiguo: para "le escribiste justo antes" y para el hilo.
  const fechas = huerfanos.map((h) => h.fecha).filter(Boolean) as string[];
  const desdeF = new Date(Math.min(...fechas.map((f) => Date.parse(f))) - 14 * 86400000).toISOString();
  const salientes: { centro_id: string; para: string[] | null; fecha: string; message_id: string }[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data } = await sb.from("charlas_mensajes").select("centro_id, para, fecha, message_id").eq("direccion", "saliente").not("centro_id", "is", null).gte("fecha", desdeF).order("fecha", { ascending: false }).range(desde, desde + 999);
    salientes.push(...((data ?? []) as typeof salientes));
    if (!data || data.length < 1000) break;
  }
  const porMessageId = new Map(salientes.map((s) => [s.message_id, s.centro_id]));

  for (const h of huerfanos) {
    const lista: Candidato[] = [];
    const meter = (centro_id: string, motivo: string) => {
      if (!centro_id || lista.some((x) => x.centro_id === centro_id)) return;
      lista.push({ centro_id, nombre: nombreDe.get(centro_id) ?? "¿?", motivo });
    };
    const de = (h.de ?? "").toLowerCase();
    const dom = dominioDe(de);
    const local = parteLocal(de);

    // 1. Hilo: cita un correo que Alain envió a un centro.
    for (const r of [h.in_reply_to, ...(h.referencias ?? [])].filter(Boolean) as string[]) {
      const c = porMessageId.get(r.replace(/^<|>$/g, ""));
      if (c) meter(c, "responde a un correo tuyo a este centro");
    }
    if (dom && !DOMINIOS_PERSONALES.has(dom)) {
      // 2. Buzón de la misma casa en el mismo dominio.
      for (const c of centros) {
        const e = c.emails.find((x) => dominioDe(x) === dom && buzonParecido(local, parteLocal(x)));
        if (e) meter(c.id, `buzón parecido a ${e}`);
      }
    }
    // 3. Una palabra propia del nombre del centro (que no comparta con más de dos centros)
    //    sale en el asunto, el buzón, el dominio o el texto (la firma: «IES Navarro Villoslada»).
    // El buzón no cuenta (nherrero@ es un apellido, no «IES Miguel Herrero»); el dominio sí, pegado (kirikino.com).
    const enCabecera = ` ${sinAcentos(h.asunto ?? "").replace(/[^a-z0-9]+/g, " ")} `;
    const pegado = DOMINIOS_PERSONALES.has(dom) ? "" : sinAcentos(dom.split(".")[0] ?? "");
    const enTexto = ` ${sinAcentos(h.texto ?? "").replace(/[^a-z0-9]+/g, " ")} `;
    // Primero lo del asunto o el dominio; luego lo del texto, el que más palabras comparte
    // primero («Navarro Villoslada» gana a «Pamplona» sola, que sale en la dirección de la firma).
    const enElTexto: { id: string; n: number }[] = [];
    for (const c of centros) {
      const propias = palabrasNombre(c.nombre).filter((w) => (frecuencia.get(w) ?? 0) <= 2);
      if (propias.some((w) => enCabecera.includes(` ${w} `) || (pegado && pegado.includes(w)))) meter(c.id, "su nombre sale en el asunto o en el dominio");
      else {
        const n = new Set(propias.filter((w) => enTexto.includes(` ${w} `))).size;
        if (n) enElTexto.push({ id: c.id, n });
      }
    }
    const maxN = Math.max(0, ...enElTexto.map((x) => x.n));
    for (const x of enElTexto.sort((a, b) => b.n - a.n)) if (x.n === maxN || maxN === 1) meter(x.id, "su nombre sale en el texto");
    // 4. Le escribiste a uno, dos o tres centros de ese dominio en las 3 horas anteriores
    //    (si fue una tanda automática a muchos, no dice nada).
    if (dom && !DOMINIOS_PERSONALES.has(dom) && h.fecha) {
      const llegada = Date.parse(h.fecha);
      const previos = salientes.filter((s) => Date.parse(s.fecha) <= llegada && llegada - Date.parse(s.fecha) < 3 * 3600000 && (s.para ?? []).some((p) => dominioDe(String(p)) === dom));
      if (new Set(previos.map((s) => s.centro_id)).size <= 3) {
        for (const s of previos) meter(s.centro_id, `le escribiste el ${hora(s.fecha)} (${Math.round((llegada - Date.parse(s.fecha)) / 60000)} min antes)`);
      }
    }
    out[h.id] = lista.slice(0, 4);
  }
  return out;
}
