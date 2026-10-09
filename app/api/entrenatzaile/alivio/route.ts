import { createClient } from "@supabase/supabase-js";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import { ALIVIO_CHECKOUT, ALIVIO_TEXTOS } from "@/lib/alivio";
import { NextResponse } from "next/server";

/* ---------------------------------------------------------------------------
   Alta en la newsletter desde la landing del lead magnet /alivio.

   Mismo patrón que /api/entrenatzaile/guias: si el contacto ya existe no se
   reinserta (eso pisaría su origen y su nombre de alta), solo se le fusionan
   las etiquetas que le falten. Las de aquí son "lumbago" y "alivio".
   --------------------------------------------------------------------------- */

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const TAGS = ["lumbago", "alivio"];

export async function POST(req: Request) {
  const { nombre, email } = await req.json();

  if (!nombre?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Por favor, rellena tu nombre y tu email." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "El email no es válido." }, { status: 400 });
  }

  const emailLower = email.trim().toLowerCase();
  const nombreTrim = nombre.trim();

  const normalizarTags = (arr: string[] | null | undefined) =>
    (arr ?? []).map((t) => t.toLowerCase());

  const { data: existente } = await supabase
    .from("newsletter_contactos")
    .select("tags")
    .eq("email", emailLower)
    .maybeSingle();

  let dbError;
  if (existente) {
    const tagsFusionadas = Array.from(new Set([...normalizarTags(existente.tags), ...TAGS]));
    ({ error: dbError } = await supabase
      .from("newsletter_contactos")
      .update({ tags: tagsFusionadas })
      .eq("email", emailLower));
  } else {
    ({ error: dbError } = await supabase.from("newsletter_contactos").insert({
      email: emailLower,
      nombre: nombreTrim,
      idioma: "es",
      origen: "alivio",
      tags: TAGS,
    }));
    if (dbError?.code === "23505") {
      // Carrera: alguien insertó este email entre el select y el insert.
      const { data: carrera } = await supabase
        .from("newsletter_contactos")
        .select("tags")
        .eq("email", emailLower)
        .maybeSingle();
      const tagsFusionadas = Array.from(new Set([...normalizarTags(carrera?.tags), ...TAGS]));
      ({ error: dbError } = await supabase
        .from("newsletter_contactos")
        .update({ tags: tagsFusionadas })
        .eq("email", emailLower));
    }
  }

  if (dbError) {
    console.error("alivio newsletter_contactos error:", dbError);
    return NextResponse.json({ error: "Ha ocurrido un error. Inténtalo de nuevo." }, { status: 500 });
  }

  const host = req.headers.get("host") || "";
  const BASE_URL = host.includes("localhost") ? `http://${host}` : "https://alainzulaika.com";
  const bajaUrl = `${BASE_URL}/api/newsletter/baja?email=${encodeURIComponent(emailLower)}`;

  const pStyle = "margin:0 0 1.6rem 0;";
  const nombrePila = nombreTrim.split(" ")[0];

  const html = `
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
      <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">
        <p style="${pStyle}">Hola, ${nombrePila}.</p>
        <p style="${pStyle}">Aquí tienes <strong>&ldquo;${ALIVIO_TEXTOS.titulo}&rdquo;</strong>, las tres páginas para el tirón de hoy: <a href="${ALIVIO_CHECKOUT}" style="color:#C47800;">descárgala aquí</a>. Es gratis y el acceso es inmediato.</p>
        <p style="${pStyle}">Léela antes de moverte. El filtro del principio está para eso: si dice que hoy toca parar, paras.</p>
        <p style="${pStyle}">A partir de ahora te voy a escribir sobre entrenamiento y salud para gente de tu edad: útil, breve y sin relleno. Si en algún momento no te aporta, te das de baja abajo en un clic.</p>
        <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
        <p style="font-size:1.15rem;color:#1a1a1a;line-height:2.1;margin-top:0.5rem;"><strong>Pd:</strong> Si respondes a este mail con un "hola" me ayudas a que gmail entienda que esto no es spam, gracias.</p>
      </div>
      <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.95rem;color:#555;line-height:1.9;">
        <p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:contacto@alainzulaika.com" style="color:#555;">contacto@alainzulaika.com</a></p>
        <p style="margin:0;"><a href="${bajaUrl}" style="color:#555;">Dejar de recibir estos emails</a></p>
      </div>
    </div>
  `;

  try {
    await sendEmail(
      `${nombreTrim} <${emailLower}>`,
      `Aquí tienes "${ALIVIO_TEXTOS.titulo}"`,
      html,
      resolveNewsletterFrom(null)
    );
  } catch (err) {
    // El alta ya está hecha. Que falle el correo no debe devolver un error al
    // formulario: la página le manda al checkout de Whop de todas formas.
    console.error("alivio email send error:", err);
  }

  return NextResponse.json({ ok: true });
}
