// Reglas del protocolo de eventos de magia (00 Protocolo de eventos del vault),
// escritas como datos. Aprobadas por Alain el 23-11-2026.
//
// Cada paso tiene fecha ideal y fecha límite. Ningún paso bloquea a otro: cada
// uno sale por su fecha. Los mensajes al cliente van a la Bandeja de Magia; lo
// interno (guion, material, ensayo, maleta…) va a la nota diaria y, si llega
// el límite sin marcar, avisa al móvil.
//
// Cambiar una fecha = cambiar este fichero. El cron recalcula los pasos
// pendientes de todos los eventos futuros en cada pasada.
//
// La correspondencia paso ↔ campo del frontmatter del vault (CLAVE_VAULT) está
// duplicada en scripts/crm/espejo-eventos.mjs: si se cambia aquí, cambiarla allí.

export type ClavePaso =
  | "mensaje_1"
  | "cartel"
  | "pago_80"
  | "guion"
  | "material"
  | "compartido"
  | "mensaje_7dias"
  | "ensayo"
  | "mensaje_vispera"
  | "maleta"
  | "post";

export type EstadoPaso = "pendiente" | "hecho" | "no_aplica";

export interface EventoBase {
  id: string;
  nombre: string;
  fecha_evento: string;
  estado_evento: string;
  tipo: "show" | "recurrente";
  fecha_cierre: string | null;
  frontmatter: Record<string, unknown>;
}

export interface PasoCalculado {
  clave: ClavePaso;
  tipo: "mensaje" | "interno";
  titulo: string;
  fecha_ideal: string;
  fecha_limite: string;
}

/** Campo del frontmatter del vault que refleja cada paso. */
export const CLAVE_VAULT: Record<ClavePaso, string> = {
  mensaje_1: "rider_enviado",
  cartel: "cartel_enviado",
  pago_80: "pago_resto",
  mensaje_7dias: "mensaje_7dias",
  mensaje_vispera: "mensaje_vispera",
  guion: "prep_guion",
  material: "prep_material",
  compartido: "prep_compartido",
  ensayo: "prep_ensayo",
  maleta: "prep_maleta",
  post: "prep_post",
};

export const ORDEN: ClavePaso[] = ["mensaje_1", "cartel", "pago_80", "guion", "material", "compartido", "mensaje_7dias", "ensayo", "mensaje_vispera", "maleta", "post"];

const DIA = 86400000;
export const sumar = (iso: string, n: number) => new Date(Date.parse(iso + "T12:00:00Z") + n * DIA).toISOString().slice(0, 10);
export const diasEntre = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / DIA);
const max = (a: string, b: string) => (a > b ? a : b);
const min = (a: string, b: string) => (a < b ? a : b);
export const hoyMadrid = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
export const horaMadrid = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(new Date()));

export const cancelado = (estado: string | null | undefined) => /cancel|anul|aplaz|suspend/i.test(estado ?? "");
/** Sesiones recurrentes (« · Sesión NN», como Eguzkilore): solo guion y maleta (decisión de Alain, 23-11-2026). */
export const esRecurrente = (nombre: string) => /·\s*Sesi[oó]n/i.test(nombre);
const conReserva = (viaPago: unknown) => /reserva/i.test(String(viaPago ?? "")) && !/sin reserva/i.test(String(viaPago ?? ""));

/** Valor del frontmatter → estado del paso. Vacío = pendiente; "-" = no aplica; cualquier otra cosa (sí, true, fecha) = hecho. */
export function estadoDeValor(v: unknown): { estado: EstadoPaso; fecha: string | null } {
  const s = String(v ?? "").trim().replace(/^["']|["']$/g, "");
  if (!s || /^(false|null|~)$/i.test(s)) return { estado: "pendiente", fecha: null };
  if (/^(-|—|n\/a|no aplica)$/i.test(s)) return { estado: "no_aplica", fecha: null };
  return { estado: "hecho", fecha: /^\d{4}-\d{2}-\d{2}/.exec(s)?.[0] ?? null };
}

/**
 * Los pasos que le tocan a un evento, con sus fechas.
 * `otros`: el resto de eventos (para «material compartido»). `hoy`: fecha de referencia
 * para los eventos que se cerraron sin fecha de cierre (importados del vault).
 */
export function pasosDelEvento(ev: EventoBase, otros: { id: string; nombre: string; fecha_evento: string; estado_evento: string }[], hoy: string): PasoCalculado[] {
  const f = ev.fecha_evento;
  const cierre = ev.fecha_cierre ?? hoy;
  const d = (n: number) => sumar(f, n);
  const lista: PasoCalculado[] = [];
  const poner = (clave: ClavePaso, tipo: "mensaje" | "interno", titulo: string, ideal: string, limite: string) => {
    // Un evento cerrado con poco margen: el paso sale el día del cierre, nunca se pierde.
    const i = max(ideal, min(cierre, f));
    lista.push({ clave, tipo, titulo, fecha_ideal: i, fecha_limite: max(limite, i) });
  };

  if (ev.tipo === "recurrente" || esRecurrente(ev.nombre)) {
    poner("guion", "interno", "Revisar guion y decidir adaptaciones", d(-14), d(-10));
    poner("maleta", "interno", "Maleta hecha y en el coche", d(-1), d(-1));
    return lista;
  }

  poner("mensaje_1", "mensaje", "Mensaje 1 · datos de facturación y lo que necesito del sitio", cierre, sumar(cierre, 1));
  poner("cartel", "mensaje", "Mensaje 2 · cartel y texto promocional", sumar(cierre, 1), max(sumar(cierre, 1), min(sumar(cierre, 7), d(-10))));
  if (conReserva(ev.frontmatter?.via_pago)) poner("pago_80", "mensaje", "Mensaje 3 · resto del pago (80 %)", d(-25), d(-20));
  poner("guion", "interno", "Revisar guion y decidir adaptaciones", d(-14), d(-10));
  poner("material", "interno", "Revisar material contra el guion y comprar lo que falte", d(-12), d(-10));
  const cerca = otros.filter((o) => o.id !== ev.id && !cancelado(o.estado_evento) && Math.abs(diasEntre(f, o.fecha_evento)) <= 7);
  if (cerca.length) {
    const quien = cerca.map((o) => `${o.nombre.replace(/^\d{4}-\d{2}-\d{2}\s+/, "").split(/\s+[—·-]\s+/)[0]} (${o.fecha_evento.slice(8, 10)}-${o.fecha_evento.slice(5, 7)})`).join(", ");
    poner("compartido", "interno", `Comprobar que no comparte material con ${quien}`, d(-7), d(-5));
  }
  poner("mensaje_7dias", "mensaje", "Mensaje 4 · ubicación exacta y contacto del responsable (7 días)", d(-10), d(-7));
  poner("ensayo", "interno", "Ensayar el show entero, con orden y transiciones", d(-3), d(-2));
  poner("mensaje_vispera", "mensaje", "Mensaje 5 · víspera", d(-1), d(-1));
  poner("maleta", "interno", "Maleta hecha y en el coche · ropa · tarjetas de testimonio · ruta y hora de salida", d(-1), d(-1));
  poner("post", "interno", "Rellenar el post-evento de la ficha en caliente", f, d(1));
  return lista;
}

// --- mensajes ----------------------------------------------------------------------

const DIAS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const fechaLarga = (iso: string) => {
  const d = new Date(iso + "T12:00:00Z");
  return `${DIAS_ES[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES_ES[d.getUTCMonth()]}`;
};
export const fechaCorta = (iso: string) => {
  const d = new Date(iso + "T12:00:00Z");
  return `${DIAS_ES[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()}-${MESES_ES[d.getUTCMonth()].slice(0, 3)}`;
};

/** Hora de inicio ("13:00-14:00" → "13:00") y la de llegada, dos horas antes. */
function horas(hora: unknown): { inicio: string | null; llegada: string | null } {
  const m = /(\d{1,2})[:.h](\d{2})?/.exec(String(hora ?? ""));
  if (!m) return { inicio: null, llegada: null };
  const h = Number(m[1]);
  const mi = m[2] ?? "00";
  return { inicio: `${h}:${mi}`, llegada: `${(h + 22) % 24}:${mi}` };
}

/**
 * Borrador del mensaje de un paso, en castellano, con las plantillas del protocolo.
 * Devuelve también lo que hay que avisar a Alain (adjuntos, datos que faltan).
 */
export function borradorPaso(clave: ClavePaso, ev: EventoBase, contacto: string, limite: string): { texto: string; nota: string } | null {
  const fm = ev.frontmatter ?? {};
  const nombre = contacto || "";
  const show = String(fm.show_base ?? "").trim() || "el show";
  const sitio = String(fm.lugar ?? "").trim();
  const { inicio, llegada } = horas(fm.hora);
  const faltan: string[] = [];
  if (!inicio) faltan.push("la hora");
  if (!sitio && (clave === "mensaje_1")) faltan.push("el lugar");
  const aviso = faltan.length ? ` Falta ${faltan.join(" y ")} en el evento: complétalo en el texto.` : "";
  switch (clave) {
    case "mensaje_1":
      return {
        texto: `Perfecto${nombre ? `, ${nombre}` : ""}. Queda cerrado: ${show} el ${fechaLarga(ev.fecha_evento)}${inicio ? ` a las ${inicio}` : " a las [hora]"}${sitio ? ` en ${sitio}` : " en [sitio]"}.\n\nTres cosas y te dejo tranquilo:\n\n1. Datos de facturación: nombre fiscal, NIF y dirección. Si factura un ayuntamiento, dime también si hace falta número de expediente o algún portal concreto.\n\n2. Un recordatorio de lo que necesito del sitio, que ya iba en el presupuesto: [mesa / toma de corriente / sonido / iluminación / sitio para dejar las cosas]. Te lo repito aquí solo para que no se nos pase a ninguno de los dos.\n\n3. El cartel y el texto para difundir van incluidos. Te los mando [hoy / mañana].`,
        nota: `Ajusta el punto 2 (lo que necesitas del sitio) y quita el 3 si este evento no lleva cartel. Si ya tienes sus datos fiscales, quita el 1.${aviso}`,
      };
    case "cartel":
      return {
        texto: `Aquí tienes el cartel y el texto para difundir. Úsalos como quieras, y si necesitas otro tamaño o algún cambio, me dices.\n\nCon esto ya tenemos todo. Te escribo la semana del evento para cerrar los últimos detalles, así que hasta entonces no tienes que hacer nada.`,
        nota: "Adjunta el cartel y el texto promocional al mandarlo. Si este evento no lleva cartel, márcalo como «No aplica» en Eventos.",
      };
    case "pago_80":
      return {
        texto: `Te paso ya la factura, así podéis hacer el resto del pago cuando os venga bien.\n\nLa fecha límite para completarlo y dejar el evento confirmado es el ${fechaLarga(limite)}.`,
        nota: "Adjunta la factura (o la proforma) del 80 %.",
      };
    case "mensaje_7dias":
      return {
        texto: `Hola${nombre ? ` ${nombre}` : ""}, ya tenemos el show a la vuelta de la esquina.\n\nDos cosas para cerrarlo:\n\n1. La ubicación exacta de dónde se hace.\n2. El teléfono de quien vaya a estar allí como responsable, para poder contactar por cualquier cosa: dónde aparcar, por dónde entrar el material o ver la sala.\n\nYo llego dos horas antes, a las ${llegada ?? "[hora]"}, para montar y probarlo todo con calma.`,
        nota: `Si ya tienes la ubicación exacta o el contacto del responsable, quita esa parte.${aviso}`,
      };
    case "mensaje_vispera":
      return {
        texto: `${nombre || "Hola"}, mañana a las ${inicio ?? "[hora]"}. Yo llego a las ${llegada ?? "[hora]"} para montar.\n\n¿Todo sigue igual por vuestra parte?`,
        nota: aviso.trim(),
      };
    default:
      return null;
  }
}
