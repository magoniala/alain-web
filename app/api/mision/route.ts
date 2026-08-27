import { createClient } from "@supabase/supabase-js";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import { cargarMailSecuencia } from "@/lib/secuencia-mails";
import { misionMail1, type UrlsMail1 } from "@/lib/secuencias-legacy";
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
    .from("mision_contactos")
    .insert({ email, idioma: lang || "es" });

  if (dbError && dbError.code !== "23505") {
    return NextResponse.json({ error: "Error al guardar." }, { status: 500 });
  }

  await supabase.from("newsletter_contactos")
    .upsert({ email, origen: "tumision" }, { onConflict: "email", ignoreDuplicates: true });

  const tutorialUrl = isEu
    ? `${BASE_URL}/tumision/tutorial`
    : `${BASE_URL}/es/tumision/tutorial`;
  const euskeraUrl = `${BASE_URL}/api/mision/idioma?email=${encodeURIComponent(email)}&idioma=eu`;
  const castellanoUrl = `${BASE_URL}/api/mision/idioma?email=${encodeURIComponent(email)}&idioma=es`;
  const contactoUrl = isEu ? `${BASE_URL}/contacto` : `${BASE_URL}/es/contacto`;
  const entrenamientoUrl = `mailto:${contactEmail}?subject=Entrenamiento&body=Hola%20Alain%2C%20inf%C3%B3rmame%20sobre%20c%C3%B3mo%20trabajas.`;
  const bajaUrl = `${BASE_URL}/api/mision/baja?email=${encodeURIComponent(email)}`;
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
  const urlsMail1: UrlsMail1 = {
    tutorial: tutorialUrl,
    cambiar_idioma: isEu ? castellanoUrl : euskeraUrl,
    contacto: contactoUrl,
    entrenamiento: entrenamientoUrl,
  };
  const deLaTabla = await cargarMailSecuencia("mision", 1, isEu ? "eu" : "es", urlsMail1);
  const enCodigo = misionMail1(isEu, urlsMail1);

  await sendEmail(
    email,
    deLaTabla?.asunto || enCodigo.subject,
    wrap(deLaTabla ? deLaTabla.cuerpo : enCodigo.cuerpo),
    resolveNewsletterFrom(deLaTabla?.remitente)
  );

  const mail2SendAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const mail3SendAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from("mision_contactos")
    .update({ mail2_id: mail2SendAt, mail3_id: mail3SendAt })
    .eq("email", email);

  return NextResponse.json({ ok: true });
}
