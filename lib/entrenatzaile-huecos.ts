// Disponibilidad de la llamada de la Hoja de Ruta.
//
// Los huecos ya no son una lista escrita a mano: se calculan a partir de las
// reglas de abajo, de lo que ya está reservado y de los bloqueos manuales del
// panel. El cálculo vive aquí, en el servidor, y lo usan tanto el listado que
// ve el lead como la validación del hueco al confirmarlo — así no se puede
// colar una hora que no se ofreció.

export const ZONA = "Europe/Madrid";

/** Primera hora a la que puede empezar una llamada. */
export const HORA_PRIMERA = 9;
/** Última hora a la que puede empezar una llamada (la llamada dura una hora). */
export const HORA_ULTIMA = 20;
/** Las franjas se ofrecen cada media hora. */
export const PASO_MINUTOS = 30;
/** Antelación mínima con la que se puede reservar. */
export const ANTELACION_MINIMA_HORAS = 48;
/** Hasta cuántos días hacia adelante se puede reservar. */
export const HORIZONTE_DIAS = 30;
/** Tope de llamadas por día natural. */
export const MAX_POR_DIA = 1;
/** Tope de llamadas por semana natural (de lunes a domingo). */
export const MAX_POR_SEMANA = 5;

export interface HuecoDisponible {
  valor: string;
  etiqueta: string;
}

export interface Bloqueo {
  dia: string; // YYYY-MM-DD
  hora_desde: string | null; // "HH:MM:SS"; null en los dos = día entero
  hora_hasta: string | null;
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

// Offset de Madrid respecto a UTC, en minutos, para un instante concreto.
// Se calcula preguntándole al propio motor de fechas en vez de codificar
// +1/+2 a mano, para que los dos domingos del año en que cambia la hora no
// desplacen todos los huecos.
function offsetMadridMin(instante: Date): number {
  const enMadrid = new Date(instante.toLocaleString("en-US", { timeZone: ZONA }));
  const enUtc = new Date(instante.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((enMadrid.getTime() - enUtc.getTime()) / 60000);
}

// Hora de pared de Madrid -> instante real. Dos pasadas: la primera estima el
// offset y la segunda lo confirma sobre el instante ya corregido.
function paredMadridAInstante(dia: string, hora: number, minuto: number): Date {
  const [anio, mes, d] = dia.split("-").map(Number);
  const comoSiFueraUtc = Date.UTC(anio, mes - 1, d, hora, minuto);
  const primerOffset = offsetMadridMin(new Date(comoSiFueraUtc));
  const segundoOffset = offsetMadridMin(new Date(comoSiFueraUtc - primerOffset * 60000));
  return new Date(comoSiFueraUtc - segundoOffset * 60000);
}

function sufijoOffset(minutos: number): string {
  const signo = minutos >= 0 ? "+" : "-";
  const abs = Math.abs(minutos);
  return `${signo}${dosDigitos(Math.floor(abs / 60))}:${dosDigitos(abs % 60)}`;
}

/** Identificador de un hueco: ISO con la zona escrita de forma explícita. */
export function huecoISO(dia: string, hora: number, minuto: number): string {
  const instante = paredMadridAInstante(dia, hora, minuto);
  return `${dia}T${dosDigitos(hora)}:${dosDigitos(minuto)}:00${sufijoOffset(offsetMadridMin(instante))}`;
}

/** Día natural (en Madrid) al que pertenece un instante. */
export function diaMadrid(instante: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

export function sumarDias(dia: string, n: number): string {
  const [anio, mes, d] = dia.split("-").map(Number);
  const dt = new Date(Date.UTC(anio, mes - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Lunes de la semana natural a la que pertenece ese día. */
export function lunesDe(dia: string): string {
  const [anio, mes, d] = dia.split("-").map(Number);
  const dt = new Date(Date.UTC(anio, mes - 1, d));
  const diaSemana = dt.getUTCDay(); // 0 = domingo
  return sumarDias(dia, -(diaSemana === 0 ? 6 : diaSemana - 1));
}

/** Etiqueta que ve el lead: "miércoles, 26 de agosto · 18:00". */
export function formatearHueco(iso: string): string {
  const fecha = new Date(iso);
  const dia = fecha.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: ZONA,
  });
  const hora = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: ZONA });
  return `${dia} · ${hora}`;
}

function minutosDeHora(hhmmss: string): number {
  const [h, m] = hhmmss.split(":").map(Number);
  return h * 60 + m;
}

interface BloqueosDelDia {
  diaEntero: boolean;
  franjas: Array<{ desde: number; hasta: number }>;
}

function agruparBloqueos(bloqueos: Bloqueo[]): Map<string, BloqueosDelDia> {
  const mapa = new Map<string, BloqueosDelDia>();
  for (const b of bloqueos) {
    const dia = b.dia.slice(0, 10);
    const actual = mapa.get(dia) ?? { diaEntero: false, franjas: [] };
    if (!b.hora_desde || !b.hora_hasta) {
      actual.diaEntero = true;
    } else {
      actual.franjas.push({ desde: minutosDeHora(b.hora_desde), hasta: minutosDeHora(b.hora_hasta) });
    }
    mapa.set(dia, actual);
  }
  return mapa;
}

export interface EstadoDia {
  dia: string;
  /** Huecos que se le ofrecen al lead ese día. */
  huecos: HuecoDisponible[];
  /** Por qué no hay ninguno, cuando no los hay. */
  motivo: null | "reservado" | "semana-llena" | "bloqueado" | "sin-margen";
}

/**
 * Calcula día a día el estado de la agenda. Es la única fuente de verdad:
 * de aquí salen tanto los huecos que se le enseñan al lead como el calendario
 * del panel.
 */
export function calcularAgenda({
  ahora,
  reservados,
  bloqueos,
}: {
  ahora: Date;
  /** ISO de los huecos ya cogidos. */
  reservados: string[];
  bloqueos: Bloqueo[];
}): EstadoDia[] {
  const desde = new Date(ahora.getTime() + ANTELACION_MINIMA_HORAS * 3600_000);
  const primerDia = diaMadrid(ahora);
  const ultimoDia = sumarDias(primerDia, HORIZONTE_DIAS);

  // Cuántas llamadas hay ya cada día y cada semana. Se cuentan TODAS las
  // reservas que se pasen, también las anteriores al rango visible: el tope
  // semanal de una semana a caballo depende de ellas.
  const porDia = new Map<string, number>();
  const porSemana = new Map<string, number>();
  const ocupados = new Set<number>();
  for (const iso of reservados) {
    const instante = new Date(iso);
    if (Number.isNaN(instante.getTime())) continue;
    ocupados.add(instante.getTime());
    const dia = diaMadrid(instante);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    const lunes = lunesDe(dia);
    porSemana.set(lunes, (porSemana.get(lunes) ?? 0) + 1);
  }

  const bloqueosPorDia = agruparBloqueos(bloqueos);
  const agenda: EstadoDia[] = [];

  for (let dia = primerDia; dia <= ultimoDia; dia = sumarDias(dia, 1)) {
    const bloqueadoEntero = bloqueosPorDia.get(dia)?.diaEntero ?? false;
    const franjas = bloqueosPorDia.get(dia)?.franjas ?? [];

    if ((porDia.get(dia) ?? 0) >= MAX_POR_DIA) {
      agenda.push({ dia, huecos: [], motivo: "reservado" });
      continue;
    }
    if (bloqueadoEntero) {
      agenda.push({ dia, huecos: [], motivo: "bloqueado" });
      continue;
    }
    if ((porSemana.get(lunesDe(dia)) ?? 0) >= MAX_POR_SEMANA) {
      agenda.push({ dia, huecos: [], motivo: "semana-llena" });
      continue;
    }

    const huecos: HuecoDisponible[] = [];
    for (let m = HORA_PRIMERA * 60; m <= HORA_ULTIMA * 60; m += PASO_MINUTOS) {
      const hora = Math.floor(m / 60);
      const minuto = m % 60;
      const iso = huecoISO(dia, hora, minuto);
      const instante = new Date(iso);
      if (instante < desde) continue; // no llega a la antelación mínima
      if (ocupados.has(instante.getTime())) continue;
      if (franjas.some((f) => m >= f.desde && m < f.hasta)) continue;
      huecos.push({ valor: iso, etiqueta: formatearHueco(iso) });
    }

    agenda.push({ dia, huecos, motivo: huecos.length ? null : "sin-margen" });
  }

  return agenda;
}

/** Solo los huecos ofrecibles, en plano, para el selector del lead. */
export function huecosDisponibles(args: Parameters<typeof calcularAgenda>[0]): HuecoDisponible[] {
  return calcularAgenda(args).flatMap((d) => d.huecos);
}

/**
 * ¿Es una hora válida de la rejilla (día correcto, entre las 9:00 y las 20:00,
 * en punto o y media)?
 *
 * Esto es lo único que se le exige a un hueco puesto desde el panel: la
 * antelación mínima y el horizonte son reglas para el lead, no para Alain,
 * que puede mover una llamada a mañana si le hace falta. El tope de una
 * llamada al día lo sigue imponiendo el índice único de la base de datos.
 */
export function esHuecoDeLaRejilla(iso: string): boolean {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return false;

  const dia = diaMadrid(instante);
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instante);
  const hora = Number(partes.find((p) => p.type === "hour")?.value);
  const minuto = Number(partes.find((p) => p.type === "minute")?.value);

  if (!Number.isFinite(hora) || !Number.isFinite(minuto)) return false;
  if (hora < HORA_PRIMERA || hora > HORA_ULTIMA) return false;
  if (hora === HORA_ULTIMA && minuto !== 0) return false;
  if (minuto % PASO_MINUTOS !== 0) return false;

  // Que el identificador sea exactamente el que generaríamos nosotros, para
  // que no entren variantes del mismo instante escritas de otra forma.
  return huecoISO(dia, hora, minuto) === iso;
}

/**
 * ¿Se ofreció de verdad este hueco? Se recalcula en el servidor al confirmar,
 * en vez de fiarse de lo que mande el navegador: si alguien manipula el valor
 * o si el hueco se ha llenado mientras rellenaba, aquí se cae.
 */
export function esHuecoOfrecido(hueco: string, args: Parameters<typeof calcularAgenda>[0]): boolean {
  const objetivo = new Date(hueco).getTime();
  if (Number.isNaN(objetivo)) return false;
  return huecosDisponibles(args).some((h) => new Date(h.valor).getTime() === objetivo);
}
