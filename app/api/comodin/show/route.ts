import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  const { email } = await req.json();
  const host = req.headers.get("host") || "alainzulaika.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const BASE_URL = `${protocol}://${host}`;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }

  const { error: dbError } = await supabase
    .from("comodin_contactos")
    .insert({ email });

  if (dbError && dbError.code !== "23505") {
    return NextResponse.json({ error: "Error al guardar." }, { status: 500 });
  }

  const showUrl = `${BASE_URL}/es/comodin/show`;
  const bajaUrl = `${BASE_URL}/api/comodin/baja?email=${encodeURIComponent(email)}`;

  await resend.emails.send({
    from: "Alain Zulaika <contacto@niala.es>",
    to: email,
    replyTo: "contacto@niala.es",
    subject: "El link al show",
    html: `
      <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
        <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">
          <p style="margin:0 0 1.6rem 0;">Aquí lo tienes.</p>
          <p style="margin:0 0 1.6rem 0;"><a href="${showUrl}" style="color:#2a9d8f;font-weight:bold;">Convierte tu salón en un microteatro — el show completo</a></p>
          <p style="margin:0 0 1.6rem 0;">18 minutos.<br>Disfrútalo.</p>
          <p style="margin:0 0 1.6rem 0;">Y si después de verlo te entran ganas de aprender algún truco,<br>respóndeme a este mail.<br>Me encanta saber cómo llegáis a esto.</p>
        </div>
        <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.95rem;color:#555;line-height:1.9;">
          <p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:contacto@niala.es" style="color:#555;">contacto@niala.es</a></p>
          <p style="margin:0;"><a href="${bajaUrl}" style="color:#555;">Dejar de recibir estos emails</a></p>
        </div>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
