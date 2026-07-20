import { createClient } from "@supabase/supabase-js";
import { sendEmailBatch, resolveNewsletterFrom } from "@/lib/email-ses";
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

function buildHtml(body: string, email: string, preheader?: string) {
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
  return `
    ${preheaderHtml}
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
      <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">${htmlBody}</div>
      <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.9rem;color:#555;line-height:2;">
        <p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:contacto@niala.es" style="color:#555;">contacto@niala.es</a></p>
        <p style="margin:0;"><a href="${BASE_URL}/newsletter/idioma?email=${encodeURIComponent(email)}" style="color:#bbb;">Cambiar idioma</a> · <a href="${BASE_URL}/api/newsletter/baja?email=${encodeURIComponent(email)}" style="color:#bbb;">Dejar de recibir estos emails</a></p>
      </div>
    </div>
  `;
}

export async function GET(req: Request) {
  // Vercel signs cron requests with Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // Fetch due campaigns
  const { data: campanas, error } = await supabase
    .from("newsletter_campanas")
    .select("*")
    .eq("estado", "programado")
    .lte("programado_para", new Date().toISOString());

  if (error || !campanas?.length) {
    return NextResponse.json({ ok: true, procesadas: 0 });
  }

  const { data: contactos } = await supabase
    .from("newsletter_contactos")
    .select("email, nombre, idioma")
    .eq("unsubscribed", false);

  if (!contactos?.length) return NextResponse.json({ ok: true, procesadas: 0 });

  let procesadas = 0;

  for (const campana of campanas) {
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
    const euContactos = hasEu ? (hasEs ? contactos.filter(c => c.idioma === "eu" && !excluded.has(c.email.toLowerCase())) : contactos.filter(c => !excluded.has(c.email.toLowerCase()))) : [];
    const esContactos = hasEs ? (hasEu ? contactos.filter(c => c.idioma !== "eu" && !excluded.has(c.email.toLowerCase())) : contactos.filter(c => !excluded.has(c.email.toLowerCase()))) : [];

    const emails = [
      ...euContactos.map(({ email, nombre }) => ({
        email, nombre,
        subject: campana.subject_eu,
        html: buildHtml(campana.body_eu, email, campana.preheader_eu),
      })),
      ...esContactos.map(({ email, nombre }) => ({
        email, nombre,
        subject: campana.subject_es,
        html: buildHtml(campana.body_es, email, campana.preheader_es),
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

  return NextResponse.json({ ok: true, procesadas });
}
