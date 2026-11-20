// Fechas de la newsletter que se calculan en hora de Madrid (los envíos salen
// siempre a una hora de Madrid, no de UTC) y la marca de «devuelto a confirmar».
//
// Sin dependencias a propósito: lo importan el panel, el API y las pruebas
// (scripts/newsletter/test-fechas.mts).

const ZONA = "Europe/Madrid";

/**
 * Marca de un mail que Alain mandó a «Por confirmar» desde Programadas o desde
 * la cola B (20-11-2026). Vive en orden_cola, que en un mail 'pendiente' no se
 * usa para nada más (el orden solo cuenta en estado 'cola'): así no hace falta
 * una columna nueva ni una migración a mano en Supabase.
 *
 * Sirve para una sola cosa: al confirmarlo, si su fecha ya ha pasado, se
 * reprograma al siguiente día libre en vez de rechazarlo. Los mails que
 * prepara Claude no la llevan y conservan el comportamiento de siempre (error
 * «la fecha ya ha pasado»).
 */
export const MARCA_DEVUELTO_A_CONFIRMAR = -1;

/** "2026-11-20" en Madrid. */
export function fechaMadrid(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** "19:15" en Madrid. */
export function horaMadrid(d: Date): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

// Minutos que Madrid va por delante de UTC en ese instante (60 o 120).
function desfaseMadrid(d: Date): number {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  const comoUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((comoUtc - d.getTime()) / 60000);
}

/** Instante UTC que corresponde a «fecha hh:mm» en hora de Madrid. */
export function madridAInstante(fecha: string, hhmm: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  const ingenuo = Date.UTC(y, m - 1, d, h, min);
  // Dos pasadas: la primera da el desfase aproximado, la segunda lo afina en
  // los días en que cambia la hora.
  const t1 = ingenuo - desfaseMadrid(new Date(ingenuo)) * 60000;
  return new Date(ingenuo - desfaseMadrid(new Date(t1)) * 60000);
}

function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias, 12)).toISOString().slice(0, 10);
}

/**
 * Siguiente día libre para un mail cuya fecha ya pasó: misma hora (de Madrid)
 * que tenía, a partir de ahora, en el primer día que no tenga ya un envío.
 * Un día cuenta como ocupado si algún mail sale o ha salido ese día
 * (`ocupados`: sus fechas de envío, en ISO): la newsletter es de un mail al día.
 */
export function siguienteDiaLibre(originalIso: string, ocupados: string[], ahora: Date = new Date()): Date {
  const hora = horaMadrid(new Date(originalIso));
  const dias = new Set(ocupados.map((iso) => fechaMadrid(new Date(iso))));
  let fecha = fechaMadrid(ahora);
  for (let i = 0; i < 365; i++, fecha = sumarDias(fecha, 1)) {
    const instante = madridAInstante(fecha, hora);
    if (instante.getTime() > ahora.getTime() && !dias.has(fecha)) return instante;
  }
  throw new Error("No hay ningún día libre en el próximo año.");
}
