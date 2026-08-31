import { createClient } from "@supabase/supabase-js";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import { cargarMailSecuencia } from "@/lib/secuencia-mails";
import { comodinMail1, type UrlsMail1, urlsSecuencia } from "@/lib/secuencias-legacy";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: Request) {
  const { email, lang } = await req.json();
  const isEu = lang === "eu";
  const contactEmail = isEu ? "kontaktu@alainzulaika.com" : "contacto@alainzulaika.com";
  const host = req.headers.get("host") || "alainzulaika.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const BASE_URL = `${protocol}://${host}`;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }

  const { error: dbError } = await supabase
    .from("comodin_contactos")
    .insert({ email, idioma: lang || "es" });

  if (dbError && dbError.code !== "23505") {
    return NextResponse.json({ error: "Error al guardar." }, { status: 500 });
  }

  await supabase.from("newsletter_contactos")
    .upsert({ email, origen: "comodin" }, { onConflict: "email", ignoreDuplicates: true });

  const bajaUrl = `${BASE_URL}/api/comodin/baja?email=${encodeURIComponent(email)}`;
  const unsubscribeText = isEu ? "Utzi email hauek jasotzeari" : "Dejar de recibir estos emails";

  const wrap = (content: string) => `
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
      <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">
        ${content}
      </div>
      <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.95rem;color:#555;line-height:1.9;">
        <p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:${contactEmail}" style="color:#555;">${contactEmail}</a></p>
        <p style="margin:0;"><a href="${bajaUrl}" style="color:#555;">${unsubscribeText}</a></p>
      </div>
    </div>
  `;


  // El contenido vive en secuencia_mails (editable desde /admin). Si no hay
  // fila activa se usa la versión en código, que sigue en lib/secuencias-legacy.
  // Las mismas que usa el cron para los mails 2 y 3, desde un solo sitio:
  // repetidas aquí, un cambio de enlace se aplicaba al mail 1 y no a los
  // siguientes.
  const urlsMail1: UrlsMail1 = urlsSecuencia("comodin", email, isEu);
  const deLaTabla = await cargarMailSecuencia("comodin", 1, isEu ? "eu" : "es", urlsMail1);
  const enCodigo = comodinMail1(isEu, urlsMail1);

  await sendEmail(
    email,
    deLaTabla?.asunto || enCodigo.subject,
    wrap(deLaTabla ? deLaTabla.cuerpo : enCodigo.cuerpo),
    resolveNewsletterFrom(deLaTabla?.remitente),
    undefined,
    { campana: "comodin-m1", customId: email }
  );

  const mail2SendAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const mail3SendAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from("comodin_contactos")
    .update({ mail2_id: mail2SendAt, mail3_id: mail3SendAt })
    .eq("email", email);

  return NextResponse.json({ ok: true });
}
