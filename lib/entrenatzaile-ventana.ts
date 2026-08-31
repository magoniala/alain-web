// Ventana de acceso gratuito a la Hoja de Ruta: un único sitio para el
// cálculo de los 8 días.
//
// Antes esto se resolvía en dos sitios que no se hablaban: la landing miraba
// si la URL traía "?ventana=1" (o sea, no comprobaba nada) y el endpoint
// calculaba la elegibilidad de verdad para el aviso interno. Podían decir
// cosas distintas sobre la misma persona. Ahora los dos preguntan aquí, y si
// algún día VENTANA_DIAS deja de ser 8, cambia en un solo lugar.
//
// SERVIDOR. No importar desde un componente de cliente: abajo se crea un
// cliente de Supabase con la service key.

import { createClient } from "@supabase/supabase-js";
import { VENTANA_DIAS, type Elegibilidad } from "./entrenatzaile-formularios";
import { diaMadrid, sumarDias } from "./entrenatzaile-huecos";

export interface Ventana {
  elegibilidad: Elegibilidad;
  dias_desde_alta: number | null;
  fecha_alta_contacto: string | null;
  /** Día de su ventana: 1 = el día del alta … 8 = el último. */
  ventana_dia: number | null;
  /** Último día en que sigue siendo gratis (YYYY-MM-DD en Madrid). */
  ultimo_dia: string | null;
}

const FUERA_DE_LISTA: Ventana = {
  elegibilidad: "no_en_lista",
  dias_desde_alta: null,
  fecha_alta_contacto: null,
  ventana_dia: null,
  ultimo_dia: null,
};

function aUTC(dia: string): number {
  const [anio, mes, d] = dia.split("-").map(Number);
  return Date.UTC(anio, mes - 1, d);
}

/** Días naturales completos entre dos fechas YYYY-MM-DD. */
function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUTC(hasta) - aUTC(desde)) / 86_400_000);
}

/**
 * Estado de la ventana de un contacto a partir de su fecha de alta.
 *
 * Se cuenta por DÍAS NATURALES de Madrid, no por bloques de 24 horas desde
 * la hora exacta del alta. Es la única forma de que la promesa que se le
 * escribe en la página ("gratis hasta el domingo 6 a las 23:59") sea
 * literalmente cierta: contando en bloques de 24 h, quien se apuntó a las
 * 18:00 dejaría de tener derecho a las 18:00 del último día, seis horas
 * antes de lo prometido, y le saldría "NO GRATIS" en el aviso después de
 * haber leído que le tocaba gratis.
 *
 * El día del alta cuenta como el día 1, así que el último día de una ventana
 * de 8 es el día del alta + 7, y termina a las 23:59:59 de Madrid.
 */
export function calcularVentana(fechaAlta: string | null | undefined, ahora: Date = new Date()): Ventana {
  if (!fechaAlta) return FUERA_DE_LISTA;
  const alta = new Date(fechaAlta);
  if (Number.isNaN(alta.getTime())) return FUERA_DE_LISTA;

  const diaAlta = diaMadrid(alta);
  const dias = diasEntre(diaAlta, diaMadrid(ahora));
  const dentro = dias >= 0 && dias < VENTANA_DIAS;

  return {
    elegibilidad: dentro ? "elegible" : "fuera_ventana",
    dias_desde_alta: dias,
    fecha_alta_contacto: fechaAlta,
    ventana_dia: dentro ? dias + 1 : null,
    ultimo_dia: sumarDias(diaAlta, VENTANA_DIAS - 1),
  };
}

/**
 * "2026-09-06" -> "domingo 6 de septiembre".
 *
 * Mismo formato que el marcador {{fecha_N}} de los correos, a propósito: el
 * lead ve la misma fecha escrita igual en el correo que en la página.
 */
export function etiquetaFechaVentana(dia: string): string {
  // Mediodía UTC y formateo en UTC: construido así, ningún huso puede
  // correr la fecha un día arriba o abajo al imprimirla.
  const [anio, mes, d] = dia.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, d, 12));
  const semana = fecha.toLocaleDateString("es-ES", { weekday: "long", timeZone: "UTC" });
  const resto = fecha.toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "UTC" });
  return `${semana} ${resto}`;
}

/**
 * Marcador {{fin_ventana}} para los correos: el último día en que esa
 * persona la tiene gratis, escrito igual que en la landing.
 *
 * Existe para que el correo y la página no puedan decir cosas distintas. La
 * alternativa —contar los días en el propio texto con {{fecha_7}}, {{fecha_6}}…—
 * da la fecha correcta solo si la secuencia va exactamente al día: sale de
 * "hoy + N", no de la fecha de alta de esa persona. En cuanto un envío se
 * retrasa (Mailjet caído, un reintento del cron al día siguiente), el correo
 * promete una fecha en la que la landing ya cobra.
 *
 * Si no se puede calcular, se devuelve vacío a propósito: sustituirMarcadores
 * deja entonces el {{fin_ventana}} a la vista, que es preferible a que
 * desaparezca en silencio y nadie note que faltaba la fecha.
 */
export function marcadoresDeVentana(fechaAlta: string | null | undefined): Record<string, string> {
  const { ultimo_dia } = calcularVentana(fechaAlta);
  return ultimo_dia ? { fin_ventana: etiquetaFechaVentana(ultimo_dia) } : {};
}

// ============================================================
// Enlaces personalizados en los correos de la secuencia
// ============================================================

/**
 * Correos que NUNCA deben llevar a la versión gratuita, por posición.
 *
 *   8  = "Ya no hay prisa"  — dice expresamente que ya cuesta 90 €
 *  -2  = "Ya estabas aquí"  — mail de cortesía, mismo caso
 *
 * Mandarlos a la gratuita se contradiría con lo que acaban de leer.
 */
export const POSICIONES_SIN_VENTANA: ReadonlySet<number> = new Set([8, -2]);

// Enlaces a /hoja-de-ruta dentro del cuerpo del correo. El (?![\w/-]) es lo
// que deja fuera a /hoja-de-ruta/capacidades, que es de pago y no lleva
// token: sin él, esa página recibiría un ?ventana=1 que no sabe atender.
const RE_ENLACE_HOJA_RUTA = /https?:\/\/[^\s"'<>)]*\/hoja-de-ruta(?![\w/-])[^\s"'<>)]*/g;

/**
 * Añade `ventana=1&t=<token>` a los enlaces a /hoja-de-ruta de un correo.
 *
 * Se hace aquí, al enviar, y no escribiendo el enlace a mano en el panel:
 * así vale para los correos que ya existen y para los que Alain escriba
 * mañana, sin que haya que acordarse de nada. Los UTM que ya lleve el
 * enlace se conservan tal cual.
 *
 * IMPORTANTE: solo se llama cuando el contacto está DENTRO de su ventana. A
 * quien está fuera se le deja el enlace limpio y aterriza en la versión de
 * pago, que es la que le corresponde. Mandarle un ?ventana=1 que la propia
 * página va a rechazar sería prometerle algo y quitárselo en la misma
 * pantalla.
 */
export function personalizarEnlacesHojaDeRuta(html: string, token: string): string {
  if (!token) return html;
  return html.replace(RE_ENLACE_HOJA_RUTA, (bruto) => {
    try {
      const url = new URL(bruto);
      if (url.searchParams.has("t")) return bruto; // ya venía personalizado
      url.searchParams.set("ventana", "1");
      url.searchParams.set("t", token);
      return url.toString();
    } catch {
      // Si no es una URL que sepamos parsear, se deja como estaba: un enlace
      // sin token lleva a la versión de pago, que es el lado seguro.
      return bruto;
    }
  });
}

// ============================================================
// Resolución del token en la landing
// ============================================================

export interface ContactoDeToken {
  id: string;
  email: string;
  ventana: Ventana;
}

// Perezoso a propósito: creado al importar, un despliegue sin las variables
// de Supabase reventaría la página entera al cargar el módulo, en vez de
// fallar solo esta consulta.
let cliente: ReturnType<typeof createClient> | null = null;
function supabase() {
  if (!cliente) {
    cliente = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  }
  return cliente;
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Busca el contacto de un token y calcula su ventana.
 *
 * Devuelve null ante cualquier duda: token ausente, con formato raro, que no
 * existe, o un error de base de datos. Quien llama pinta entonces la versión
 * de pago. Nunca al revés — un fallo nuestro no puede acabar regalando el
 * servicio, y tampoco puede sacar un error en la cara del lead.
 */
export async function contactoDeToken(token: string | null | undefined): Promise<ContactoDeToken | null> {
  if (!token || !RE_UUID.test(token)) return null;

  const { data, error } = await supabase()
    .from("newsletter_contactos")
    .select("id, email, fecha_alta")
    .eq("token", token)
    .maybeSingle<{ id: string; email: string; fecha_alta: string | null }>();

  if (error) {
    console.error("hoja-de-ruta: error resolviendo el token de ventana:", error);
    return null;
  }
  if (!data) return null;

  return { id: data.id, email: data.email, ventana: calcularVentana(data.fecha_alta) };
}
