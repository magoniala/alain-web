import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://alainzulaika.com";

function processText(text: string): string {
  // Convert [text](url) markdown links to <a> tags
  return text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" style="color:#1a1a1a;text-decoration:underline;">$1</a>'
  );
}

function buildHtml(body: string, email: string, preheader?: string) {
  const htmlBody = body
    .trim()
    .split(/\n\n+/)
    .map((p: string) => `<p style="margin:0 0 1.6rem 0;">${processText(p.replace(/\n/g, "<br/>"))}</p>`)
    .join("");
  const preheaderHtml = preheader?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader.trim()}</div>`
    : "";
  return `
    ${preheaderHtml}
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
      <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">
        ${htmlBody}
      </div>
      <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.95rem;color:#555;line-height:1.9;">
        <p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:contacto@niala.es" style="color:#555;">contacto@niala.es</a></p>
        <p style="margin:0;"><a href="${BASE_URL}/api/newsletter/baja?email=${encodeURIComponent(email)}" style="color:#bbb;">Dejar de recibir estos emails</a></p>
      </div>
    </div>
  `;
}

export async function POST(req: Request) {
  const { password, subject_eu, body_eu, preheader_eu, subject_es, body_es, preheader_es } = await req.json();

  if (password !== process.env.NEWSLETTER_PASSWORD) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const hasEu = subject_eu?.trim() && body_eu?.trim();
  const hasEs = subject_es?.trim() && body_es?.trim();

  if (!hasEu && !hasEs) {
    return NextResponse.json({ error: "Faltan campos." }, { status: 400 });
  }

  const { data: contactos, error } = await supabase
    .from("newsletter_contactos")
    .select("email, nombre, idioma")
    .eq("unsubscribed", false);

  if (error || !contactos) {
    return NextResponse.json({ error: "Error al obtener contactos." }, { status: 500 });
  }

  // If both languages provided: route by idioma. If only one: send to everyone.
  const euContactos = hasEu ? (hasEs ? contactos.filter(c => c.idioma === "eu") : contactos) : [];
  const esContactos = hasEs ? (hasEu ? contactos.filter(c => c.idioma !== "eu") : contactos) : [];

  const toField = (email: string, nombre: string | null) =>
    nombre ? `${nombre} <${email}>` : email;

  const euEmails = euContactos.map(({ email, nombre }) => ({
    from: "Alain Zulaika <contacto@niala.es>",
    to: toField(email, nombre),
    replyTo: "contacto@niala.es",
    subject: subject_eu,
    html: buildHtml(body_eu, email, preheader_eu),
  }));

  const esEmails = esContactos.map(({ email, nombre }) => ({
    from: "Alain Zulaika <contacto@niala.es>",
    to: toField(email, nombre),
    replyTo: "contacto@niala.es",
    subject: subject_es,
    html: buildHtml(body_es, email, preheader_es),
  }));

  const allEmails = [...euEmails, ...esEmails];
  const BATCH = 100;
  for (let i = 0; i < allEmails.length; i += BATCH) {
    await resend.batch.send(allEmails.slice(i, i + BATCH));
  }

  return NextResponse.json({ ok: true, enviados: allEmails.length, eu: euEmails.length, es: esEmails.length });
}
