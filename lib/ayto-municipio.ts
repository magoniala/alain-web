// Ayuntamiento ⇄ centros del mismo municipio, contra Supabase (encargo del 23-11-2026).
//
//  - Regla del Mail 1 (filtroMail1Municipio): no se escribe al ayuntamiento si en su municipio ya
//    se dio y se cobró una charla en los últimos 12 meses y no quedan más centros en el embudo; si
//    quedan, la tarjeta sale con aviso (nivel C). Lo llama crearTarea (lib/charlas-motor.ts), así
//    vale para el motor por fecha y para la cola diaria (lib/ayuntamientos.ts).
//  - Pista para los centros (guardarPistaParaCentros): lo que dice un ayuntamiento que sirve para
//    sus centros (p. ej. Beasain: "la ayuda la piden los centros") se guarda en
//    charlas_centros.pista_para_centros del ayuntamiento y se copia al Registro de cada centro.
//  - pistasAyto / pistaDeLocalidad: para enseñarla en las tarjetas y fichas de los centros.
//
// Reglas puras y pruebas: lib/ayto-municipio-reglas.ts · scripts/charlas/test-ayto-municipio.mts.
// Columna: sql/ayto_pista_centros.sql (aplicar a mano). Sin la columna, todo esto sigue
// funcionando salvo guardar la pista (las lecturas devuelven "sin pista").

import { supabaseCharlas, faseDeEstado } from "./charlas";
import { reglaMail1Municipio, mismoMunicipio, fechaBonita, lineaPistaCentro, type CentroMunicipio, type EventoCharla } from "./ayto-municipio-reglas";

type SB = ReturnType<typeof supabaseCharlas>;

const hoyMadrid = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

/** Centros (no ayuntamientos) del mismo municipio que esta localidad. */
export async function centrosDelMunicipio(sb: SB, localidad: string | null | undefined): Promise<CentroMunicipio[]> {
  if (!localidad) return [];
  const filas: CentroMunicipio[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.from("charlas_centros").select("id, nombre, estado, localidad, tipo").order("nombre").range(desde, desde + 999);
    if (error) throw new Error(error.message);
    for (const c of data ?? []) if (c.tipo !== "ayuntamiento" && mismoMunicipio(localidad, c.localidad as string | null)) filas.push(c as CentroMunicipio);
    if (!data || data.length < 1000) break;
  }
  return filas;
}

interface FichaMail1 {
  id: string;
  estado: string;
  localidad?: string | null;
}
interface DecisionMail1 {
  tipo: string;
  nivel: "A" | "B" | "C";
  instrucciones: string;
  nota?: string;
}

/**
 * Regla del Mail 1 al ayuntamiento. Devuelve la decisión (igual o con aviso) o null si no hay
 * que escribir; en ese caso deja la ficha con fecha a los 12 meses de la charla y una línea en
 * el Registro, para que no vuelva a salir cada día.
 */
export async function filtroMail1Municipio<D extends DecisionMail1>(c: FichaMail1, d: D): Promise<D | null> {
  if (!d.tipo.startsWith("ayto_mail_1")) return d;
  if (faseDeEstado(c.estado) > 2) return d; // persona nueva a mitad de conversación: no aplica
  const sb = supabaseCharlas();
  let localidad = c.localidad ?? null;
  if (!localidad) {
    const { data } = await sb.from("charlas_centros").select("localidad").eq("id", c.id).maybeSingle();
    localidad = (data?.localidad as string | null) ?? null;
  }
  const centros = await centrosDelMunicipio(sb, localidad);
  if (!centros.length) return d;
  const { data: eventos } = await sb.from("charlas_eventos").select("centro_id, fecha_evento, estado_evento, fecha_cobro").in("centro_id", centros.map((x) => x.id));
  const r = reglaMail1Municipio({ hoy: hoyMadrid(), centros, eventos: (eventos ?? []) as EventoCharla[] });

  if (r.accion === "normal") return d;
  if (r.accion === "aviso") {
    const aviso = `Ya dimos y cobramos la charla en ${r.centro} (${fechaBonita(r.fecha)}): pregunta solo por los demás centros de ${localidad} (${r.otros.join(", ")}).`;
    return {
      ...d,
      nivel: "C", // con aviso no sale sola: Alain la mira antes
      nota: [aviso, d.nota].filter(Boolean).join(" · "),
      instrucciones: `${d.instrucciones} CONTEXTO DEL MUNICIPIO: ya dimos (y cobramos) la charla en ${r.centro} el ${fechaBonita(r.fecha)}. No preguntes por ese centro: la única pregunta es cómo se organizan estas actividades para los demás centros (${r.otros.join(", ")}). Puedes citar ${r.centro} en media línea como referencia.`,
    };
  }
  // saltar
  const texto = `No se escribe al ayuntamiento: ya se dio y se cobró la charla en ${r.centro} (${fechaBonita(r.fecha)}) y no quedan más centros de ${localidad} en el embudo. Se vuelve a mirar el ${fechaBonita(r.hasta)}.`;
  await sb.from("charlas_centros").update({ fecha_proxima_accion: r.hasta, proxima_accion: `Mail 1 en pausa: charla cobrada en ${r.centro}`, actualizado_por: "sistema" }).eq("id", c.id);
  await sb.from("charlas_interacciones").insert({ centro_id: c.id, fecha: hoyMadrid(), canal: "Sistema", texto, orden: 600, origen: "sistema" });
  return null;
}

export interface PistaAyto {
  id: string;
  nombre: string;
  localidad: string | null;
  pista_para_centros: string | null;
}

/** Ayuntamientos con pista guardada. Si la columna aún no existe (SQL sin aplicar), lista vacía. */
export async function pistasAyto(sb: SB = supabaseCharlas()): Promise<PistaAyto[]> {
  const { data, error } = await sb.from("charlas_centros").select("id, nombre, localidad, pista_para_centros").eq("tipo", "ayuntamiento").not("pista_para_centros", "is", null);
  if (error) return [];
  return (data ?? []) as PistaAyto[];
}

/**
 * «Guardar para los centros»: guarda la pista en la ficha del ayuntamiento (sustituye la anterior),
 * lo apunta en su Registro y copia una línea en el Registro de cada centro del municipio (si no la tiene ya).
 */
export async function guardarPistaParaCentros(aytoId: string, texto: string): Promise<{ centros: string[] }> {
  const limpio = texto.trim();
  if (limpio.length < 5) throw new Error("Escribe la pista (qué dice el ayuntamiento que sirve para los centros).");
  const sb = supabaseCharlas();
  const { data: ayto, error } = await sb.from("charlas_centros").select("id, nombre, localidad, tipo").eq("id", aytoId).single();
  if (error || !ayto) throw new Error("No encuentro la ficha del ayuntamiento.");
  if (ayto.tipo !== "ayuntamiento") throw new Error("Esta ficha no es de un ayuntamiento.");

  const { error: e2 } = await sb.from("charlas_centros").update({ pista_para_centros: limpio, actualizado_por: "panel" }).eq("id", aytoId);
  if (e2) throw new Error(/pista_para_centros/.test(e2.message) ? "Falta aplicar sql/ayto_pista_centros.sql en Supabase." : e2.message);

  const hoy = hoyMadrid();
  const centros = await centrosDelMunicipio(sb, ayto.localidad as string | null);
  await sb.from("charlas_interacciones").insert({
    centro_id: aytoId,
    fecha: hoy,
    canal: "Nota",
    texto: `Pista para los centros guardada: ${limpio}${centros.length ? ` · copiada en ${centros.map((c) => `[[${c.nombre}]]`).join(" · ")}` : " · no hay centros de este municipio en el CRM"}`,
    orden: 600,
    origen: "panel",
  });
  const linea = lineaPistaCentro(String(ayto.nombre), limpio);
  for (const c of centros) {
    const { data: ya } = await sb.from("charlas_interacciones").select("id").eq("centro_id", c.id).eq("texto", linea).limit(1);
    if (ya?.length) continue;
    await sb.from("charlas_interacciones").insert({ centro_id: c.id, fecha: hoy, canal: "Nota", texto: linea, orden: 600, origen: "panel" });
  }
  return { centros: centros.map((c) => c.nombre) };
}
