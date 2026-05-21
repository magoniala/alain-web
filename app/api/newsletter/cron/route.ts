import { createClient } from "@supabase/supabase-js";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const ses = new SESClient({
  region: process.env.AWS_SES_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY!,
  },
});
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://alainzulaika.com";

async function sendSESEmail(to: string, nombre: string | null, subject: string, html: string) {
  await ses.send(new SendEmailCommand({
    Source: "Alain Zulaika <contacto@niala.es>",
    Destination: { ToAddresses: [nombre ? `${nombre} <${to}>` : to] },
    ReplyToAddresses: ["contacto@niala.es"],
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: { Html: { Data: html, Charset: "UTF-8" } },
    },
  }));
}

function processText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" style="color:#2ED3E6;text-decoration:underline;">$1</a>');
}

function buildHtml(body: string, email: string, preheader?: string) {
  const htmlBody = body
    .trim()
    .split(/\n/)
    .map((line: string) => line.trim()
      ? `<p style="margin:0 0 1.2rem 0;">${processText(line)}</p>`
      : `<p style="margin:0 0 0.8rem 0;">&nbsp;</p>`
    )
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
    const hasEu = campana.subject_eu && campana.body_eu;
    const hasEs = campana.subject_es && campana.body_es;

    // If both languages provided: route by idioma. If only one: send to everyone.
    const euContactos = hasEu ? (hasEs ? contactos.filter(c => c.idioma === "eu") : contactos) : [];
    const esContactos = hasEs ? (hasEu ? contactos.filter(c => c.idioma !== "eu") : contactos) : [];

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

    const CONCURRENCY = 10;
    for (let i = 0; i < emails.length; i += CONCURRENCY) {
      await Promise.all(
        emails.slice(i, i + CONCURRENCY).map(({ email, nombre, subject, html }) =>
          sendSESEmail(email, nombre, subject, html)
        )
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
