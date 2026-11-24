// Seguimiento de presupuestos por validez (regla de Alain, 24-11-2026; vault:
// «🗂️ COMERCIAL/Protocolo — Seguimiento de presupuestos»). Sin respuesta:
//   1) día laborable anterior al fin de la validez → aviso «mañana termina» (MSG 06)
//   2) día en que termina                         → pedir el no (MSG 07)
//   3) día laborable siguiente                    → aparcar o liberar fecha (sin mensaje)
//
// No hay campo nuevo: la validez va escrita en `proxima_accion` del paso 1
// («… · validez hasta AAAA-MM-DD …») y en el paso 2 es la propia
// `fecha_proxima_accion`. Así viaja con el espejo del vault tal cual.
// Puro (sin Supabase): lo usan el envío, el motor de magia y el panel.

export type PasoValidez = "aviso" | "pedir_no" | "fin";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const fecha = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const laborable = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6;

/** Día laborable (lunes a viernes) anterior. No cuenta festivos. */
export function laborableAnterior(dia: string): string {
  const d = fecha(dia);
  do d.setUTCDate(d.getUTCDate() - 1);
  while (!laborable(d));
  return iso(d);
}
/** Día laborable siguiente. No cuenta festivos. */
export function laborableSiguiente(dia: string): string {
  const d = fecha(dia);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (!laborable(d));
  return iso(d);
}
const diasEntre = (a: string, b: string) => Math.round((fecha(b).getTime() - fecha(a).getTime()) / 86400000);

// ── Textos de proxima_accion (los del protocolo, al pie de la letra) ──
const ref = (numero?: string | null) => (numero && numero.trim()) || "el presupuesto";
export const PASO_FIN = "Sin respuesta: aparcar o liberar fecha";
export const textoPasoAviso = (numero: string | null | undefined, validez: string) => `Aviso: mañana vence ${ref(numero)} (MSG 06) · validez hasta ${validez} · después, pedir el no`;
export const textoPasoPedirNo = (numero: string | null | undefined) => `Pedir el no (MSG 07) · ${ref(numero)} vence hoy`;

/** Qué paso de la secuencia marca la ficha (o null si no sigue la secuencia). */
export function leerPaso(proxima: string | null | undefined): { paso: PasoValidez | null; validez: string | null; numero: string | null } {
  const pa = (proxima ?? "").trim();
  const numero = /\b(P-\d{6,8}-\d+)\b/.exec(pa)?.[1] ?? null;
  const validez = /validez(?:\s+ampliada)?\s+hasta\s+(\d{4}-\d{2}-\d{2})/i.exec(pa)?.[1] ?? null;
  if (/^aviso:\s*(mañana|el lunes)\s+vence/i.test(pa)) return { paso: "aviso", validez, numero };
  if (/^pedir el no/i.test(pa)) return { paso: "pedir_no", validez, numero };
  if (/^sin respuesta/i.test(pa)) return { paso: "fin", validez, numero };
  return { paso: null, validez, numero };
}

/**
 * Lo que se apunta en la ficha al enviar el presupuesto (panel o a mano).
 * Si el aviso ya no llega a tiempo (validez hoy o mañana con envío tardío), se salta al «pedir el no».
 */
export function seguimientoAlEnviar(validez: string, numero: string | null | undefined, hoy: string) {
  if (!ISO.test(validez)) throw new Error("Pon la fecha de «Validez hasta».");
  if (validez < hoy) throw new Error("Esa validez ya ha pasado.");
  const aviso = laborableAnterior(validez);
  if (aviso < hoy) return { proxima_accion: textoPasoPedirNo(numero), fecha_proxima_accion: validez, aviso: null as string | null, pedir_no: validez };
  return { proxima_accion: textoPasoAviso(numero, validez), fecha_proxima_accion: aviso, aviso: aviso as string | null, pedir_no: validez };
}

// ── Mensajes (vault: «🗂️ COMERCIAL/Mensajes comunes/MSG 06» y «MSG 07»; si cambian allí, cambiarlos aquí) ──
const MESES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_EU = ["urtarrila", "otsaila", "martxoa", "apirila", "maiatza", "ekaina", "uztaila", "abuztua", "iraila", "urria", "azaroa", "abendua"];
const DIAS_ES = ["el domingo", "el lunes", "el martes", "el miércoles", "el jueves", "el viernes", "el sábado"];
const DIAS_EU = ["igandean", "astelehenean", "asteartean", "asteazkenean", "ostegunean", "ostiralean", "larunbatean"];

/** Nombre para el saludo: «Asier y Miren (…)» → «Asier y Miren» / «Asier eta Miren»; «Ana López» → «Ana». */
export function nombreSaludo(responsable: string | null | undefined, eu: boolean): string | null {
  const limpio = (responsable ?? "").replace(/\(.*?\)/g, "").trim();
  if (!limpio) return null;
  const partes = limpio.split(/\s+(?:y|eta|e)\s+|\s*,\s*/i).map((p) => p.trim().split(/\s+/)[0]).filter(Boolean);
  if (partes.length < 2) return partes[0] ?? null;
  return `${partes.slice(0, -1).join(", ")} ${eu ? "eta" : "y"} ${partes[partes.length - 1]}`;
}

/** Texto de MSG 06 (aviso) o MSG 07 (pedir el no) en el idioma de la ficha. «mañana» se ajusta al día real (lunes, hoy…). */
export function mensajeValidez(paso: "aviso" | "pedir_no", opts: { eu: boolean; nombre: string | null; validez: string; hoy: string }): string {
  const { eu, nombre, validez, hoy } = opts;
  const d = fecha(validez);
  const saludo = eu ? `Kaixo${nombre ? ` ${nombre}` : ""},` : `Hola${nombre ? ` ${nombre}` : ""},`;
  if (paso === "pedir_no") {
    return eu
      ? `${saludo}\n\nGaur amaitzen da aurrekontuaren balioaldia. Interesatzen ez bazaizue, ez dago arazorik: "ez" bat nahikoa da, horrela data beste eskaera batzuetarako askatu dezaket.\n\nOndo izan,\n\nAlain`
      : `${saludo}\n\nHoy termina la validez del presupuesto. Si no os interesa, no pasa nada: con un "no" me basta, así puedo liberar la fecha para otras solicitudes.\n\nUn abrazo,\n\nAlain`;
  }
  const dif = diasEntre(hoy, validez);
  const cuandoEs = dif <= 0 ? "hoy" : dif === 1 ? "mañana" : DIAS_ES[d.getUTCDay()];
  const cuandoEu = dif <= 0 ? "gaur" : dif === 1 ? "bihar" : DIAS_EU[d.getUTCDay()];
  return eu
    ? `${saludo}\n\nGogorarazteko bakarrik: aurrekontuaren balioaldia ${cuandoEu} amaitzen da (${MESES_EU[d.getUTCMonth()]}k ${d.getUTCDate()}). Zalantzaren bat baduzue edo zerbait falta bazaizue erabakitzeko, esadazu eta konponduko dugu.\n\nOndo izan,\n\nAlain`
    : `${saludo}\n\nSolo para recordarte que la validez del presupuesto termina ${cuandoEs} (${d.getUTCDate()} de ${MESES_ES[d.getUTCMonth()]}). Si tenéis alguna duda o os falta algo para decidir, dímelo y lo resolvemos.\n\nUn abrazo,\n\nAlain`;
}

// ── Prerrelleno desde el mail pegado o el nombre del PDF ──
export function extraerNumero(...textos: (string | null | undefined)[]): string | null {
  for (const t of textos) {
    const m = /\b(P-\d{6,8}-\d+)\b/.exec(t ?? "");
    if (m) return m[1];
  }
  return null;
}

/**
 * Fecha de validez escrita en el mail («validez hasta el 24 de noviembre», «válido hasta 24/11/2026»,
 * «balioaldia 2026ko azaroaren 24ra arte»). Solo cuenta una fecha cerca de una de esas palabras,
 * para no confundirla con la del evento. null si no la encuentra.
 */
export function extraerValidez(texto: string | null | undefined, hoy: string): string | null {
  const t = (texto ?? "").toLowerCase();
  if (!t) return null;
  const claves = [...t.matchAll(/validez|v[aá]lid[oa]|balioald|arte\b|hasta/g)].map((m) => m.index ?? 0);
  if (!claves.length) return null;
  const anioDe = (mes: number, dia: number, anio?: string) => {
    if (anio) return Number(anio.length === 2 ? `20${anio}` : anio);
    const y = Number(hoy.slice(0, 4));
    const cand = `${y}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    return cand < hoy ? y + 1 : y;
  };
  const fechas: { pos: number; iso: string }[] = [];
  const meter = (pos: number, y: number, m: number, d: number) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return;
    const x = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (iso(fecha(x)) === x) fechas.push({ pos, iso: x });
  };
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) meter(m.index ?? 0, +m[1], +m[2], +m[3]);
  for (const m of t.matchAll(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/g)) meter(m.index ?? 0, anioDe(+m[2], +m[1], m[3]), +m[2], +m[1]);
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MESES_ES.join("|")})(?:\\s+de\\s+(\\d{4}))?`, "g"))) {
    const mes = MESES_ES.indexOf(m[2]) + 1;
    meter(m.index ?? 0, anioDe(mes, +m[1], m[3]), mes, +m[1]);
  }
  const raices = MESES_EU.map((x) => x.replace(/a$/, ""));
  for (const m of t.matchAll(new RegExp(`(?:(\\d{4})ko\\s+)?(${raices.join("|")})(?:aren|ak)\\s+(\\d{1,2})`, "g"))) {
    const mes = raices.indexOf(m[2]) + 1;
    meter(m.index ?? 0, anioDe(mes, +m[3], m[1]), mes, +m[3]);
  }
  const cerca = fechas
    .map((f) => ({ ...f, dist: Math.min(...claves.map((c) => Math.abs(c - f.pos))) }))
    .filter((f) => f.dist <= 60 && f.iso >= hoy)
    .sort((a, b) => a.dist - b.dist);
  return cerca[0]?.iso ?? null;
}

// ── Control: fichas en «5 Propuesta enviada» fuera de la secuencia ──
export interface FichaControl { id: string; nombre: string; estado: string | null; proxima_accion: string | null; fecha_proxima_accion: string | null }
export function controlPresupuestos(fichas: FichaControl[]): { id: string; nombre: string; motivo: string }[] {
  const out: { id: string; nombre: string; motivo: string }[] = [];
  for (const f of fichas) {
    if (!/^5\b/.test(f.estado ?? "")) continue;
    const p = leerPaso(f.proxima_accion);
    if (!f.fecha_proxima_accion || !(f.proxima_accion ?? "").trim()) out.push({ id: f.id, nombre: f.nombre, motivo: "sin próxima acción" });
    else if (!p.paso) out.push({ id: f.id, nombre: f.nombre, motivo: "sin validez apuntada (no sigue el aviso / pedir el no)" });
    else if (p.paso === "aviso" && p.validez && f.fecha_proxima_accion > laborableAnterior(p.validez)) out.push({ id: f.id, nombre: f.nombre, motivo: `el aviso (${f.fecha_proxima_accion}) cae después del día anterior a la validez (${p.validez})` });
    else if (p.paso === "aviso" && !p.validez) out.push({ id: f.id, nombre: f.nombre, motivo: "el aviso no dice hasta cuándo vale el presupuesto" });
  }
  return out;
}
