// Ayuntamiento ⇄ centros del mismo municipio (encargo del 23-11-2026, regla de Alain del 27-11-2026).
// Funciones puras, sin dependencias, para poder probarlas con `npm test`.
// La parte que lee y escribe en Supabase está en lib/ayto-municipio.ts.
//
// Regla del Mail 1 (aceptada por Alain tal cual, 27-11-2026):
//   - Si en el municipio ya se dio Y se cobró una charla en un centro en los últimos 12 meses
//     y no queda ningún otro centro del municipio en el embudo → no sale la tarjeta de Mail 1
//     al ayuntamiento (se vuelve a mirar cuando se cumplan los 12 meses).
//   - Si quedan otros centros en el embudo → la tarjeta sale, con aviso: preguntar solo por ellos.

export interface CentroMunicipio {
  id: string;
  nombre: string;
  estado: string | null;
  localidad?: string | null;
}

export interface EventoCharla {
  centro_id: string | null;
  fecha_evento: string | null;
  estado_evento: string | null;
  fecha_cobro: string | null;
}

export type ReglaMail1 =
  | { accion: "normal" }
  | { accion: "saltar"; centro: string; fecha: string; hasta: string }
  | { accion: "aviso"; centro: string; fecha: string; otros: string[] };

const quitarTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Formas de un nombre de municipio: «Arrasate/Mondragón» → {arrasate, mondragon, arrasate/mondragon}. */
export function partesMunicipio(s: string | null | undefined): Set<string> {
  const n = quitarTildes(String(s ?? "")).toLowerCase().replace(/\s+/g, " ").trim();
  if (!n) return new Set();
  return new Set([n, ...n.split("/").map((p) => p.trim()).filter(Boolean)]);
}

/** ¿Son el mismo municipio? (comparte alguna de sus formas). */
export function mismoMunicipio(a: string | null | undefined, b: string | null | undefined): boolean {
  const pa = partesMunicipio(a);
  for (const p of partesMunicipio(b)) if (pa.has(p)) return true;
  return false;
}

function fase(estado: string | null | undefined): number {
  const m = /^(\d+(?:\.\d+)?)/.exec(estado ?? "");
  return m ? Math.floor(Number(m[1])) : -1;
}

/** En el embudo = cualquier fase menos 7 Ganado y 8 Descartado (los aparcados, 9, siguen dentro). */
export function enEmbudo(estado: string | null | undefined): boolean {
  const f = fase(estado);
  return f >= 0 && f !== 7 && f !== 8;
}

export function sumarDias(iso: string, dias: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Charla hecha y cobrada en los últimos 12 meses (no cancelada, ya pasada, con fecha de cobro). */
export function charlaCobradaReciente(e: EventoCharla, hoy: string): boolean {
  if (!e.fecha_evento || !e.fecha_cobro) return false;
  if ((e.estado_evento ?? "").toLowerCase().startsWith("cancel")) return false;
  const f = e.fecha_evento.slice(0, 10);
  return f <= hoy && f >= sumarDias(hoy, -365);
}

/** Qué hacer con el Mail 1 al ayuntamiento según lo que ya hay en su municipio. */
export function reglaMail1Municipio(entrada: { hoy: string; centros: CentroMunicipio[]; eventos: EventoCharla[] }): ReglaMail1 {
  const { hoy, centros, eventos } = entrada;
  const ids = new Set(centros.map((c) => c.id));
  const cobradas = eventos
    .filter((e) => e.centro_id && ids.has(e.centro_id) && charlaCobradaReciente(e, hoy))
    .sort((a, b) => String(b.fecha_evento).localeCompare(String(a.fecha_evento)));
  if (!cobradas.length) return { accion: "normal" };

  const conCharla = new Set(cobradas.map((e) => e.centro_id as string));
  const ultima = cobradas[0];
  const centro = centros.find((c) => c.id === ultima.centro_id)?.nombre ?? "un centro del municipio";
  const fecha = String(ultima.fecha_evento).slice(0, 10);
  const otros = centros.filter((c) => !conCharla.has(c.id) && enEmbudo(c.estado)).map((c) => c.nombre);
  if (!otros.length) return { accion: "saltar", centro, fecha, hasta: sumarDias(fecha, 366) };
  return { accion: "aviso", centro, fecha, otros };
}

/** dd-mm-aaaa, como en el resto del panel. */
export const fechaBonita = (iso: string) => iso.slice(0, 10).split("-").reverse().join("-");

/** Línea que se copia en el Registro de cada centro del municipio al guardar la pista. */
export function lineaPistaCentro(ayuntamiento: string, texto: string): string {
  return `Recado de [[${ayuntamiento}]] para los centros: ${texto.trim()}`;
}

/** De todas las pistas guardadas, la del ayuntamiento de esta localidad (o null). */
export function pistaDeLocalidad<T extends { localidad: string | null; pista_para_centros: string | null }>(pistas: T[], localidad: string | null | undefined): T | null {
  if (!localidad) return null;
  return pistas.find((p) => p.pista_para_centros && mismoMunicipio(p.localidad, localidad)) ?? null;
}
