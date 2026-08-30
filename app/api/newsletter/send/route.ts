import { createClient } from "@supabase/supabase-js";
import { sendEmailBatch, resolveNewsletterFrom } from "@/lib/email-ses";
import { requireAdminAuth } from "@/lib/admin-auth";
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
      <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">
        ${htmlBody}
      </div>
      <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.9rem;color:#555;line-height:2;">
        <p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:${contactEmail}" style="color:#555;">${contactEmail}</a></p>
        <p style="margin:0;"><a href="${BASE_URL}/newsletter/idioma?email=${encodeURIComponent(email)}" style="color:#bbb;">Cambiar idioma</a> · <a href="${BASE_URL}/api/newsletter/baja?email=${encodeURIComponent(email)}" style="color:#bbb;">Dejar de recibir estos emails</a></p>
      </div>
    </div>
  `;
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { subject_eu, body_eu, preheader_eu, subject_es, body_es, preheader_es, test_emails, remitente } = await req.json();

  const hasEu = subject_eu?.trim() && body_eu?.trim();
  const hasEs = subject_es?.trim() && body_es?.trim();

  if (!hasEu && !hasEs) {
    return NextResponse.json({ error: "Faltan campos." }, { status: 400 });
  }

  const from = resolveNewsletterFrom(remitente);
  const testList: string[] = Array.isArray(test_emails) ? test_emails.map((e: string) => e.trim()).filter(Boolean) : [];

  if (testList.length > 0) {
    const emails = [
      ...(hasEu ? testList.map(email => ({ email, subject: `[PRUEBA] ${subject_eu}`, html: buildHtml(body_eu, email, preheader_eu, true) })) : []),
      ...(hasEs ? testList.map(email => ({ email, subject: `[PRUEBA] ${subject_es}`, html: buildHtml(body_es, email, preheader_es, false) })) : []),
    ];
    await sendEmailBatch(emails.map(({ email, subject, html }) => ({ to: email, subject, html })), from);
    return NextResponse.json({ ok: true, enviados: testList.length, eu: hasEu ? testList.length : 0, es: hasEs ? testList.length : 0, prueba: true });
  }

  // Excluye a quien esté activo en una secuencia de nurture (recibe_secuencia=true
  // y aún no la ha completado) — vuelve a recibir el newsletter normal en cuanto
  // se le marca como reservado o termina la secuencia.
  const { data: contactos, error } = await supabase
    .from("newsletter_contactos")
    .select("email, nombre, idioma")
    .eq("unsubscribed", false)
    .or("recibe_secuencia.eq.false,secuencia_completada.eq.true");

  if (error || !contactos) {
    return NextResponse.json({ error: "Error al obtener contactos." }, { status: 500 });
  }

  // If both languages provided: route by idioma. If only one: send to everyone.
  const euContactos = hasEu ? (hasEs ? contactos.filter(c => c.idioma === "eu") : contactos) : [];
  const esContactos = hasEs ? (hasEu ? contactos.filter(c => c.idioma !== "eu") : contactos) : [];

  const euEmails = euContactos.map(({ email, nombre }) => ({
    email, nombre,
    subject: subject_eu,
    html: buildHtml(body_eu, email, preheader_eu, true),
  }));

  const esEmails = esContactos.map(({ email, nombre }) => ({
    email, nombre,
    subject: subject_es,
    html: buildHtml(body_es, email, preheader_es, false),
  }));

  const allEmails = [...euEmails, ...esEmails];
  const BATCH = 50;
  for (let i = 0; i < allEmails.length; i += BATCH) {
    await sendEmailBatch(
      allEmails.slice(i, i + BATCH).map(({ email, nombre, subject, html }) => ({
        to: nombre ? `${nombre} <${email}>` : email,
        subject,
        html,
      })),
      from
    );
  }

  // Se deja constancia en newsletter_campanas: alimenta el histórico de
  // "Enviadas" y, sobre todo, hace que la cola B sepa que hoy ya ha salido algo.
  const ahora = new Date().toISOString();
  const { error: logError } = await supabase.from("newsletter_campanas").insert({
    subject_eu: hasEu ? subject_eu : null,
    body_eu: hasEu ? body_eu : null,
    preheader_eu: hasEu ? preheader_eu : null,
    subject_es: hasEs ? subject_es : null,
    body_es: hasEs ? body_es : null,
    preheader_es: hasEs ? preheader_es : null,
    programado_para: ahora,
    estado: "enviado",
    enviado_en: ahora,
    enviados_eu: euEmails.length,
    enviados_es: esEmails.length,
    remitente: resolveNewsletterFrom(remitente).replace(/^.*<(.+)>$/, "$1"),
  });
  if (logError) console.error("send: envío hecho pero no se pudo registrar la campaña:", logError);

  return NextResponse.json({ ok: true, enviados: allEmails.length, eu: euEmails.length, es: esEmails.length });
}
