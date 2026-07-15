import { createClient } from "@supabase/supabase-js";
import { sendEmail, type EmailAttachment } from "@/lib/email-ses";
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Las 3 primeras son las que se anuncian en la landing. La 4ª es un extra
// sorpresa que no se promete en ningún sitio — parte del "3+1 inesperado".
const GUIAS = [
  { file: "espalda.pdf", name: "Por qué tu espalda siempre vuelve a fallar.pdf" },
  { file: "ereccion-50.pdf", name: "Lo que nadie te cuenta sobre la erección después de los 50.pdf" },
  { file: "correr-rodillas.pdf", name: "Correr no te destroza las rodillas.pdf" },
  { file: "ejercicio-espalda-bonus.pdf", name: "El mejor ejercicio para tu espalda no es el que crees.pdf" },
];

async function loadAttachments(): Promise<EmailAttachment[]> {
  const attachments = await Promise.all(
    GUIAS.map(async ({ file, name }) => {
      const data = await readFile(join(process.cwd(), "assets/guias", file), "base64");
      return { filename: name, contentType: "application/pdf", base64Content: data };
    })
  );
  return attachments;
}

export async function POST(req: Request) {
  const body = await req.json();
  const { nombre, email } = body;

  if (!nombre?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Por favor, rellena tu nombre y tu email." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "El email no es válido." }, { status: 400 });
  }

  const emailLower = email.trim().toLowerCase();
  const nombreTrim = nombre.trim();

  const { error: dbError } = await supabase.from("newsletter_contactos").upsert(
    {
      email: emailLower,
      nombre: nombreTrim,
      idioma: "es",
      origen: "entrenatzaile_guias",
    },
    { onConflict: "email", ignoreDuplicates: true }
  );

  if (dbError) {
    console.error("guias newsletter_contactos error:", dbError);
    return NextResponse.json({ error: "Ha ocurrido un error. Inténtalo de nuevo." }, { status: 500 });
  }

  const host = req.headers.get("host") || "";
  const BASE_URL = host.includes("localhost") ? `http://${host}` : "https://alainzulaika.com";
  const bajaUrl = `${BASE_URL}/api/newsletter/baja?email=${encodeURIComponent(emailLower)}`;

  const pStyle = "margin:0 0 1.6rem 0;";
  const wrap = (content: string) => `
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
      <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">
        ${content}
      </div>
      <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.95rem;color:#555;line-height:1.9;">
        <p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:contacto@niala.es" style="color:#555;">contacto@niala.es</a></p>
        <p style="margin:0;"><a href="${bajaUrl}" style="color:#555;">Dejar de recibir estos emails</a></p>
      </div>
    </div>
  `;

  try {
    const attachments = await loadAttachments();
    await sendEmail(
      `${nombreTrim} <${emailLower}>`,
      "Aquí tienes tus guías (+1 de regalo)",
      wrap(`
        <p style="${pStyle}">Hola, ${nombreTrim.split(" ")[0]}.</p>
        <p style="${pStyle}">Aquí tienes las tres guías, adjuntas a este email:</p>
        <p style="${pStyle}">
          — <strong>Por qué tu espalda siempre vuelve a fallar</strong><br>
          — Lo que nadie te cuenta sobre la erección después de los 50<br>
          — Correr no te destroza las rodillas
        </p>
        <p style="${pStyle}">Y de propina, una que no anunciaba en la web pero que le va bien a la primera: <strong>&ldquo;El mejor ejercicio para tu espalda no es el que crees&rdquo;</strong>.</p>
        <p style="${pStyle}">Además de las guías, te voy a escribir un correo diario sobre entrenamiento y salud para gente de tu edad: útil, breve y sin relleno. Si en algún momento no te aporta, te das de baja abajo en un clic.</p>
        <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
        <p style="font-size:1.15rem;color:#1a1a1a;line-height:2.1;margin-top:0.5rem;"><strong>Pd:</strong> Si respondes a este mail con un "hola" me ayudas a que gmail entienda que esto no es spam, gracias.</p>
      `),
      "Alain Zulaika <contacto@niala.es>",
      attachments
    );
  } catch (err) {
    console.error("guias email send error:", err);
    return NextResponse.json({ error: "Ha ocurrido un error enviando las guías. Inténtalo de nuevo." }, { status: 500 });
  }

  const rowStyle = "padding:0.3rem 0.6rem;border-bottom:1px solid #eee;";
  const notifHtml = `
    <div style="font-family:monospace;max-width:560px;margin:0 auto;padding:1.5rem;color:#1a1a1a;background:#f8f8f8;border:1px solid #ddd;font-size:0.88rem;">
      <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.12em;color:#999;margin:0 0 1rem 0;">ENTRENATZAILE · GUÍAS</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="${rowStyle}"><strong>Nombre</strong></td><td style="${rowStyle}">${nombreTrim}</td></tr>
        <tr><td style="${rowStyle}"><strong>Email</strong></td><td style="${rowStyle}">${emailLower}</td></tr>
      </table>
    </div>
  `;

  await sendEmail(
    "newsletter@niala.es",
    `Entrenatzaile — Nueva descarga de guías: ${nombreTrim}`,
    notifHtml,
    "Entrenatzaile <contacto@niala.es>"
  );

  return NextResponse.json({ ok: true });
}
