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
  const contactEmail = isEu ? "kontaktu@alainzulaika.com" : "contacto@alainzulaika.com";
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
      // Estaba dado de baja y vuelve a marcar la casilla: es una señal de
      // interés renovado, así que se reactiva y entra en la secuencia desde
      // cero, igual que hace /api/leads/entrada con los leads de ads.
      const { data, error } = await supabase
        .from("newsletter_contactos")
        .update({
          ...completar,
          unsubscribed: false,
          recibe_secuencia: true,
          posicion_secuencia: 0,
          secuencia_completada: false,
          fecha_ultimo_mail_secuencia: null,
          enviando_secuencia_desde: null,
          origen,
        })
        .eq("id", fila.id)
        .select(CAMPOS_CONTACTO)
        .single();
      if (error) {
        console.error("altaEnSecuencia: error reactivando", emailLower, error);
        return { estado: "error", contactoId: fila.id, contacto: null, token: fila.token, error: error.message };
      }
      return { estado: "reactivado", contactoId: fila.id, contacto: data, token: data.token };
    }

    // Ya estaba en la lista: no le tocamos recibe_secuencia ni la posición.
    // Rellenar otro formulario no debe reiniciarle la secuencia ni volver a
    // mandarle mails que ya recibió.
    const { error } = await supabase.from("newsletter_contactos").update(completar).eq("id", fila.id);
    if (error) {
      console.error("altaEnSecuencia: error fusionando datos", emailLower, error);
      return { estado: "error", contactoId: fila.id, contacto: null, token: fila.token, error: error.message };
    }
    return { estado: "existente", contactoId: fila.id, contacto: null, token: fila.token };
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
    return { estado: "error", contactoId: null, contacto: null, token: null, error: error.message };
  }

  return { estado: "nuevo", contactoId: creado.id, contacto: recibeSecuencia ? creado : null, token: creado.token };
}

export const CANDADO_STALE_MS = 5 * 60 * 1000; // 5 min: si un intento se quedó a medias (crash), se puede reclamar de nuevo

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
  // Los marcadores se resuelven AQUÍ, en el momento del envío: el nombre sale
  // de esta fila y las fechas se cuentan desde hoy, así que un mismo mail de
  // la secuencia dice una fecha distinta según el día en que le toque a cada
  // uno. Valen tanto en el cuerpo como en el asunto.
  const valores = {
    ...marcadoresDeNombre(contacto.nombre),
    ...marcadoresDeFecha(),
    ...marcadoresDeVentana(contacto.fecha_alta),
  };
  const html = wrapNurture(
    enlacesDeVentana(
      cuerpoDelMail(mail.cuerpo_html, mail.formato, mail.preheader, valores),
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
