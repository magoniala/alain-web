import { createClient } from "@supabase/supabase-js";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import {
  cuerpoDelMail,
  marcadoresDeFecha,
  marcadoresDeNombre,
  sustituirMarcadores,
} from "@/lib/email-markdown";
import {
  POSICIONES_SIN_VENTANA,
  calcularVentana,
  marcadoresDeVentana,
  personalizarEnlacesHojaDeRuta,
} from "@/lib/entrenatzaile-ventana";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://alainzulaika.com";

export function wrapNurture(cuerpoHtml: string, email: string, isEu: boolean) {
  const bajaUrl = `${BASE_URL}/api/newsletter/baja?email=${encodeURIComponent(email)}`;
  const idiomaUrl = `${BASE_URL}/newsletter/idioma?email=${encodeURIComponent(email)}`;
  const bajaText = isEu ? "Utzi email hauek jasotzeari" : "Dejar de recibir estos emails";
  const idiomaText = isEu ? "Hizkuntza aldatu" : "Cambiar idioma";
  const contactEmail = isEu ? "info@alainzulaika.com" : "contacto@alainzulaika.com";
  return `
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
      <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">${cuerpoHtml}</div>
      <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.9rem;color:#555;line-height:2;">
        <p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:${contactEmail}" style="color:#555;">${contactEmail}</a></p>
        <p style="margin:0;"><a href="${idiomaUrl}" style="color:#bbb;">${idiomaText}</a> · <a href="${bajaUrl}" style="color:#bbb;">${bajaText}</a></p>
      </div>
    </div>
  `;
}

export interface NurtureContacto {
  id: string;
  email: string;
  nombre: string | null;
  idioma: string | null;
  posicion_secuencia: number;
  fecha_ultimo_mail_secuencia: string | null;
  // Identificador propio de cada contacto, que viaja en los enlaces a la
  // Hoja de Ruta de sus correos. Lo rellena la base de datos al insertar
  // (DEFAULT gen_random_uuid()), así que vale para todas las puertas de
  // entrada sin que ninguna tenga que acordarse de generarlo.
  token: string | null;
  // Punto de partida de la ventana de 8 días.
  fecha_alta: string | null;
}

// Gmail (y su alias googlemail.com) ignora los puntos en la parte local y
// trata cualquier "+lo-que-sea" como el mismo buzón. Normalizamos para que
// la deduplicación por email detecte de verdad que es la misma persona,
// aunque rellene el formulario con variantes distintas de su dirección.
export function normalizarEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const [local, dominio] = trimmed.split("@");
  if (dominio !== "gmail.com" && dominio !== "googlemail.com") return trimmed;
  const sinTag = local.split("+")[0];
  const sinPuntos = sinTag.replace(/\./g, "");
  return `${sinPuntos}@gmail.com`;
}

// Exportado porque el cron carga los mismos contactos por su cuenta: con la
// lista repetida a mano, añadir una columna aquí dejaba al cron enviando sin
// ella y sin dar ningún error.
export const CAMPOS_CONTACTO =
  "id, email, nombre, idioma, posicion_secuencia, fecha_ultimo_mail_secuencia, token, fecha_alta";

export interface AltaSecuenciaInput {
  email: string;
  origen: string;
  nombre?: string | null;
  idioma?: string;
  tags?: string[];
  edad?: number | null;
  telefono?: string | null;
  // Casilla de newsletter del formulario. Si no está marcada, el lead se
  // guarda igual pero con recibe_secuencia=false: el cron lo ignora y no
  // recibe ni el M0 ni el resto de la secuencia.
  recibeSecuencia: boolean;
}

export interface AltaSecuenciaResultado {
  estado: "nuevo" | "reactivado" | "existente" | "error";
  contactoId: string | null;
  // Token de ventana de este contacto, exista ya o se acabe de crear. Lo
  // devolvemos siempre (también cuando `contacto` va a null por estar ya en
  // la lista) para que quien llame pueda montar su enlace a la Hoja de Ruta
  // sin volver a consultar la tabla. Quién ve la versión gratuita lo sigue
  // decidiendo la landing a partir de la fecha de alta, no esto.
  token: string | null;
  // Su fecha de alta, por el mismo motivo: quien llama puede necesitar saber
  // si sigue dentro de la ventana sin volver a consultar la tabla.
  fecha_alta: string | null;
  // Solo viene relleno cuando procede disparar el M0 (alta nueva o
  // reactivación con la casilla marcada). Si ya estaba en la lista, va null:
  // no se le reinicia la secuencia por rellenar otro formulario.
  contacto: NurtureContacto | null;
  error?: string;
}

// Da de alta en newsletter_contactos a alguien que entra desde una landing
// propia (no desde Meta Ads, que tiene su camino en /api/leads/entrada con
// su deduplicación por leadgen_id). Misma tabla, mismas columnas y misma
// secuencia: lo único distinto es la puerta de entrada y el `origen`.
export async function altaEnSecuencia({
  email,
  origen,
  nombre = null,
  idioma = "es",
  tags = [],
  edad = null,
  telefono = null,
  recibeSecuencia,
}: AltaSecuenciaInput): Promise<AltaSecuenciaResultado> {
  const emailLower = normalizarEmail(email);
  const tagsNuevas = tags.map((t) => t.toLowerCase());

  const seleccionar = () =>
    supabase
      .from("newsletter_contactos")
      .select(`${CAMPOS_CONTACTO}, tags, telefono, edad, unsubscribed`)
      .eq("email", emailLower)
      .maybeSingle();

  const fusionar = async (fila: {
    id: string;
    tags: string[] | null;
    telefono: string | null;
    edad: number | null;
    unsubscribed: boolean;
    token: string | null;
    fecha_alta: string | null;
  }): Promise<AltaSecuenciaResultado> => {
    const tagsFusionadas = Array.from(
      new Set([...(fila.tags ?? []).map((t) => t.toLowerCase()), ...tagsNuevas])
    );
    // Datos que antes no teníamos: se rellenan, nunca se pisan los que ya había.
    const completar = {
      tags: tagsFusionadas,
      telefono: fila.telefono ?? telefono,
      edad: fila.edad ?? edad,
    };

    if (fila.unsubscribed && recibeSecuencia) {
      // Estaba dado de baja y vuelve a apuntarse: se le devuelve a la
      // newsletter, pero NO se le reinicia la secuencia de bienvenida.
      //
      // Se hacía antes y estaba mal por dos motivos. Uno: le volvían a caer
      // diez correos que probablemente ya leyó. Y dos, el importante: esa
      // secuencia le promete la Hoja de Ruta gratis durante 8 días, y su
      // ventana se cuenta desde su fecha de alta original, que no se toca. Si
      // se reiniciara la fecha, bastaría con darse de baja y alta para
      // recuperar el regalo tantas veces como uno quisiera.
      //
      // Quien vuelve recibe, en su lugar, un solo correo con lo que ha venido
      // a buscar (ver enviarMailSuelto), igual que quien ya estaba activo.
      //
      // Ojo: /api/leads/entrada SÍ reinicia la secuencia en su reactivación,
      // y es a propósito — ahí el lead viene de un anuncio pagado y cuenta
      // como alta nueva a todos los efectos.
      const { error } = await supabase
        .from("newsletter_contactos")
        .update({ ...completar, unsubscribed: false, origen })
        .eq("id", fila.id);
      if (error) {
        console.error("altaEnSecuencia: error reactivando", emailLower, error);
        return { estado: "error", contactoId: fila.id, contacto: null, token: fila.token, fecha_alta: fila.fecha_alta, error: error.message };
      }
      return { estado: "reactivado", contactoId: fila.id, contacto: null, token: fila.token, fecha_alta: fila.fecha_alta };
    }

    // Ya estaba en la lista: no le tocamos recibe_secuencia ni la posición.
    // Rellenar otro formulario no debe reiniciarle la secuencia ni volver a
    // mandarle mails que ya recibió.
    const { error } = await supabase.from("newsletter_contactos").update(completar).eq("id", fila.id);
    if (error) {
      console.error("altaEnSecuencia: error fusionando datos", emailLower, error);
      return { estado: "error", contactoId: fila.id, contacto: null, token: fila.token, fecha_alta: fila.fecha_alta, error: error.message };
    }
    return { estado: "existente", contactoId: fila.id, contacto: null, token: fila.token, fecha_alta: fila.fecha_alta };
  };

  const { data: existente } = await seleccionar();
  if (existente) return fusionar(existente);

  const { data: creado, error } = await supabase
    .from("newsletter_contactos")
    .insert({
      email: emailLower,
      nombre,
      idioma,
      origen,
      tags: tagsNuevas,
      edad,
      telefono,
      recibe_secuencia: recibeSecuencia,
      posicion_secuencia: 0,
      secuencia_completada: false,
      unsubscribed: false,
    })
    .select(CAMPOS_CONTACTO)
    .single();

  if (error) {
    if (error.code === "23505") {
      // Carrera: alguien insertó este email entre el select y el insert.
      // Nos comportamos como si hubiera existido desde el principio.
      const { data: carrera } = await seleccionar();
      if (carrera) return fusionar(carrera);
    }
    console.error("altaEnSecuencia: error insertando", emailLower, error);
    return { estado: "error", contactoId: null, contacto: null, token: null, fecha_alta: null, error: error.message };
  }

  return { estado: "nuevo", contactoId: creado.id, contacto: recibeSecuencia ? creado : null, token: creado.token, fecha_alta: creado.fecha_alta };
}

export const CANDADO_STALE_MS = 5 * 60 * 1000; // 5 min: si un intento se quedó a medias (crash), se puede reclamar de nuevo

/**
 * Última posición atada a un día concreto de la ventana.
 *
 * El calendario de la secuencia es exacto: el M0 sale el día del alta y cada
 * uno de los siguientes al día siguiente, así que al mail de la posición N le
 * toca el día N contado desde el alta. El M7 cae en el octavo día, el último,
 * y por eso dice "hoy a las 23:59 deja de ser gratis".
 *
 * Del 8 en adelante ya no hay cuenta atrás y da igual un día más o menos.
 */
export const ULTIMA_POSICION_VENTANA = 7;

/**
 * A qué posición debería ir este contacto hoy.
 *
 * Los correos de la cuenta atrás caducan. Si el cron se cae un día, el M6
 * ("Mañana cierra") saldría el día en que en realidad cierra, y el M7 ("Hoy
 * a las 23:59") cuando ya se ha pasado. Con la fecha corregida seguirían
 * siendo incoherentes: el asunto y media docena de frases dicen "mañana".
 * El problema no es la fecha, es que ese correo ya no sirve.
 *
 * Así que no se mandan tarde: se saltan, y el contacto avanza hasta el que le
 * toca hoy. Pierde un correo, pero los que reciba dirán la verdad.
 *
 * El M0 NUNCA se salta, y esa es la excepción importante: lleva la ficha que
 * la persona acaba de pedir. Si Mailjet estuviera caído dos días, saltárselo
 * dejaría a un lead sin lo único que vino a buscar.
 */
export function posicionAlDia(contacto: NurtureContacto): number {
  const actual = contacto.posicion_secuencia;
  if (actual < 1 || actual > ULTIMA_POSICION_VENTANA) return actual;
  const { dias_desde_alta } = calcularVentana(contacto.fecha_alta);
  if (dias_desde_alta === null || dias_desde_alta <= actual) return actual;
  return Math.min(dias_desde_alta, ULTIMA_POSICION_VENTANA + 1);
}

/**
 * Adelanta al contacto hasta la posición que le toca hoy, sin mandar nada.
 *
 * El .eq() sobre la posición actual es el que evita pisar a un envío que
 * estuviera ocurriendo a la vez: si otra pasada ya lo movió, esto no hace
 * nada. Y NO se toca fecha_ultimo_mail_secuencia a propósito — no se ha
 * enviado ningún correo, así que el de hoy todavía puede salir.
 */
export async function saltarHasta(contacto: NurtureContacto, posicion: number): Promise<void> {
  await supabase
    .from("newsletter_contactos")
    .update({ posicion_secuencia: posicion })
    .eq("id", contacto.id)
    .eq("posicion_secuencia", contacto.posicion_secuencia);
}

/**
 * "Ya estabas aquí": le vuelve a mandar la ficha a quien la pide estando ya
 * en la lista, sin darle de alta otra vez ni reiniciarle nada.
 *
 * Lo usan los dos caminos que se topan con ese caso: los leads duplicados de
 * Meta Ads (/api/leads/entrada) y quien rellena /espalda estando ya activo o
 * volviendo tras haberse dado de baja. Es el mismo correo a propósito: en
 * los tres casos la persona te conoce, acaba de pedir la ficha, y le toca lo
 * mismo — la ficha, sin repetirle la presentación.
 *
 * Va en negativo como el resto de correos fuera de la progresión normal:
 * -1 recordatorio, -2 este.
 */
export const POSICION_MAIL_FICHA = -2;

/**
 * Manda un correo concreto de secuencia_mails sin tocar la posición del
 * contacto ni su progreso.
 *
 * enviarMailSecuencia() no vale para esto: lee la posición del contacto y la
 * avanza al confirmar el envío, que es justo lo que aquí no debe pasar. Este
 * envío lo dispara una acción de la persona (rellenar un formulario), no el
 * calendario, así que no hay candado: si rellena el formulario dos veces,
 * recibe la ficha dos veces, que es lo que ha pedido.
 */
export async function enviarMailSuelto(
  contacto: { id: string; email: string; nombre: string | null; idioma: string | null; fecha_alta: string | null; token: string | null },
  posicion: number,
  campana: string
): Promise<{ enviado: boolean; motivo?: string }> {
  const { data: mail } = await supabase
    .from("secuencia_mails")
    .select("asunto, cuerpo_html, remitente, formato, preheader")
    .eq("secuencia", "nurture")
    .eq("posicion", posicion)
    .eq("activo", true)
    .maybeSingle();

  if (!mail) return { enviado: false, motivo: `sin contenido activo en la posición ${posicion}` };

  const enVentana = calcularVentana(contacto.fecha_alta).elegibilidad === "elegible";
  const valores = {
    ...marcadoresDeNombre(contacto.nombre),
    ...marcadoresDeFecha(),
    ...marcadoresDeVentana(contacto.fecha_alta),
  };
  const cuerpo = cuerpoDelMail(mail.cuerpo_html, mail.formato, mail.preheader, valores, {
    si_ventana: enVentana,
    si_no_ventana: !enVentana,
  });
  // Normalmente estas personas están fuera de ventana y el enlace se queda
  // limpio. Pero alguien que se apuntó anteayer y hoy rellena el formulario
  // de /espalda sigue dentro, y entonces sí le corresponde su token.
  const conEnlaces = enVentana && contacto.token
    ? personalizarEnlacesHojaDeRuta(cuerpo, contacto.token)
    : cuerpo;

  try {
    await sendEmail(
      contacto.nombre ? `${contacto.nombre} <${contacto.email}>` : contacto.email,
      sustituirMarcadores(mail.asunto ?? "", valores),
      wrapNurture(conEnlaces, contacto.email, contacto.idioma === "eu"),
      resolveNewsletterFrom(mail.remitente),
      undefined,
      { campana, customId: contacto.id }
    );
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error("nurture: error enviando el mail suelto", posicion, contacto.email, err);
    return { enviado: false, motivo: mensaje };
  }
  return { enviado: true };
}

/**
 * Deja los enlaces a la Hoja de Ruta apuntando a la versión que le toca a
 * este contacto: la gratuita con su token si está dentro de sus 8 días, y el
 * enlace limpio (versión de pago) si no.
 *
 * Las dos condiciones para tocar el enlace son deliberadas:
 *
 *  - Solo dentro de ventana. A quien ya se le pasó no se le manda un
 *    ?ventana=1 que la propia página va a rechazar: vería la de pago igual,
 *    pero después de haber pinchado en algo que parecía prometerle otra cosa.
 *  - Solo en los correos que no contradicen la oferta. El M8 y el de
 *    cortesía dicen expresamente que ya cuesta 90 €, así que se quedan como
 *    están (POSICIONES_SIN_VENTANA).
 *
 * Se hace al enviar y no escribiendo el enlace a mano en el panel para que
 * valga también para los correos que se escriban en el futuro.
 */
export function enlacesDeVentana(html: string, contacto: NurtureContacto, posicion: number): string {
  if (POSICIONES_SIN_VENTANA.has(posicion)) return html;
  if (!contacto.token) return html;
  if (calcularVentana(contacto.fecha_alta).elegibilidad !== "elegible") return html;
  return personalizarEnlacesHojaDeRuta(html, contacto.token);
}

// Envía a `contacto` el mail que le toca según su posicion_secuencia.
//
// Regla dura: posicion_secuencia y fecha_ultimo_mail_secuencia NUNCA se
// tocan hasta que sendEmail() confirma el envío sin lanzar excepción. Si
// Mailjet falla, el contacto se queda exactamente como estaba (misma
// posición, sin fecha) — el cron lo recoge en la siguiente pasada porque
// para él no ha cambiado nada. Nunca al revés.
//
// El anti-carrera (para que el cron y un envío inmediato desde
// /api/leads/entrada no dupliquen un envío si coinciden) usa un candado
// aparte, enviando_secuencia_desde, que no tiene nada que ver con "enviado
// de verdad": se libera tanto si el envío sale bien como si falla. Si un
// intento se queda a medias por un cuelgue del proceso, el candado caduca
// solo a los 5 minutos y se puede reclamar de nuevo.
export async function enviarMailSecuencia(
  contacto: NurtureContacto
): Promise<{ enviado: boolean; motivo?: "sin-contenido" | "raced" | "error-envio" | "error-db" }> {
  const { data: mail } = await supabase
    .from("secuencia_mails")
    .select("posicion, asunto, cuerpo_html, remitente, formato, preheader")
    .eq("secuencia", "nurture")
    .eq("posicion", contacto.posicion_secuencia)
    .eq("activo", true)
    .maybeSingle();

  if (!mail) return { enviado: false, motivo: "sin-contenido" };

  const staleThreshold = new Date(Date.now() - CANDADO_STALE_MS).toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("newsletter_contactos")
    .update({ enviando_secuencia_desde: new Date().toISOString() })
    .eq("id", contacto.id)
    .eq("posicion_secuencia", contacto.posicion_secuencia)
    // Se vuelve a mirar AQUÍ, y no solo en el select del cron, porque el cron
    // carga la lista al principio de la pasada: quien pulse "Reservó Hoja de
    // Ruta" a mitad de ella seguiría en esa lista. Ver pasarANewsletter().
    .eq("recibe_secuencia", true)
    .is("hoja_ruta_reservada_en", null)
    .or(`enviando_secuencia_desde.is.null,enviando_secuencia_desde.lt.${staleThreshold}`)
    .select("id");

  // Un error aquí (ej. falta una columna) no es "raced" — es un fallo real
  // que hay que ver, no tragarse en silencio.
  if (claimError) {
    console.error("nurture: error al reclamar el envío (revisar esquema de la tabla):", contacto.email, claimError);
    return { enviado: false, motivo: "error-db" };
  }
  if (!claimed?.length) return { enviado: false, motivo: "raced" };

  const isEu = contacto.idioma === "eu";
  const enVentana = calcularVentana(contacto.fecha_alta).elegibilidad === "elegible";
  // Los marcadores se resuelven AQUÍ, en el momento del envío: el nombre sale
  // de esta fila y las fechas se cuentan desde hoy, así que un mismo mail de
  // la secuencia dice una fecha distinta según el día en que le toque a cada
  // uno. Valen tanto en el cuerpo como en el asunto.
  const valores = {
    ...marcadoresDeNombre(contacto.nombre),
    ...marcadoresDeFecha(),
    ...marcadoresDeVentana(contacto.fecha_alta),
  };
  // Misma condición que decide si el enlace lleva token, para que el texto y
  // el enlace del mismo correo no puedan contar cosas distintas.
  const condiciones = { si_ventana: enVentana, si_no_ventana: !enVentana };
  const html = wrapNurture(
    enlacesDeVentana(
      cuerpoDelMail(mail.cuerpo_html, mail.formato, mail.preheader, valores, condiciones),
      contacto,
      contacto.posicion_secuencia
    ),
    contacto.email,
    isEu
  );

  try {
    await sendEmail(
      contacto.nombre ? `${contacto.nombre} <${contacto.email}>` : contacto.email,
      sustituirMarcadores(mail.asunto ?? "", valores),
      html,
      resolveNewsletterFrom(mail.remitente),
      undefined,
      // La etiqueta agrupa en Mailjet a TODO el que pase por este mail, sin
      // importar la fecha: así se pueden comparar M0, M1, M2… entre sí.
      { campana: `nurture-m${contacto.posicion_secuencia}`, customId: contacto.id }
    );
  } catch (err) {
    console.error("nurture send error:", contacto.email, err);
    // Liberamos el candado; NO tocamos posicion_secuencia ni
    // fecha_ultimo_mail_secuencia — el contacto queda tal cual estaba.
    await supabase.from("newsletter_contactos").update({ enviando_secuencia_desde: null }).eq("id", contacto.id);
    return { enviado: false, motivo: "error-envio" };
  }

  // Envío confirmado por Mailjet: ahora sí avanzamos posición y marcamos la fecha.
  const siguientePosicion = contacto.posicion_secuencia + 1;
  const { count: quedan } = await supabase
    .from("secuencia_mails")
    .select("posicion", { count: "exact", head: true })
    .eq("secuencia", "nurture")
    .gte("posicion", siguientePosicion)
    .eq("activo", true);

  await supabase
    .from("newsletter_contactos")
    .update({
      posicion_secuencia: siguientePosicion,
      secuencia_completada: (quedan ?? 0) === 0,
      fecha_ultimo_mail_secuencia: new Date().toISOString(),
      enviando_secuencia_desde: null,
    })
    .eq("id", contacto.id);

  return { enviado: true };
}

// ============================================================
// Reservó la Hoja de Ruta → pasa de la secuencia a la newsletter
// ============================================================
//
// Lo dispara el botón del panel. El calendario, en hora de Madrid:
//
//   día D (antes de las 19:15)  sale de la secuencia al instante; ese día no
//                               recibe la newsletter, salga a la hora que
//                               salga; a las 19:15 le llega SOLO el mail de
//                               transición (posición -3).
//   día D+1                     newsletter normal.
//
// Pulsado a partir de las 19:15, todo se corre un día. Y si el envío de la
// transición falla, se reintenta en la siguiente ventana de las 19:15: la
// newsletter empieza siempre el día DESPUÉS de que la transición salga de
// verdad, nunca antes (ver filtroTransicionNewsletter).

export const POSICION_MAIL_TRANSICION = -3;
export const HORA_TRANSICION_MIN = 19 * 60 + 15; // 19:15

function partesMadrid(d: Date) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "0";
  return {
    fecha: `${get("year")}-${get("month")}-${get("day")}`,
    minutos: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

function sumarUnDia(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Las 00:00 de hoy en Madrid, como instante UTC. */
function inicioDelDiaMadrid(ahora: Date): string {
  const { fecha } = partesMadrid(ahora);
  const medianocheUtc = Date.parse(`${fecha}T00:00:00Z`);
  // Cuánto va Madrid por delante de UTC a esa hora (1 h en invierno, 2 en
  // verano). Los cambios de hora son de madrugada, nunca a las 00:00.
  const enMadrid = partesMadrid(new Date(medianocheUtc));
  const desfaseMin = enMadrid.fecha === fecha ? enMadrid.minutos : enMadrid.minutos - 24 * 60;
  return new Date(medianocheUtc - desfaseMin * 60 * 1000).toISOString();
}

/** Qué día le toca la transición a quien se pase AHORA. */
export function diaDeTransicion(ahora: Date = new Date()): string {
  const { fecha, minutos } = partesMadrid(ahora);
  return minutos < HORA_TRANSICION_MIN ? fecha : sumarUnDia(fecha);
}

/**
 * Filtro extra para los destinatarios de la newsletter, que se suma (AND) al
 * que ya había. Para quien nunca ha pasado por el botón, transicion_para es
 * NULL y no cambia nada. A quien sí, le deja fuera hasta el día siguiente al
 * envío real de su transición: ni la newsletter del día del botón ni la de un
 * día en que la transición siga sin salir.
 */
export function filtroTransicionNewsletter(ahora: Date = new Date()): string {
  return `transicion_para.is.null,transicion_enviada_en.lt.${inicioDelDiaMadrid(ahora)}`;
}

export type PasoANewsletter =
  | { estado: "hecho" | "ya-estaba"; transicion_para: string | null; transicion_enviada_en: string | null }
  | { estado: "enviando" | "no-aplica" | "no-existe" | "sin-mail" | "error"; motivo: string };

/**
 * El botón "Reservó Hoja de Ruta → pasar a newsletter".
 *
 * Es UN solo UPDATE condicionado, y de ahí sale todo lo que importa:
 *
 *  - Idempotente: solo se aplica si hoja_ruta_reservada_en sigue a NULL. La
 *    segunda pulsación no toca nada y devuelve lo que ya había.
 *  - No se cruza con el cron. Exige que el candado de la secuencia (y el del
 *    recordatorio -1) esté libre, y el candado de enviarMailSecuencia exige a
 *    su vez que esta marca siga a NULL. Postgres pone en fila los dos UPDATE
 *    sobre la misma fila, así que gana uno: si gana el botón, el cron ya no
 *    puede reclamar el envío aunque tuviera al contacto en su lista; si gana
 *    el cron, ese correo ya va camino de Mailjet y el botón NO dice "hecho"
 *    — devuelve "enviando" para que se pulse otra vez en unos segundos.
 *
 * recibe_secuencia pasa a false, como hacía el antiguo "Marcar como
 * reservado": así lo deja fuera todo lo que ya filtraba por ese campo.
 */
export async function pasarANewsletter(id: string, ahora: Date = new Date()): Promise<PasoANewsletter> {
  // Sin mail de transición activo no se pasa a nadie: se quedaría fuera de
  // la newsletter esperando un correo que no va a salir.
  const { data: mail } = await supabase
    .from("secuencia_mails")
    .select("posicion")
    .eq("secuencia", "nurture")
    .eq("posicion", POSICION_MAIL_TRANSICION)
    .eq("activo", true)
    .maybeSingle();
  if (!mail) return { estado: "sin-mail", motivo: "El mail de transición (posición -3) no existe o está desactivado." };

  const staleThreshold = new Date(ahora.getTime() - CANDADO_STALE_MS).toISOString();
  const { data: hecho, error } = await supabase
    .from("newsletter_contactos")
    .update({
      hoja_ruta_reservada_en: ahora.toISOString(),
      recibe_secuencia: false,
      transicion_para: diaDeTransicion(ahora),
    })
    .eq("id", id)
    .is("hoja_ruta_reservada_en", null)
    .eq("recibe_secuencia", true)
    .eq("secuencia_completada", false)
    .eq("unsubscribed", false)
    .or(`enviando_secuencia_desde.is.null,enviando_secuencia_desde.lt.${staleThreshold}`)
    .or(`recordatorio_valoracion_enviando_desde.is.null,recordatorio_valoracion_enviando_desde.lt.${staleThreshold}`)
    .select("transicion_para, transicion_enviada_en");

  if (error) {
    console.error("pasarANewsletter: error en el update (¿falta la migración?):", id, error);
    return { estado: "error", motivo: error.message };
  }
  if (hecho?.length) return { estado: "hecho", ...hecho[0] };

  // No se ha aplicado: averiguamos por qué para decirlo en el panel.
  const { data: fila } = await supabase
    .from("newsletter_contactos")
    .select(
      "hoja_ruta_reservada_en, transicion_para, transicion_enviada_en, recibe_secuencia, secuencia_completada, unsubscribed, enviando_secuencia_desde, recordatorio_valoracion_enviando_desde"
    )
    .eq("id", id)
    .maybeSingle();

  if (!fila) return { estado: "no-existe", motivo: "No existe ese contacto." };
  if (fila.hoja_ruta_reservada_en) {
    return { estado: "ya-estaba", transicion_para: fila.transicion_para, transicion_enviada_en: fila.transicion_enviada_en };
  }
  if (fila.unsubscribed || fila.secuencia_completada || !fila.recibe_secuencia) {
    return { estado: "no-aplica", motivo: "Solo se puede con contactos que están ahora en la secuencia." };
  }
  return { estado: "enviando", motivo: "Se le está enviando un correo de la secuencia ahora mismo. Vuelve a pulsar en unos segundos." };
}

/**
 * Manda el mail de transición a quien le toque: dentro de la ventana de las
 * 19:15 (la comprueba quien llama), con transicion_para de hoy o anterior —
 * lo anterior es un reintento — y sin haberlo recibido todavía.
 *
 * Mismo esquema que el recordatorio: candado aparte que se suelta pase lo que
 * pase, y transicion_enviada_en solo tras confirmarlo Mailjet. Así no puede
 * salir dos veces, y si falla sale en la siguiente ventana.
 */
export async function procesarTransiciones(ahora: Date = new Date()): Promise<number> {
  const { fecha } = partesMadrid(ahora);

  const { data: mail } = await supabase
    .from("secuencia_mails")
    .select("asunto, cuerpo_html, remitente, formato, preheader")
    .eq("secuencia", "nurture")
    .eq("posicion", POSICION_MAIL_TRANSICION)
    .eq("activo", true)
    .maybeSingle();
  if (!mail) return 0;

  const { data: contactos, error } = await supabase
    .from("newsletter_contactos")
    .select("id, email, nombre, idioma")
    .not("hoja_ruta_reservada_en", "is", null)
    .lte("transicion_para", fecha)
    .is("transicion_enviada_en", null)
    .eq("unsubscribed", false);

  if (error) {
    console.error("transicion: error buscando contactos (¿falta la migración?):", error);
    return 0;
  }

  const staleThreshold = new Date(ahora.getTime() - CANDADO_STALE_MS).toISOString();
  let enviados = 0;

  for (const contacto of contactos ?? []) {
    const { data: claimed, error: claimError } = await supabase
      .from("newsletter_contactos")
      .update({ transicion_enviando_desde: new Date().toISOString() })
      .eq("id", contacto.id)
      .is("transicion_enviada_en", null)
      .or(`transicion_enviando_desde.is.null,transicion_enviando_desde.lt.${staleThreshold}`)
      .select("id");
    if (claimError) {
      console.error("transicion: error al reclamar el envío:", contacto.email, claimError);
      continue;
    }
    if (!claimed?.length) continue; // otra pasada lo tiene cogido

    const valores = { ...marcadoresDeNombre(contacto.nombre), ...marcadoresDeFecha() };
    // Sin enlaces de ventana: esta persona ya ha reservado.
    const html = wrapNurture(
      cuerpoDelMail(mail.cuerpo_html, mail.formato, mail.preheader, valores, { si_ventana: false, si_no_ventana: true }),
      contacto.email,
      contacto.idioma === "eu"
    );

    try {
      await sendEmail(
        contacto.nombre ? `${contacto.nombre} <${contacto.email}>` : contacto.email,
        sustituirMarcadores(mail.asunto ?? "", valores),
        html,
        resolveNewsletterFrom(mail.remitente),
        undefined,
        { campana: "nurture-transicion", customId: contacto.id }
      );
    } catch (err) {
      console.error("transicion send error:", contacto.email, err);
      await supabase.from("newsletter_contactos").update({ transicion_enviando_desde: null }).eq("id", contacto.id);
      continue;
    }

    await supabase
      .from("newsletter_contactos")
      .update({ transicion_enviada_en: new Date().toISOString(), transicion_enviando_desde: null })
      .eq("id", contacto.id);
    enviados++;
  }

  return enviados;
}

/**
 * Lo mismo que el botón del panel, disparado por una reserva confirmada de la
 * Hoja de Ruta: la gratuita al elegir hueco, la de pago al llegar el pago.
 *
 * Quien no está en la secuencia (lo normal en las de pago: ya están en la
 * newsletter) sale como "no-aplica" y no se le toca nada.
 *
 * "enviando" significa que justo ahora sale un correo de la secuencia para
 * esta persona. Ese candado dura lo que tarda Mailjet en contestar, así que
 * se reintenta un par de veces; si aun así no entra, el aviso interno lo dice
 * y queda el botón del panel.
 */
export async function pasarANewsletterPorEmail(email: string): Promise<PasoANewsletter> {
  const { data: contacto } = await supabase
    .from("newsletter_contactos")
    .select("id")
    .eq("email", normalizarEmail(email))
    .maybeSingle();
  if (!contacto) return { estado: "no-existe", motivo: "No está en la lista." };

  let r = await pasarANewsletter(contacto.id);
  for (let intento = 0; intento < 2 && r.estado === "enviando"; intento++) {
    await new Promise((ok) => setTimeout(ok, 3000));
    r = await pasarANewsletter(contacto.id);
  }
  if (r.estado !== "hecho" && r.estado !== "ya-estaba" && r.estado !== "no-aplica" && r.estado !== "no-existe") {
    console.error("pasarANewsletterPorEmail: no se ha podido pasar a la newsletter:", email, r);
  }
  return r;
}

/** Una línea para el aviso interno: qué ha pasado con su secuencia. */
export function textoPasoNewsletter(r: PasoANewsletter): string {
  switch (r.estado) {
    case "hecho":
    case "ya-estaba": {
      if (r.transicion_enviada_en) return "Ya estaba fuera de la secuencia · transición ya enviada";
      const hoy = partesMadrid(new Date()).fecha;
      const dia = !r.transicion_para
        ? ""
        : r.transicion_para === hoy
          ? "hoy"
          : r.transicion_para === sumarUnDia(hoy)
            ? "mañana"
            : r.transicion_para.split("-").reverse().join("/");
      return `${r.estado === "hecho" ? "Sacado de la secuencia" : "Ya estaba fuera de la secuencia"} · transición ${dia} 19:15 · newsletter desde el día siguiente`;
    }
    case "no-aplica":
    case "no-existe":
      return "No estaba en la secuencia · no se ha tocado nada";
    default:
      return `NO SE HA PODIDO SACAR DE LA SECUENCIA (${r.motivo}) · pulsa el botón en /admin → Nurture`;
  }
}
