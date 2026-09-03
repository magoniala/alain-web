import { createClient } from "@supabase/supabase-js";
import { sendEmail, sendEmailBatch, resolveNewsletterFrom } from "@/lib/email-ses";
import {
  wrapNurture,
  enviarMailSecuencia,
  enlacesDeVentana,
  posicionAlDia,
  saltarHasta,
  CANDADO_STALE_MS,
  CAMPOS_CONTACTO as CAMPOS_CONTACTO_NURTURE,
  type NurtureContacto,
} from "@/lib/nurture";
import {
  calcularVentana,
  marcadoresDeVentana,
  personalizarEnlacesHojaDeRuta,
  ventanaDeContacto,
} from "@/lib/entrenatzaile-ventana";
import {
  MAIL_ABANDONO_ASUNTO,
  MAIL_LIBERADO_ASUNTO,
  enlaceHojaDeRuta,
  mailAbandonoCuerpo,
  mailLiberadoCuerpo,
} from "@/lib/entrenatzaile-mails";
import { getStripe } from "@/lib/stripe";
import { cargarMailSecuencia } from "@/lib/secuencia-mails";
import {
  cuerpoDelMail,
  marcadoresDeFecha,
  marcadoresDeNombre,
  sustituirMarcadores,
} from "@/lib/email-markdown";
import { processText } from "@/lib/newsletter-texto";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://alainzulaika.com";

const IMG_RE = /^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)$/;

function buildHtml(body: string, email: string, preheader?: string, isEu?: boolean) {
  const htmlBody = body
    .trim()
    .split(/\n/)
    .map((line: string) => {
      const t = line.trim();
      if (!t) return `<p style="margin:0 0 0.8rem 0;">&nbsp;</p>`;
      const img = t.match(IMG_RE);
      if (img) return `<img src="${img[2]}" alt="${img[1]}" style="max-width:100%;height:auto;display:block;margin:1.2rem 0;">`;
      return `<p style="margin:0 0 1.2rem 0;">${processText(t)}</p>`;
    })
    .join("");
  const preheaderHtml = preheader?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader.trim()}</div>`
    : "";
  const contactEmail = isEu ? "kontaktu@alainzulaika.com" : "contacto@alainzulaika.com";
  return `
    ${preheaderHtml}
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
      <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">${htmlBody}</div>
      <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.9rem;color:#555;line-height:2;">
        <p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:${contactEmail}" style="color:#555;">${contactEmail}</a></p>
        <p style="margin:0;"><a href="${BASE_URL}/newsletter/idioma?email=${encodeURIComponent(email)}" style="color:#bbb;">Cambiar idioma</a> · <a href="${BASE_URL}/api/newsletter/baja?email=${encodeURIComponent(email)}" style="color:#bbb;">Dejar de recibir estos emails</a></p>
      </div>
    </div>
  `;
}

// Hora fija (Europe/Madrid) a la que sale cada mail de la secuencia, salvo el
// primero (posición 0), que es inmediato en cuanto el contacto se apunta.
const HORA_ENVIO_DIARIO_MIN = 14 * 60 + 30; // 14:30
const HORA_RECORDATORIO_MIN = 19 * 60 + 14; // 19:14
const HORA_COLA_B_MIN = 19 * 60 + 15; // 19:15 — rescate del día si no ha salido nada
const VENTANA_MIN = 30; // margen para no perder la ventana si el cron se retrasa

function madridParts(d: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")) };
}

function madridDate(iso: string) {
  return madridParts(new Date(iso)).date;
}

function enVentana(minutosAhora: number, minutosObjetivo: number) {
  return minutosAhora >= minutosObjetivo && minutosAhora < minutosObjetivo + VENTANA_MIN;
}

async function procesarNurture(): Promise<number> {
  const ahora = madridParts();
  const minutosAhora = ahora.hour * 60 + ahora.minute;
  const dentroVentanaDiaria = enVentana(minutosAhora, HORA_ENVIO_DIARIO_MIN);

  let enviados = 0;
  let saltados = 0;

  const { data: contactos } = await supabase
    .from("newsletter_contactos")
    // Lista de campos compartida con lib/nurture.ts: al añadir uno nuevo
    // (como el token de ventana) llega solo aquí, sin que este select se
    // quede corto y falle de forma silenciosa.
    .select(CAMPOS_CONTACTO_NURTURE)
    .eq("recibe_secuencia", true)
    .eq("secuencia_completada", false)
    .eq("unsubscribed", false);

  for (const contacto of (contactos ?? []) as NurtureContacto[]) {
    // Un correo de la cuenta atrás cuyo día ya pasó no se manda tarde: se
    // salta y el contacto avanza hasta el que le toca hoy. Va antes que
    // cualquier otra comprobación, y fuera de la ventana horaria, porque
    // saltar no es enviar: ponerse al día no tiene que esperar a las 14:30.
    const alDia = posicionAlDia(contacto);
    if (alDia !== contacto.posicion_secuencia) {
      await saltarHasta(contacto, alDia);
      saltados += alDia - contacto.posicion_secuencia;
      contacto.posicion_secuencia = alDia;
    }

    const esPrimerMail = contacto.posicion_secuencia === 0;

    if (!esPrimerMail) {
      // A partir del segundo mail, solo se envía dentro de la ventana diaria
      // fija y como mucho una vez por día natural (hora de Madrid). El primer
      // mail no tiene ventana: sale en cuanto el cron lo vea (o lo intenta de
      // nuevo si un envío inmediato desde /api/leads/entrada falló).
      if (!dentroVentanaDiaria) continue;
      if (contacto.fecha_ultimo_mail_secuencia && madridDate(contacto.fecha_ultimo_mail_secuencia) === ahora.date) continue;
    }

    const { enviado } = await enviarMailSecuencia(contacto);
    if (enviado) enviados++;
  }

  if (saltados) console.warn(`nurture: ${saltados} correos saltados por llegar fuera de su día`);
  return enviados;
}

// Recordatorio puntual, mismo día que el mail de la posición 7 pero más
// tarde (19:14): vive en secuencia_mails con posicion=-1 (fuera del rango
// normal 0+, para no chocar nunca con la progresión de posicion_secuencia).
// Se dispara para quien ya recibió hoy mismo el mail que le hizo avanzar a
// la posición 8 (es decir, el de la posición 7).
async function procesarRecordatorioValoracion(): Promise<number> {
  const ahora = madridParts();
  const minutosAhora = ahora.hour * 60 + ahora.minute;
  if (!enVentana(minutosAhora, HORA_RECORDATORIO_MIN)) return 0;

  const { data: mail } = await supabase
    .from("secuencia_mails")
    .select("asunto, cuerpo_html, remitente, formato, preheader")
    .eq("secuencia", "nurture")
    .eq("posicion", -1)
    .eq("activo", true)
    .maybeSingle();
  if (!mail) return 0;

  const { data: contactos } = await supabase
    .from("newsletter_contactos")
    // Mismos campos que el resto de la secuencia: el recordatorio también
    // enlaza a la Hoja de Ruta y necesita el token y la fecha de alta.
    .select(CAMPOS_CONTACTO_NURTURE)
    .eq("recibe_secuencia", true)
    .eq("posicion_secuencia", 8)
    .eq("recordatorio_valoracion_enviado", false);

  let enviados = 0;
  const staleThreshold = new Date(Date.now() - CANDADO_STALE_MS).toISOString();

  for (const contacto of (contactos ?? []) as NurtureContacto[]) {
    if (!contacto.fecha_ultimo_mail_secuencia) continue;
    if (madridDate(contacto.fecha_ultimo_mail_secuencia) !== ahora.date) continue; // el mail 7 no fue hoy

    // Candado anti-carrera, separado del marcador de "enviado de verdad":
    // recordatorio_valoracion_enviado solo se pone a true tras confirmar el
    // envío, nunca antes.
    const { data: claimed, error: claimError } = await supabase
      .from("newsletter_contactos")
      .update({ recordatorio_valoracion_enviando_desde: new Date().toISOString() })
      .eq("id", contacto.id)
      .eq("recordatorio_valoracion_enviado", false)
      .or(`recordatorio_valoracion_enviando_desde.is.null,recordatorio_valoracion_enviando_desde.lt.${staleThreshold}`)
      .select("id");
    if (claimError) {
      console.error("recordatorio: error al reclamar el envío (revisar esquema de la tabla):", contacto.email, claimError);
      continue;
    }
    if (!claimed?.length) continue;

    const isEu = contacto.idioma === "eu";
    // Los marcadores también aquí: este envío tiene su propio camino y antes
    // no los sustituía. Hoy el recordatorio no usa ninguno, pero se edita
    // desde el panel como cualquier otro y escribir un {{nombre}} no puede
    // acabar mandándolo tal cual.
    const valores = {
      ...marcadoresDeNombre(contacto.nombre),
      ...marcadoresDeFecha(),
      ...marcadoresDeVentana(contacto.fecha_alta),
    };
    const enVentana = calcularVentana(contacto.fecha_alta).elegibilidad === "elegible";
    const condiciones = { si_ventana: enVentana, si_no_ventana: !enVentana };
    // -1 no está en POSICIONES_SIN_VENTANA: el recordatorio es justo el
    // correo que más falta hace que lleve a la versión gratuita.
    const html = wrapNurture(
      enlacesDeVentana(cuerpoDelMail(mail.cuerpo_html, mail.formato, mail.preheader, valores, condiciones), contacto, -1),
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
        { campana: "nurture-recordatorio", customId: contacto.id }
      );
    } catch (err) {
      console.error("recordatorio send error:", contacto.email, err);
      await supabase.from("newsletter_contactos").update({ recordatorio_valoracion_enviando_desde: null }).eq("id", contacto.id);
      continue; // no marcado como enviado: puede reintentarse si el candado caduca
    }

    await supabase
      .from("newsletter_contactos")
      .update({ recordatorio_valoracion_enviado: true, recordatorio_valoracion_enviando_desde: null })
      .eq("id", contacto.id);
    enviados++;
  }

  return enviados;
}

interface CampanaEnviable {
  id: string;
  subject_eu: string | null;
  body_eu: string | null;
  preheader_eu: string | null;
  subject_es: string | null;
  body_es: string | null;
  preheader_es: string | null;
  remitente: string | null;
  excluidos: string[] | null;
}

interface ContactoEnvio {
  email: string;
  nombre: string | null;
  idioma: string | null;
}

// Destinatarios del newsletter: excluye a quien esté activo en una secuencia de
// nurture — vuelve a recibirlo en cuanto se reserva o la completa. Se carga como
// mucho una vez por ejecución del cron, y solo si hay algo que enviar.
function crearCargadorContactos() {
  let cache: ContactoEnvio[] | null = null;
  return async (): Promise<ContactoEnvio[]> => {
    if (cache) return cache;
    const { data } = await supabase
      .from("newsletter_contactos")
      .select("email, nombre, idioma")
      .eq("unsubscribed", false)
      .or("recibe_secuencia.eq.false,secuencia_completada.eq.true");
    cache = data ?? [];
    return cache;
  };
}

// Envía una campaña ya reclamada (estado 'enviando') y la cierra como 'enviado'.
async function enviarCampana(campana: CampanaEnviable, contactos: ContactoEnvio[]) {
  const hasEu = !!(campana.subject_eu && campana.body_eu);
  const hasEs = !!(campana.subject_es && campana.body_es);
  const excluded = new Set((campana.excluidos ?? []).map((e: string) => e.toLowerCase()));
  const destinatarios = contactos.filter(c => !excluded.has(c.email.toLowerCase()));

  // Si vienen los dos idiomas: se reparte por idioma. Si solo uno: va a todos.
  const euContactos = hasEu ? (hasEs ? destinatarios.filter(c => c.idioma === "eu") : destinatarios) : [];
  const esContactos = hasEs ? (hasEu ? destinatarios.filter(c => c.idioma !== "eu") : destinatarios) : [];

  const emails = [
    ...euContactos.map(({ email, nombre }) => ({
      email, nombre,
      subject: campana.subject_eu!,
      html: buildHtml(campana.body_eu!, email, campana.preheader_eu ?? undefined, true),
    })),
    ...esContactos.map(({ email, nombre }) => ({
      email, nombre,
      subject: campana.subject_es!,
      html: buildHtml(campana.body_es!, email, campana.preheader_es ?? undefined, false),
    })),
  ];

  const from = resolveNewsletterFrom(campana.remitente);
  const BATCH = 50;
  for (let i = 0; i < emails.length; i += BATCH) {
    await sendEmailBatch(
      emails.slice(i, i + BATCH).map(({ email, nombre, subject, html }) => ({
        to: nombre ? `${nombre} <${email}>` : email,
        subject,
        html,
      })),
      from
    );
  }

  await supabase
    .from("newsletter_campanas")
    .update({
      estado: "enviado",
      enviado_en: new Date().toISOString(),
      enviados_eu: euContactos.length,
      enviados_es: esContactos.length,
    })
    .eq("id", campana.id);
}

// Cola B: mails de reserva sin fecha (estado 'cola', ordenados por orden_cola).
// A las 19:15 (Madrid), si ese día no ha salido ni está programado ningún otro
// envío, sale el primero de la cola. Un solo mail por día, nunca dos.
async function procesarColaB(cargarContactos: () => Promise<ContactoEnvio[]>): Promise<number> {
  const ahora = madridParts();
  const minutosAhora = ahora.hour * 60 + ahora.minute;
  if (!enVentana(minutosAhora, HORA_COLA_B_MIN)) return 0;

  // ¿Hay algo hoy? Cuenta lo ya enviado, lo que está saliendo ahora mismo y lo
  // que sigue programado para hoy más tarde (los canceladas no cuentan). El
  // filtro por fecha reciente es solo para no traerse el histórico entero.
  const desde = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: recientes } = await supabase
    .from("newsletter_campanas")
    .select("estado, enviado_en, programado_para")
    .in("estado", ["enviado", "enviando", "programado"])
    .or(`enviado_en.gte.${desde},programado_para.gte.${desde}`);

  const hayEnvioHoy = (recientes ?? []).some(c =>
    (c.enviado_en && madridDate(c.enviado_en) === ahora.date) ||
    (c.programado_para && madridDate(c.programado_para) === ahora.date)
  );
  if (hayEnvioHoy) return 0;

  const { data: cola } = await supabase
    .from("newsletter_campanas")
    .select("*")
    .eq("estado", "cola")
    .order("orden_cola", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1);

  const siguiente = cola?.[0];
  if (!siguiente) return 0;

  // Candado: el paso a 'enviando' solo lo gana una ejecución. Se le pone fecha
  // de hoy para que quede como envío del día (y para que, si el envío se corta a
  // medias, la comprobación de arriba no deje salir otro mail después).
  const { data: claimed } = await supabase
    .from("newsletter_campanas")
    .update({ estado: "enviando", programado_para: new Date().toISOString() })
    .eq("id", siguiente.id)
    .eq("estado", "cola")
    .select("id");
  if (!claimed?.length) return 0;

  const contactos = await cargarContactos();
  if (!contactos.length) {
    await supabase
      .from("newsletter_campanas")
      .update({ estado: "cola", programado_para: null })
      .eq("id", siguiente.id)
      .eq("estado", "enviando");
    return 0;
  }

  await enviarCampana(siguiente as CampanaEnviable, contactos);
  return 1;
}

// Reservas de la Hoja de Ruta que se quedaron a medias: el lead rellenó sus
// datos (ya está guardado) pero no llegó a elegir hueco. Pasado un rato se
// le escribe una vez, y solo una.
//
// No tiene ventana horaria propia: sale en cuanto se cumple la espera, en la
// pasada del cron que toque.
const ABANDONO_ESPERA_MS = 60 * 60 * 1000; // 1 h desde que dejó los datos
const ABANDONO_MAX_ANTIGUEDAD_MS = 7 * 24 * 60 * 60 * 1000; // no rescatar histórico viejo

async function procesarReservasAbandonadas(): Promise<number> {
  const ahora = Date.now();
  const limiteSuperior = new Date(ahora - ABANDONO_ESPERA_MS).toISOString();
  const limiteInferior = new Date(ahora - ABANDONO_MAX_ANTIGUEDAD_MS).toISOString();

  const { data: reservas, error } = await supabase
    .from("hoja_ruta_reservas")
    .select("id, nombre, email, variante")
    .is("hueco", null)
    // Una llamada anulada desde el panel también se queda sin hueco. Sin este
    // filtro, al anularla le llegaría al lead un correo diciéndole que dejó
    // la reserva a medias, que es justo lo contrario de lo que pasó.
    .is("cancelada_en", null)
    // Y lo mismo con las que se han liberado por no llegar el pago: también
    // se quedan sin hueco, pero esa persona SÍ eligió día y hora. Decirle
    // que "se quedó sin elegir fecha" justo después de mandarle el correo de
    // "he liberado tu hueco" sería contarle dos historias distintas del mismo
    // día. Las reservas que de verdad se quedaron a medias nunca llegaron al
    // pago, así que su pago_estado es NULL.
    .is("pago_estado", null)
    .eq("aviso_abandono_enviado", false)
    .lt("creado_en", limiteSuperior)
    .gt("creado_en", limiteInferior);

  if (error) {
    console.error("cron: error buscando reservas abandonadas (¿falta la columna?):", error);
    return 0;
  }
  if (!reservas?.length) return 0;

  // Quien volvió más tarde y sí completó una reserva no debe recibir el
  // aviso, aunque la fila a medias siga ahí.
  const { data: completadas } = await supabase
    .from("hoja_ruta_reservas")
    .select("email")
    .not("hueco", "is", null)
    .in("email", reservas.map((r) => r.email));
  const yaReservaron = new Set((completadas ?? []).map((r) => r.email));

  // Tampoco a quien se haya dado de baja de los correos.
  const { data: bajas } = await supabase
    .from("newsletter_contactos")
    .select("email")
    .eq("unsubscribed", true)
    .in("email", reservas.map((r) => r.email));
  const dadosDeBaja = new Set((bajas ?? []).map((r) => r.email));

  // Token y fecha de alta de cada uno, para que el enlace de "retomarlo" lleve
  // a la versión que de verdad le corresponde. Antes este correo mandaba un
  // "?ventana=1" fijo según lo que el lead hubiera VISTO; ahora ese parámetro
  // por sí solo no regala nada, así que hay que resolver su token.
  //
  // recibe_secuencia va en el select porque este correo es el único camino por
  // el que un contacto creado por el propio formulario de la Hoja de Ruta
  // (que nace con recibe_secuencia=false) podía recibir un enlace tokenizado
  // y llevarse gratis lo que venía a pagar. Ver ventanaDeContacto().
  const { data: contactos } = await supabase
    .from("newsletter_contactos")
    .select("email, token, fecha_alta, recibe_secuencia")
    .in("email", reservas.map((r) => r.email));
  const porEmail = new Map((contactos ?? []).map((c) => [c.email, c]));

  const staleThreshold = new Date(ahora - CANDADO_STALE_MS).toISOString();
  let enviados = 0;

  for (const reserva of reservas) {
    if (yaReservaron.has(reserva.email) || dadosDeBaja.has(reserva.email)) continue;

    const { data: claimed, error: claimError } = await supabase
      .from("hoja_ruta_reservas")
      .update({ aviso_abandono_enviando_desde: new Date().toISOString() })
      .eq("id", reserva.id)
      .eq("aviso_abandono_enviado", false)
      .or(`aviso_abandono_enviando_desde.is.null,aviso_abandono_enviando_desde.lt.${staleThreshold}`)
      .select("id");
    if (claimError) {
      console.error("cron: error al reclamar el aviso de abandono:", reserva.email, claimError);
      continue;
    }
    if (!claimed?.length) continue; // otra pasada lo tiene cogido

    // Lo que promete el texto y a dónde lleva el enlace salen los dos de la
    // ventana REAL de esta persona, no de la versión de la landing que llegó
    // a ver: así no pueden contradecirse.
    const contacto = porEmail.get(reserva.email);
    const enVentana = ventanaDeContacto(contacto).elegibilidad === "elegible";

    // Contenido desde el panel; si no hay fila activa, la versión en código,
    // igual que en comodin y mision. La reserva existe para que quitar o
    // vaciar la fila por accidente no deje a nadie sin este correo.
    const marcadores = {
      ...marcadoresDeNombre(reserva.nombre),
      ...marcadoresDeVentana(contacto?.fecha_alta ?? null),
      ...marcadoresDeFecha(),
      hoja_ruta: enlaceHojaDeRuta(enVentana ? contacto?.token ?? null : null),
    };
    const delPanel = await cargarMailSecuencia(
      "hoja_ruta_abandono",
      1,
      "es",
      marcadores,
      { si_ventana: enVentana, si_no_ventana: !enVentana }
    );

    let cuerpo = delPanel
      ? delPanel.cuerpo
      : mailAbandonoCuerpo(reserva.nombre, enVentana ? "ventana" : "evergreen");
    // Por si el texto trae un enlace escrito a mano en vez del {{hoja_ruta}}.
    if (enVentana && contacto?.token) cuerpo = personalizarEnlacesHojaDeRuta(cuerpo, contacto.token);
    const html = wrapNurture(cuerpo, reserva.email, false);

    try {
      await sendEmail(
        reserva.nombre ? `${reserva.nombre} <${reserva.email}>` : reserva.email,
        delPanel?.asunto || MAIL_ABANDONO_ASUNTO,
        html,
        resolveNewsletterFrom(delPanel?.remitente ?? "entrenatzaile@alainzulaika.com")
      );
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      console.error("cron: error enviando el aviso de abandono:", reserva.email, err);
      // Se libera el candado y NO se marca como enviado: la siguiente pasada
      // lo vuelve a intentar.
      await supabase
        .from("hoja_ruta_reservas")
        .update({ aviso_abandono_enviando_desde: null, aviso_abandono_error: mensaje })
        .eq("id", reserva.id);
      continue;
    }

    await supabase
      .from("hoja_ruta_reservas")
      .update({
        aviso_abandono_enviado: true,
        aviso_abandono_en: new Date().toISOString(),
        aviso_abandono_enviando_desde: null,
        aviso_abandono_error: null,
      })
      .eq("id", reserva.id);
    enviados++;
  }

  return enviados;
}

// ============================================================
// Huecos apartados que vencieron sin pago
// ============================================================
//
// El correo de reserva promete "te guardo el hueco 24 horas; si en ese plazo
// no está el pago, lo libero". Esto es lo que cumple esa frase. Hasta ahora no
// la cumplía nadie: el hueco se quedaba cogido para siempre.
//
// El camino principal es este cron, no el webhook checkout.session.expired.
// El webhook adelanta el estado cuando llega, pero puede tardar o no llegar,
// y si la liberación viviera en los dos sitios habría dos caminos compitiendo
// por el mismo correo. Aquí ocurre siempre y ocurre una vez.
//
// Va en dos pasadas a propósito:
//
//   1. Liberar. El update condicionado sobre pago_estado='pendiente' es el
//      candado: solo una ejecución se queda cada fila.
//   2. Avisar, leyendo las ya liberadas que aún no tienen correo. Si Mailjet
//      está caído, el hueco se libera igual (que es lo urgente: hay que poder
//      vendérselo a otro) y el correo sale en la pasada siguiente. Juntarlo
//      todo en un paso haría que un fallo de correo dejara el hueco cogido.

async function liberarHuecosVencidos(): Promise<number> {
  const { data: vencidas, error } = await supabase
    .from("hoja_ruta_reservas")
    .select("id, hueco, stripe_session_id")
    .eq("pago_estado", "pendiente")
    .lt("stripe_session_expira_en", new Date().toISOString());

  if (error) {
    console.error("cron: error buscando huecos vencidos (¿falta la columna?):", error);
    return 0;
  }
  if (!vencidas?.length) return 0;

  let liberados = 0;

  for (const reserva of vencidas) {
    // Expirar la sesión en Stripe ANTES de soltar el hueco. Si no, entre que
    // se libera y se le da a otra persona, esta podría pagar una sesión que
    // sigue viva y aparecer un cobro sin llamada.
    if (reserva.stripe_session_id) {
      try {
        await getStripe().checkout.sessions.expire(reserva.stripe_session_id);
      } catch {
        // Stripe se niega a expirar una sesión que ya está completada o
        // expirada. Lo primero es justo la carrera que hay que respetar:
        // acaba de pagar mientras mirábamos. Se comprueba, y si pagó no se
        // le toca el hueco — el webhook lo confirmará.
        try {
          const sesion = await getStripe().checkout.sessions.retrieve(reserva.stripe_session_id);
          if (sesion.status === "complete" || sesion.payment_status === "paid") {
            console.warn("cron: no se libera, pagó mientras expiraba:", reserva.id);
            continue;
          }
        } catch (err) {
          // Ni expirar ni consultar. Se deja para la pasada siguiente en vez
          // de liberar a ciegas un hueco que podría estar pagado.
          console.error("cron: no se pudo comprobar la sesión, se pospone:", reserva.id, err);
          continue;
        }
      }
    }

    // El candado. Si otra pasada (o el webhook) ya movió el estado, esto no
    // devuelve fila y aquí no se hace nada.
    //
    // El hueco se guarda en hueco_liberado antes de soltarlo: si esta persona
    // acaba pagando un segundo después, el aviso de "cobro sin hueco" tiene
    // que poder decir qué llamada tenía apartada para poder recolocarla.
    const { data: liberada } = await supabase
      .from("hoja_ruta_reservas")
      .update({
        pago_estado: "expirado",
        hueco_liberado: reserva.hueco,
        hueco: null,
        hueco_en: null,
      })
      .eq("id", reserva.id)
      .eq("pago_estado", "pendiente")
      .select("id")
      .maybeSingle();

    if (liberada) liberados++;
  }

  return liberados;
}

async function avisarHuecosLiberados(): Promise<number> {
  const staleThreshold = new Date(Date.now() - CANDADO_STALE_MS).toISOString();

  const { data: pendientes, error } = await supabase
    .from("hoja_ruta_reservas")
    .select("id, nombre, email, variante")
    .eq("pago_estado", "expirado")
    .eq("aviso_liberado_enviado", false);

  if (error) {
    console.error("cron: error buscando avisos de liberación (¿falta la columna?):", error);
    return 0;
  }
  if (!pendientes?.length) return 0;

  // A quien se haya dado de baja no se le escribe, igual que en el aviso de
  // abandono.
  const { data: bajas } = await supabase
    .from("newsletter_contactos")
    .select("email")
    .eq("unsubscribed", true)
    .in("email", pendientes.map((r) => r.email));
  const dadosDeBaja = new Set((bajas ?? []).map((r) => r.email));

  let enviados = 0;

  for (const reserva of pendientes) {
    if (dadosDeBaja.has(reserva.email)) continue;

    const { data: claimed, error: claimError } = await supabase
      .from("hoja_ruta_reservas")
      .update({ aviso_liberado_enviando_desde: new Date().toISOString() })
      .eq("id", reserva.id)
      .eq("aviso_liberado_enviado", false)
      .or(`aviso_liberado_enviando_desde.is.null,aviso_liberado_enviando_desde.lt.${staleThreshold}`)
      .select("id");

    if (claimError) {
      console.error("cron: error al reclamar el aviso de liberación:", reserva.email, claimError);
      continue;
    }
    if (!claimed?.length) continue; // otra pasada lo tiene cogido

    // Sin personalizarEnlacesHojaDeRuta: esta persona estaba pagando, así que
    // el enlace va limpio a la versión de pago. Pasarlo por ahí sería el
    // camino por el que un impago acaba en un acceso gratis.
    const html = wrapNurture(mailLiberadoCuerpo(reserva.nombre, reserva.variante), reserva.email, false);

    try {
      await sendEmail(
        reserva.nombre ? `${reserva.nombre} <${reserva.email}>` : reserva.email,
        MAIL_LIBERADO_ASUNTO,
        html,
        resolveNewsletterFrom("entrenatzaile@alainzulaika.com")
      );
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      console.error("cron: error enviando el aviso de liberación:", reserva.email, err);
      // Candado liberado y NO marcado como enviado: la pasada siguiente lo
      // reintenta. Igual que en el resto del sistema, "enviado de verdad" solo
      // se pone después de que Mailjet lo confirme.
      await supabase
        .from("hoja_ruta_reservas")
        .update({ aviso_liberado_enviando_desde: null, aviso_liberado_error: mensaje.slice(0, 600) })
        .eq("id", reserva.id);
      continue;
    }

    await supabase
      .from("hoja_ruta_reservas")
      .update({
        aviso_liberado_enviado: true,
        aviso_liberado_en: new Date().toISOString(),
        aviso_liberado_enviando_desde: null,
        aviso_liberado_error: null,
      })
      .eq("id", reserva.id);
    enviados++;
  }

  return enviados;
}

export async function GET(req: Request) {
  // cron-job.org firma las peticiones con Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const cargarContactos = crearCargadorContactos();
  let procesadas = 0;

  // Campañas programadas que ya tocan
  const { data: campanas } = await supabase
    .from("newsletter_campanas")
    .select("*")
    .eq("estado", "programado")
    .lte("programado_para", new Date().toISOString());

  if (campanas?.length) {
    const contactos = await cargarContactos();

    for (const campana of contactos.length ? campanas : []) {
      // Candado: solo una ejecución del cron se queda la campaña
      const { data: claimed } = await supabase
        .from("newsletter_campanas")
        .update({ estado: "enviando" })
        .eq("id", campana.id)
        .eq("estado", "programado")
        .select("id");
      if (!claimed?.length) continue;

      await enviarCampana(campana as CampanaEnviable, contactos);
      procesadas++;
    }
  }

  const nurtureEnviados = await procesarNurture();
  const recordatorioEnviados = await procesarRecordatorioValoracion();
  const colaBEnviadas = await procesarColaB(cargarContactos);
  // Antes del aviso de abandono: liberar primero deja el pago_estado a
  // 'expirado', y ese es justo el filtro que impide que a quien se le acaba
  // de liberar el hueco le llegue además el "te quedaste a medias".
  const huecosLiberados = await liberarHuecosVencidos();
  const avisosLiberados = await avisarHuecosLiberados();
  const abandonosEnviados = await procesarReservasAbandonadas();

  return NextResponse.json({
    ok: true,
    procesadas,
    nurtureEnviados,
    recordatorioEnviados,
    colaBEnviadas,
    huecosLiberados,
    avisosLiberados,
    abandonosEnviados,
  });
}
