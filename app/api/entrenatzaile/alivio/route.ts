import { createClient } from "@supabase/supabase-js";
import { sendEmail, resolveNewsletterFrom, type EmailAttachment } from "@/lib/email-ses";
import { ALIVIO_PDF, ALIVIO_TEXTOS } from "@/lib/alivio";
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/* ---------------------------------------------------------------------------
   Alta en la newsletter desde el desplegable de /alivio, y envío de la guía.

   Sólo pide el correo: es el único paso entre el botón y el PDF, y cada campo
   de más es gente que se cae por el camino. `nombre` queda a null, que la
   tabla lo admite — el resto de altas con nombre siguen igual.

   Mismo patrón que /api/entrenatzaile/guias: si el contacto ya existe no se
   reinserta (eso pisaría su origen y su nombre de alta), sólo se le fusionan
   las etiquetas que le falten. Las de aquí son "lumbago" y "alivio".
   --------------------------------------------------------------------------- */

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const TAGS = ["lumbago", "alivio"];

// El adjunto es opcional a propósito: si el PDF todavía no está en
// assets/nurture-pdfs, el alta se hace igual y el correo sale con el enlace de
// descarga. Perder un lead porque falte un archivo sería peor.
async function cargarPdf(): Promise<EmailAttachment[] | undefined> {
  try {
    const data = await readFile(
      join(process.cwd(), "assets/nurture-pdfs", ALIVIO_PDF.file),
      "base64"
    );
    return [{ filename: ALIVIO_PDF.nombre, contentType: "application/pdf", base64Content: data }];
  } catch {
    return undefined;
  }
}

export async function POST(req: Request) {
  const { email } = await req.json();

  if (!email?.trim()) {
    return NextResponse.json({ error: "Déjame tu email." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "Ese email no parece válido." }, { status: 400 });
  }

  const emailLower = email.trim().toLowerCase();

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
      nombre: null,
      idioma: "es",
      origen: "alivio",
      tags: TAGS,
      // Explícito, y no por omisión: la columna tiene DEFAULT true, así que
      // sin esta línea quien deja el correo aquí arrancaría la secuencia de
      // nurture de la Hoja de Ruta. De aquí se entra sólo a la newsletter
      // diaria — que es justo la que va a quien NO está en una secuencia.
      recibe_secuencia: false,
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
  const descargaUrl = `${BASE_URL}/api/nurture-pdf/${ALIVIO_PDF.slug}`;

  const pStyle = "margin:0 0 1.6rem 0;";

  const html = `
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
      <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">
        <p style="${pStyle}">Hola.</p>
        <p style="${pStyle}">Aquí tienes <strong>&ldquo;${ALIVIO_TEXTOS.titulo}&rdquo;</strong>, las tres páginas para el tirón de hoy. Va adjunta a este correo, y si tu cliente no te deja abrir adjuntos, <a href="${descargaUrl}" style="color:#C47800;">la descargas aquí</a>.</p>
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
      emailLower,
      `Aquí tienes "${ALIVIO_TEXTOS.titulo}"`,
      html,
      resolveNewsletterFrom(null),
      await cargarPdf()
    );
  } catch (err) {
    // El alta ya está hecha. Que falle el correo no debe devolver un error al
    // formulario: el desplegable le ofrece la descarga directa de todas formas.
    console.error("alivio email send error:", err);
  }

  return NextResponse.json({ ok: true });
}
