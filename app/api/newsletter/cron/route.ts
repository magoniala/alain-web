import { createClient } from "@supabase/supabase-js";
import { sendEmail, sendEmailBatch, resolveNewsletterFrom } from "@/lib/email-ses";
import { wrapNurture, enviarMailSecuencia, CANDADO_STALE_MS, type NurtureContacto } from "@/lib/nurture";
import { MAIL_ABANDONO_ASUNTO, mailAbandonoCuerpo } from "@/lib/entrenatzaile-mails";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://alainzulaika.com";

function processText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:bold;">$1</strong>')
    .replace(/_(.+?)_/g, '<em style="font-style:italic;">$1</em>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)]+)\)/g, '<a href="$2" style="color:#2ED3E6;text-decoration:underline;">$1</a>');
}

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

  const { data: contactos } = await supabase
    .from("newsletter_contactos")
    .select("id, email, nombre, idioma, posicion_secuencia, fecha_ultimo_mail_secuencia")
    .eq("recibe_secuencia", true)
    .eq("secuencia_completada", false)
    .eq("unsubscribed", false);

  for (const contacto of (contactos ?? []) as NurtureContacto[]) {
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
    .select("asunto, cuerpo_html, remitente")
    .eq("posicion", -1)
    .eq("activo", true)
    .maybeSingle();
  if (!mail) return 0;

  const { data: contactos } = await supabase
    .from("newsletter_contactos")
    .select("id, email, nombre, idioma, fecha_ultimo_mail_secuencia")
    .eq("recibe_secuencia", true)
    .eq("posicion_secuencia", 8)
    .eq("recordatorio_valoracion_enviado", false);

  let enviados = 0;
  const staleThreshold = new Date(Date.now() - CANDADO_STALE_MS).toISOString();

  for (const contacto of contactos ?? []) {
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
    const html = wrapNurture(mail.cuerpo_html ?? "", contacto.email, isEu);

    try {
      await sendEmail(
        contacto.nombre ? `${contacto.nombre} <${contacto.email}>` : contacto.email,
        mail.asunto ?? "",
        html,
        resolveNewsletterFrom(mail.remitente)
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

    const html = wrapNurture(mailAbandonoCuerpo(reserva.nombre, reserva.variante), reserva.email, false);

    try {
      await sendEmail(
        reserva.nombre ? `${reserva.nombre} <${reserva.email}>` : reserva.email,
        MAIL_ABANDONO_ASUNTO,
        html,
        resolveNewsletterFrom("entrenatzaile@alainzulaika.com")
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
  const abandonosEnviados = await procesarReservasAbandonadas();

  return NextResponse.json({
    ok: true,
    procesadas,
    nurtureEnviados,
    recordatorioEnviados,
    colaBEnviadas,
    abandonosEnviados,
  });
}
