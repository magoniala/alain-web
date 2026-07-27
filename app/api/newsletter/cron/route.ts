import { createClient } from "@supabase/supabase-js";
import { sendEmail, sendEmailBatch, resolveNewsletterFrom } from "@/lib/email-ses";
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

function wrapNurture(cuerpoHtml: string, email: string, isEu: boolean) {
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

interface NurtureContacto {
  id: string;
  email: string;
  nombre: string | null;
  idioma: string | null;
  posicion_secuencia: number;
  fecha_ultimo_mail_secuencia: string | null;
}

async function procesarNurture(): Promise<number> {
  const now = new Date();
  let enviados = 0;

  const { data: contactos } = await supabase
    .from("newsletter_contactos")
    .select("id, email, nombre, idioma, posicion_secuencia, fecha_ultimo_mail_secuencia")
    .eq("recibe_secuencia", true)
    .eq("secuencia_completada", false)
    .eq("unsubscribed", false);

  for (const contacto of (contactos ?? []) as NurtureContacto[]) {
    if (contacto.fecha_ultimo_mail_secuencia) {
      const ultimoEnvio = new Date(contacto.fecha_ultimo_mail_secuencia);
      if (now.getTime() - ultimoEnvio.getTime() < 24 * 60 * 60 * 1000) continue;
    }

    const { data: mail } = await supabase
      .from("secuencia_mails")
      .select("posicion, asunto, cuerpo_html")
      .eq("posicion", contacto.posicion_secuencia)
      .eq("activo", true)
      .maybeSingle();

    if (!mail) continue; // sin contenido cargado para esta posición todavía

    // Claim atómico: solo seguimos si nadie más ha tocado este contacto desde la lectura.
    let claimQuery = supabase
      .from("newsletter_contactos")
      .update({ fecha_ultimo_mail_secuencia: now.toISOString() })
      .eq("id", contacto.id)
      .eq("posicion_secuencia", contacto.posicion_secuencia);
    claimQuery = contacto.fecha_ultimo_mail_secuencia
      ? claimQuery.eq("fecha_ultimo_mail_secuencia", contacto.fecha_ultimo_mail_secuencia)
      : claimQuery.is("fecha_ultimo_mail_secuencia", null);
    const { data: claimed } = await claimQuery.select("id");
    if (!claimed?.length) continue;

    const isEu = contacto.idioma === "eu";
    const html = wrapNurture(mail.cuerpo_html ?? "", contacto.email, isEu);

    try {
      await sendEmail(
        contacto.nombre ? `${contacto.nombre} <${contacto.email}>` : contacto.email,
        mail.asunto ?? "",
        html,
        resolveNewsletterFrom()
      );
    } catch (err) {
      console.error("nurture send error:", contacto.email, err);
      continue; // fecha_ultimo_mail_secuencia ya quedó marcada; reintenta mañana en la misma posición
    }

    const siguientePosicion = contacto.posicion_secuencia + 1;
    const { count: quedan } = await supabase
      .from("secuencia_mails")
      .select("posicion", { count: "exact", head: true })
      .gte("posicion", siguientePosicion)
      .eq("activo", true);

    await supabase
      .from("newsletter_contactos")
      .update({
        posicion_secuencia: siguientePosicion,
        secuencia_completada: (quedan ?? 0) === 0,
      })
      .eq("id", contacto.id);

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

  let procesadas = 0;

  // Fetch due campaigns
  const { data: campanas } = await supabase
    .from("newsletter_campanas")
    .select("*")
    .eq("estado", "programado")
    .lte("programado_para", new Date().toISOString());

  if (campanas?.length) {
    const { data: contactos } = await supabase
      .from("newsletter_contactos")
      .select("email, nombre, idioma")
      .eq("unsubscribed", false);

    for (const campana of contactos?.length ? campanas : []) {
      // Mark as in-progress immediately so concurrent cron runs don't re-send
      await supabase
        .from("newsletter_campanas")
        .update({ estado: "enviando" })
        .eq("id", campana.id)
        .eq("estado", "programado");

      const hasEu = campana.subject_eu && campana.body_eu;
      const hasEs = campana.subject_es && campana.body_es;
      const excluded = new Set((campana.excluidos ?? []).map((e: string) => e.toLowerCase()));

      // If both languages provided: route by idioma. If only one: send to everyone.
      const euContactos = hasEu ? (hasEs ? contactos!.filter(c => c.idioma === "eu" && !excluded.has(c.email.toLowerCase())) : contactos!.filter(c => !excluded.has(c.email.toLowerCase()))) : [];
      const esContactos = hasEs ? (hasEu ? contactos!.filter(c => c.idioma !== "eu" && !excluded.has(c.email.toLowerCase())) : contactos!.filter(c => !excluded.has(c.email.toLowerCase()))) : [];

      const emails = [
        ...euContactos.map(({ email, nombre }) => ({
          email, nombre,
          subject: campana.subject_eu,
          html: buildHtml(campana.body_eu, email, campana.preheader_eu, true),
        })),
        ...esContactos.map(({ email, nombre }) => ({
          email, nombre,
          subject: campana.subject_es,
          html: buildHtml(campana.body_es, email, campana.preheader_es, false),
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

      procesadas++;
    }
  }

  const nurtureEnviados = await procesarNurture();

  return NextResponse.json({ ok: true, procesadas, nurtureEnviados });
}
