// Disponibilidad de las llamadas. UNA sola agenda para las dos landings.
//
// Los huecos no son una lista escrita a mano: se calculan a partir de las
// reglas de abajo, de lo que ya está reservado y de los bloqueos manuales del
// panel. El cálculo vive aquí, en el servidor, y lo usan tanto el listado que
// ve el lead como la validación del hueco al confirmarlo — así no se puede
// colar una hora que no se ofreció.
//
// Desde 2026-09-15 hay dos tipos de cita compartiendo agenda:
//
//   'hoja-de-ruta'    la videollamada de una hora de /hoja-de-ruta.
//   'infoproductos'   la de media hora de creadores.alainzulaika.com.
//
// Lo que NO puede pasar es que una página ofrezca un hueco que la otra ha
// inutilizado, así que aquí no hay dos cálculos: hay uno que recibe TODAS las
// reservas de los dos tipos y aplica las reglas de bloqueo de cada una. El
// `tipo` que se pasa dice para qué página se está calculando, no qué reservas
// hay que mirar.
//
// El apartado atómico lo sigue imponiendo la base de datos (el índice único
// de `hueco`, el de un día para la Hoja de Ruta y el trigger de cruces de
// reservas_tipo_cita.sql), no este archivo. Esto evita el choque en el caso
// normal; la base de datos lo evita también en la carrera.

export const ZONA = "Europe/Madrid";

export type TipoCita = "hoja-de-ruta" | "infoproductos";

/** Primera hora a la que puede empezar una llamada. */
export const HORA_PRIMERA = 9;
/** Última hora a la que puede empezar una llamada. */
export const HORA_ULTIMA = 20;
/** Las franjas se ofrecen cada media hora. */
export const PASO_MINUTOS = 30;

/**
 * Cuánta agenda se lleva por delante una reserva YA HECHA, de cara a las dos
 * páginas. Las tres reglas son distintas entre sí, y a propósito:
 *
 *   Hoja de Ruta → Hoja de Ruta
 *     Su día natural ENTERO. No hay dos en un día.
 *
 *   Hoja de Ruta → infoproductos
 *     Solo su MEDIO día: la mañana si la llamada es de mañana, la tarde si es
 *     de tarde. Una Hoja de Ruta a las 10:00 deja la tarde entera abierta
 *     para citas cortas. Lo que se protege con el día completo es no encadenar
 *     DOS llamadas largas, no quedarse sin hacer nada a las seis.
 *
 *   Infoproductos → las dos
 *     De 1 h antes a 2 h después. Una llamada de media hora a las 10:00 tapa
 *     de 9:00 a 11:59, y nada más: ese mismo día se puede reservar la Hoja de
 *     Ruta de las 18:00.
 *
 * Es decir: un infoproducto no cierra el día para la Hoja de Ruta, y una Hoja
 * de Ruta solo cierra medio día para los infoproductos. Lo que evita que una
 * llamada corta y gratuita te tumbe la llamada larga de 90 € del mismo día.
 */
export const VENTANA_INFOPRODUCTOS = { antesMin: 60, despuesMin: 120 };

/**
 * Dónde se parte el día en mañana y tarde.
 *
 * Las 14:00. Con la rejilla de 9:00 a 20:00, deja diez franjas por la mañana
 * y trece por la tarde. Si algún día se cambia, hay que cambiarlo TAMBIÉN en
 * el trigger de reservas_tipo_cita.sql, que compara contra este mismo '14:00'
 * escrito a mano: son las dos mitades del mismo cálculo.
 */
export const CORTE_MEDIODIA = 14;

/**
 * Lo que dura una llamada de la Hoja de Ruta.
 *
 * Solo hace falta para el caso del borde: una llamada de las 13:30 es "de
 * mañana" y sin embargo se alarga hasta las 14:30. Sin esto, un infoproducto
 * de las 14:00 pasaría el filtro de la mitad del día y caería encima.
 */
export const DURACION_HOJA_RUTA_MIN = 60;

interface ReglasCita {
  /** Antelación mínima con la que se puede reservar. */
  antelacionMinimaHoras: number;
  /** Hasta cuántos días hacia adelante se puede reservar. */
  horizonteDias: number;
  /** Tope de citas DE ESTE TIPO por día natural. */
  maxPorDia: number;
  /** Tope de citas DE ESTE TIPO por semana natural (lunes a domingo). null = sin tope. */
  maxPorSemana: number | null;
}

/**
 * Los topes de cantidad cuentan solo las citas de su propio tipo. Los de la
 * Hoja de Ruta existen para no encadenar llamadas largas; los infoproductos
 * son media hora y no cansan igual, así que tienen los suyos.
 *
 * Que un tipo no llene al otro por cantidad no significa que no se estorben:
 * de eso se encarga la ocupación de arriba, que sí es cruzada.
 */
export const REGLAS: Record<TipoCita, ReglasCita> = {
  "hoja-de-ruta": {
    antelacionMinimaHoras: 48,
    horizonteDias: 30,
    maxPorDia: 1,
    maxPorSemana: 5,
  },
  infoproductos: {
    // Media hora y sin pago de por medio: pedir 48 h de antelación para esto
    // sería fricción por simetría, no por motivo.
    antelacionMinimaHoras: 24,
    horizonteDias: 30,
    maxPorDia: 2,
    // Sin tope semanal: lo que separa unas de otras es la ventana de ±, y si
    // una semana se llena demasiado se cierra desde el panel.
    maxPorSemana: null,
  },
};

/** Antelación mínima de la Hoja de Ruta. Se conserva suelta por compatibilidad. */
export const ANTELACION_MINIMA_HORAS = REGLAS["hoja-de-ruta"].antelacionMinimaHoras;
/** Horizonte de la Hoja de Ruta. */
export const HORIZONTE_DIAS = REGLAS["hoja-de-ruta"].horizonteDias;
/** Tope diario de la Hoja de Ruta (lo enseña el panel). */
export const MAX_POR_DIA = REGLAS["hoja-de-ruta"].maxPorDia;
/** Tope semanal de la Hoja de Ruta (lo enseña el panel). */
export const MAX_POR_SEMANA = REGLAS["hoja-de-ruta"].maxPorSemana ?? 0;

export interface HuecoDisponible {
  valor: string;
  etiqueta: string;
}

/** Una reserva ya hecha: su hueco y de qué tipo de cita es. */
export interface ReservaOcupada {
  hueco: string;
  tipo: TipoCita;
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

export interface ArgsAgenda {
  ahora: Date;
  /** TODAS las reservas vivas, de los dos tipos. Filtrar aquí sería el fallo. */
  reservados: ReservaOcupada[];
  bloqueos: Bloqueo[];
  /** Para qué página se calcula. No filtra nada: elige las reglas a aplicar. */
  tipo: TipoCita;
}

/** Hora de pared (en Madrid) de un instante. */
function horaMadrid(instante: Date): number {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(instante);
  return Number(partes.find((p) => p.type === "hour")?.value);
}

/**
 * ¿Le tapa a un infoproducto esta franja alguna Hoja de Ruta del día?
 *
 * Dos motivos distintos, y hacen falta los dos:
 *
 *   · Cae en la misma mitad del día que la llamada larga.
 *   · O cae DENTRO de la llamada larga, aunque sea en la otra mitad. Es el
 *     caso de la Hoja de Ruta de las 13:30, que es de mañana y se alarga
 *     hasta las 14:30.
 */
function tapadoPorHojaDeRuta(
  hojasDeRuta: Array<{ dia: string; inicio: number; esManana: boolean }>,
  dia: string,
  minutosDelDia: number,
  instante: number
): boolean {
  const franjaEsManana = minutosDelDia < CORTE_MEDIODIA * 60;
  return hojasDeRuta.some(
    (hr) =>
      hr.dia === dia &&
      (hr.esManana === franjaEsManana ||
        (instante >= hr.inicio && instante < hr.inicio + DURACION_HOJA_RUTA_MIN * 60_000))
  );
}

/**
 * Calcula día a día el estado de la agenda. Es la única fuente de verdad:
 * de aquí salen tanto los huecos que se le enseñan al lead como el calendario
 * del panel.
 */
export function calcularAgenda({ ahora, reservados, bloqueos, tipo }: ArgsAgenda): EstadoDia[] {
  const reglas = REGLAS[tipo];
  const desde = new Date(ahora.getTime() + reglas.antelacionMinimaHoras * 3600_000);
  const primerDia = diaMadrid(ahora);
  const ultimoDia = sumarDias(primerDia, reglas.horizonteDias);

  // Ocupación CRUZADA: sale de las reservas de los dos tipos, porque las dos
  // estorban a las dos.
  //
  // De las Hojas de Ruta hace falta algo más que el día, porque a los
  // infoproductos solo les quitan media jornada: se guarda también en qué
  // mitad caen y cuándo empiezan, para el caso del borde.
  const diasConHojaDeRuta = new Set<string>();
  const hojasDeRuta: Array<{ dia: string; inicio: number; esManana: boolean }> = [];
  const ventanas: Array<{ desde: number; hasta: number }> = [];

  // Topes de cantidad: esos sí cuentan solo las del tipo que se calcula. Se
  // cuentan TODAS las reservas que se pasen, también las anteriores al rango
  // visible: el tope semanal de una semana a caballo depende de ellas.
  const porDia = new Map<string, number>();
  const porSemana = new Map<string, number>();

  for (const reserva of reservados) {
    const instante = new Date(reserva.hueco);
    if (Number.isNaN(instante.getTime())) continue;
    const dia = diaMadrid(instante);

    if (reserva.tipo === "hoja-de-ruta") {
      diasConHojaDeRuta.add(dia);
      hojasDeRuta.push({
        dia,
        inicio: instante.getTime(),
        esManana: horaMadrid(instante) < CORTE_MEDIODIA,
      });
    } else {
      ventanas.push({
        desde: instante.getTime() - VENTANA_INFOPRODUCTOS.antesMin * 60_000,
        hasta: instante.getTime() + VENTANA_INFOPRODUCTOS.despuesMin * 60_000,
      });
    }

    if (reserva.tipo !== tipo) continue;
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    const lunes = lunesDe(dia);
    porSemana.set(lunes, (porSemana.get(lunes) ?? 0) + 1);
  }

  const bloqueosPorDia = agruparBloqueos(bloqueos);
  const agenda: EstadoDia[] = [];

  for (let dia = primerDia; dia <= ultimoDia; dia = sumarDias(dia, 1)) {
    const bloqueadoEntero = bloqueosPorDia.get(dia)?.diaEntero ?? false;
    const franjas = bloqueosPorDia.get(dia)?.franjas ?? [];

    // Una Hoja de Ruta se lleva su día entero para OTRA Hoja de Ruta. Para
    // los infoproductos no cierra el día: solo su mitad, y eso se mira franja
    // a franja más abajo.
    if (tipo === "hoja-de-ruta" && diasConHojaDeRuta.has(dia)) {
      agenda.push({ dia, huecos: [], motivo: "reservado" });
      continue;
    }
    if ((porDia.get(dia) ?? 0) >= reglas.maxPorDia) {
      agenda.push({ dia, huecos: [], motivo: "reservado" });
      continue;
    }
    if (bloqueadoEntero) {
      agenda.push({ dia, huecos: [], motivo: "bloqueado" });
      continue;
    }
    if (reglas.maxPorSemana !== null && (porSemana.get(lunesDe(dia)) ?? 0) >= reglas.maxPorSemana) {
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
      // Ventana de un infoproducto ya reservado. No hace falta comprobar
      // aparte que el instante exacto esté cogido: la ventana de una reserva
      // siempre contiene su propia hora.
      if (ventanas.some((v) => instante.getTime() >= v.desde && instante.getTime() < v.hasta)) continue;
      // Media jornada que se lleva una Hoja de Ruta de ese día. Solo afecta a
      // los infoproductos: para otra Hoja de Ruta el día ya se ha cerrado
      // entero más arriba.
      if (tipo === "infoproductos" && tapadoPorHojaDeRuta(hojasDeRuta, dia, m, instante.getTime())) continue;
      if (franjas.some((f) => m >= f.desde && m < f.hasta)) continue;
      huecos.push({ valor: iso, etiqueta: formatearHueco(iso) });
    }

    agenda.push({ dia, huecos, motivo: huecos.length ? null : "sin-margen" });
  }

  return agenda;
}

/** Solo los huecos ofrecibles, en plano, para el selector del lead. */
export function huecosDisponibles(args: ArgsAgenda): HuecoDisponible[] {
  return calcularAgenda(args).flatMap((d) => d.huecos);
}

/**
 * ¿Es una hora válida de la rejilla (día correcto, entre las 9:00 y las 20:00,
 * en punto o y media)?
 *
 * La rejilla es la misma para los dos tipos de cita: lo que cambia entre
 * ellos es cuánta agenda ocupan después, no a qué horas empiezan.
 *
 * Esto es lo único que se le exige a un hueco puesto desde el panel: la
 * antelación mínima y el horizonte son reglas para el lead, no para Alain,
 * que puede mover una llamada a mañana si le hace falta. Los topes y los
 * cruces los siguen imponiendo los índices y el trigger de la base de datos.
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
export function esHuecoOfrecido(hueco: string, args: ArgsAgenda): boolean {
  const objetivo = new Date(hueco).getTime();
  if (Number.isNaN(objetivo)) return false;
  return huecosDisponibles(args).some((h) => new Date(h.valor).getTime() === objetivo);
}
