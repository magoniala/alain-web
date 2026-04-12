import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://alainzulaika.com";

export async function POST(req: Request) {
  const { password, subject, body } = await req.json();

  if (password !== process.env.NEWSLETTER_PASSWORD) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Faltan campos." }, { status: 400 });
  }

  const { data: contactos, error } = await supabase
    .from("newsletter_contactos")
    .select("email")
    .eq("unsubscribed", false);

  if (error || !contactos) {
    return NextResponse.json({ error: "Error al obtener contactos." }, { status: 500 });
  }

  const htmlBody = body
    .trim()
    .split(/\n\n+/)
    .map((p: string) => `<p style="margin:0 0 1.6rem 0;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const emails = contactos.map(({ email }) => ({
    from: "Alain Zulaika <contacto@niala.es>",
    to: email,
    replyTo: "contacto@niala.es",
    subject,
    html: `
      <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
        <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">
          ${htmlBody}
        </div>
        <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.95rem;color:#555;line-height:1.9;">
          <p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:contacto@niala.es" style="color:#555;">contacto@niala.es</a></p>
          <p style="margin:0;"><a href="${BASE_URL}/api/newsletter/baja?email=${encodeURIComponent(email)}" style="color:#bbb;">Dejar de recibir estos emails</a></p>
        </div>
      </div>
    `,
  }));

  // Send in batches of 100
  const BATCH = 100;
  for (let i = 0; i < emails.length; i += BATCH) {
    await resend.batch.send(emails.slice(i, i + BATCH));
  }

  return NextResponse.json({ ok: true, enviados: emails.length });
}
