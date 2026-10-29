import { createClient } from "@supabase/supabase-js";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import { cargarMailSecuencia } from "@/lib/secuencia-mails";
import { misionMail1, type UrlsMail1, urlsSecuencia } from "@/lib/secuencias-legacy";
import { altaEmbudo } from "@/lib/embudos";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: Request) {
  const { email, lang } = await req.json();
  const isEu = lang === "eu";
  const contactEmail = isEu ? "info@alainzulaika.com" : "contacto@alainzulaika.com";
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

  // Alta en la newsletter según el embudo «tumision» (ver lib/embudos.ts):
  // hoy, solo la diaria; los mails 1 y 2 los lleva esta ruta y el cron de
  // /api/sequence con mision_contactos. A quien ya estaba no se le toca nada.
  await altaEmbudo({ origen: "tumision", email, idioma: isEu ? "eu" : "es" });

  // Ya estaba apuntado: ni se le reenvía el mail 1 ni se le reprograman el 2
  // y el 3. Antes, enviar el formulario otra vez reiniciaba la secuencia.
  if (dbError?.code === "23505") return NextResponse.json({ ok: true });

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
  // Las mismas que usa el cron para los mails 2 y 3, desde un solo sitio:
  // repetidas aquí, un cambio de enlace se aplicaba al mail 1 y no a los
  // siguientes.
  const urlsMail1: UrlsMail1 = urlsSecuencia("mision", email, isEu);
  const deLaTabla = await cargarMailSecuencia("mision", 1, isEu ? "eu" : "es", urlsMail1);
  const enCodigo = misionMail1(isEu, urlsMail1);

  await sendEmail(
    email,
    deLaTabla?.asunto || enCodigo.subject,
    wrap(deLaTabla ? deLaTabla.cuerpo : enCodigo.cuerpo),
    resolveNewsletterFrom(deLaTabla?.remitente),
    undefined,
    { campana: "mision-m1", customId: email, idioma: isEu ? "eu" : "es" }
  );

  const mail2SendAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  // Sin mail 3: ver PROGRAMADOS en app/api/sequence/cron.
  await supabase
    .from("mision_contactos")
    .update({ mail2_id: mail2SendAt, mail3_id: null })
    .eq("email", email);

  return NextResponse.json({ ok: true });
}
