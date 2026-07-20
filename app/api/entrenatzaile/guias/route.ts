import { createClient } from "@supabase/supabase-js";
import { sendEmail, resolveNewsletterFrom, type EmailAttachment } from "@/lib/email-ses";
import {
  getVarianteActual,
  VARIANTE_TAG,
  GUIA_PRINCIPAL,
  GUIAS_ANUNCIADAS_EXTRA,
  GUIA_SORPRESA,
  GUIA_INFO,
  type GuiaArchivo,
} from "@/lib/entrenatzaile-variantes";
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function loadAttachments(archivos: GuiaArchivo[]): Promise<EmailAttachment[]> {
  const attachments = await Promise.all(
    archivos.map(async ({ file, name }) => {
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

  const variante = await getVarianteActual("guias");
  const tags = ["ENTRENAMIENTO", "GUIAS", VARIANTE_TAG[variante]];

  const principal = GUIA_PRINCIPAL[variante];
  const extras = GUIAS_ANUNCIADAS_EXTRA[variante];
  const sorpresa = GUIA_SORPRESA[variante];
  const archivos = [principal, ...extras, ...(sorpresa ? [sorpresa] : [])];

  const { error: dbError } = await supabase.from("newsletter_contactos").upsert(
    {
      email: emailLower,
      nombre: nombreTrim,
      idioma: "es",
      origen: "entrenatzaile_guias",
      tags,
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

  const listaAnunciadas = [principal, ...extras]
    .map((g, i) => {
      const titulo = GUIA_INFO[g.file].titulo;
      return i === 0 ? `— <strong>${titulo}</strong>` : `— ${titulo}`;
    })
    .join("<br>\n          ");

  const sorpresaHtml = sorpresa
    ? `<p style="${pStyle}">Y de propina, una que no anunciaba en la web pero que le va bien a la primera: <strong>&ldquo;${GUIA_INFO[sorpresa.file].titulo}&rdquo;</strong>.</p>`
    : "";

  try {
    const attachments = await loadAttachments(archivos);
    await sendEmail(
      `${nombreTrim} <${emailLower}>`,
      sorpresa ? "Aquí tienes tus guías (+1 de regalo)" : "Aquí tienes tus guías",
      wrap(`
        <p style="${pStyle}">Hola, ${nombreTrim.split(" ")[0]}.</p>
        <p style="${pStyle}">Aquí tienes las tres guías, adjuntas a este email:</p>
        <p style="${pStyle}">
          ${listaAnunciadas}
        </p>
        ${sorpresaHtml}
        <p style="${pStyle}">Además de las guías, te voy a escribir un correo diario sobre entrenamiento y salud para gente de tu edad: útil, breve y sin relleno. Si en algún momento no te aporta, te das de baja abajo en un clic.</p>
        <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
        <p style="font-size:1.15rem;color:#1a1a1a;line-height:2.1;margin-top:0.5rem;"><strong>Pd:</strong> Si respondes a este mail con un "hola" me ayudas a que gmail entienda que esto no es spam, gracias.</p>
      `),
      resolveNewsletterFrom(),
      attachments
    );
  } catch (err) {
    console.error("guias email send error:", err);
    return NextResponse.json({ error: "Ha ocurrido un error enviando las guías. Inténtalo de nuevo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
