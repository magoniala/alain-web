// Plantillas del guion «Leads · Hoja de Ruta reservada» (vault: Vías/Entrenatzaile/Guiones/)
// con las variables ya rellenas: nombre, día y hora de la llamada y las líneas condicionales
// («me falta el PAR-Q+ / el peso en ayunas», solo si falta).
//
// El servidor no puede leer el vault, así que el texto vive aquí. FUENTE: el guion. Si Alain
// cambia un mensaje en el guion, hay que cambiarlo también aquí (un solo sitio: este fichero).
// Funciones puras, sin acceso a base de datos: se pueden probar con `npx tsx`.

const ZONA = "Europe/Madrid";

export type PasoReserva = "hr_preparacion" | "hr_confirmacion" | "hr_no_aparece" | "hr_cierre";

export const PARQ_URL = "entrenatzaile.alainzulaika.com/par-q+";

const iso = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: ZONA }).format(d);
export const sumarDias = (isoDia: string, dias: number) => {
  const d = new Date(`${isoDia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

export interface Llamada {
  /** Instante de la llamada. */
  fecha: Date;
  /** Día en Madrid, AAAA-MM-DD. */
  dia: string;
  /** «lunes 30». */
  diaTexto: string;
  /** «19:00». */
  hora: string;
  /** «lunes 30 a las 19:00». */
  cuando: string;
}

export function llamadaDe(huecoIso: string): Llamada | null {
  const fecha = new Date(huecoIso);
  if (Number.isNaN(fecha.getTime())) return null;
  const diaTexto = fecha.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", timeZone: ZONA }).replace(",", "");
  const hora = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: ZONA });
  return { fecha, dia: iso(fecha), diaTexto, hora, cuando: `${diaTexto} a las ${hora}` };
}

/** «lunes 30 a las 19:00», «mañana a las 19:00» o «hoy a las 19:00» según cuándo se envíe. */
export function cuandoRelativo(l: Llamada, hoy: string): string {
  if (l.dia === hoy) return `hoy a las ${l.hora}`;
  if (l.dia === sumarDias(hoy, 1)) return `mañana a las ${l.hora}`;
  return l.cuando;
}

export interface Faltas {
  parq: boolean;
  peso: boolean;
}

const listaFaltas = (f: Faltas): string => [f.parq ? `el cuestionario (${PARQ_URL})` : "", f.peso ? "el peso en ayunas" : ""].filter(Boolean).join(" y ");

const nombrePila = (n: string) => (n.trim().split(/\s+/)[0] || n).replace(/^./, (c) => c.toUpperCase());

/** Mensaje 2 · 2-3 días antes · preparación. */
export function mensajePreparacion(nombre: string, l: Llamada, falta: Faltas): string {
  const linea = falta.parq || falta.peso ? `\n\nY me falta ${listaFaltas(falta)}, cuando puedas.` : "";
  return `Hola ${nombrePila(nombre)}, el ${l.diaTexto} a las ${l.hora} tenemos la videollamada. Para que podamos hacer las pruebas, ten preparado:

· Ropa cómoda de deporte.
· Un sitio despejado, con 2-3 metros libres a tu alrededor.
· Una silla firme, sin brazos.
· Una cinta métrica (la de costura vale).
· Una escoba o un palo largo.
· Si tienes gomas o un TRX, a mano.

Haremos la llamada desde tu móvil, así que tenlo cargado. Busca un sitio donde apoyarlo en horizontal, a la altura de la cadera y a 2-3 metros de ti: el respaldo de una silla o una mesa valen.${linea}`;
}

/** Mensaje 3 · 24 h antes · el corte. `hoy` decide si dice «mañana» o el día. */
export function mensajeConfirmacion(nombre: string, l: Llamada, falta: Faltas, hoy: string): string {
  const n = nombrePila(nombre);
  const cuando = cuandoRelativo(l, hoy);
  let medio = "";
  if (falta.parq) {
    medio = `\n\nMe falta ${listaFaltas(falta)}. Si mañana no está, hacemos la llamada igual, pero solo hablando: sin el cuestionario no te puedo pedir que te muevas delante de la cámara, y ahí se queda la mitad de lo útil.`;
  } else if (falta.peso) {
    medio = `\n\nMe falta el peso en ayunas: mándamelo mañana por la mañana por aquí.`;
  }
  return `${n}, ${cuando}. ¿Me lo confirmas?${medio}\n\nHago cinco Hojas de Ruta a la semana, así que si no te encaja el día, mejor me lo dices hoy y lo movemos.`;
}

/** Mensaje 4 · no aparece (+10 min). */
export function mensajeNoAparece(nombre: string): string {
  return `${nombrePila(nombre)}, te he esperado en la llamada. Igual te ha surgido algo.\n\nSi quieres buscamos otro hueco: dime qué día te viene bien y te digo lo que me queda libre.`;
}

/** Mensaje 5 · cierre tras el segundo fallo. */
export function mensajeCierre(nombre: string): string {
  return `${nombrePila(nombre)}, lo dejo aquí por mi parte, que no quiero agobiarte. Cuando te venga bien retomarlo, me escribes y buscamos hueco.`;
}

/**
 * Qué toca ahora según la fecha de la llamada. Reglas del guion:
 *  · Mensaje 2 desde 3 días antes, y como tarde la víspera (si reservó con menos margen, en cuanto se vea).
 *  · Mensaje 3 desde 24 h antes de la llamada (el corte).
 * `enviados` = pasos que ya constan como enviados (checklist de la ficha, Registro o tarjeta enviada).
 */
export function pasoQueToca(l: Llamada, ahora: Date, enviados: { m2: boolean; m3: boolean }): { paso: PasoReserva; motivo: string } | null {
  const hoy = iso(ahora);
  if (ahora.getTime() >= l.fecha.getTime()) return null;
  const desde24h = ahora.getTime() >= l.fecha.getTime() - 24 * 3600 * 1000;
  if (!enviados.m3 && desde24h) {
    // Si el 2 no salió y ya estamos en el corte, primero el 2 (no se salta nunca; Alain puede descartarlo).
    if (!enviados.m2) return { paso: "hr_preparacion", motivo: "Preparación: no consta enviada y ya es la víspera (como tarde, hoy)." };
    return { paso: "hr_confirmacion", motivo: "Confirmación a 24 h de la llamada (el corte)." };
  }
  if (!enviados.m2 && hoy >= sumarDias(l.dia, -3)) return { paso: "hr_preparacion", motivo: "Preparación: desde 3 días antes de la llamada." };
  return null;
}

/** Fecha de la ficha tras enviar cada paso, y qué queda como próxima acción. */
export function siguienteTrasPaso(paso: PasoReserva, l: Llamada): { proxima_accion: string; fecha_proxima_accion: string } {
  if (paso === "hr_preparacion") {
    return { proxima_accion: `Mensaje 3 de confirmación a 24 h (llamada ${l.cuando}); revisar PAR-Q+ y peso`, fecha_proxima_accion: sumarDias(l.dia, -1) };
  }
  return { proxima_accion: `Revisar el PAR-Q+ y mandar el enlace de la videollamada 10 min antes (${l.cuando})`, fecha_proxima_accion: l.dia };
}

export const ETIQUETA_PASO: Record<PasoReserva, string> = {
  hr_preparacion: "Mensaje 2 (preparación)",
  hr_confirmacion: "Mensaje 3 (confirmación 24 h)",
  hr_no_aparece: "Mensaje 4 (no aparece)",
  hr_cierre: "Mensaje 5 (cierre)",
};

/** ¿Consta un paso como enviado en el texto de la ficha (checklist marcado o línea del Registro)? */
export function pasoEnviadoEnTexto(texto: string, n: 2 | 3): boolean {
  const marcado = new RegExp(`^\\s*-\\s*\\[x\\]\\s*Mensaje\\s*${n}\\b`, "im").test(texto);
  const registro = new RegExp(`Mensaje\\s*${n}\\b[^\\n]{0,80}\\b(ENVIADO|enviado)\\b`, "i").test(texto);
  return marcado || registro;
}
