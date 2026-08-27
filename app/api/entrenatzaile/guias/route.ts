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
import { cargarMailSecuencia } from "@/lib/secuencia-mails";
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
  const tags = ["entrenamiento", VARIANTE_TAG[variante]];

  const principal = GUIA_PRINCIPAL[variante];
  const extras = GUIAS_ANUNCIADAS_EXTRA[variante];
  const sorpresa = GUIA_SORPRESA[variante];
  const archivos = [principal, ...extras, ...(sorpresa ? [sorpresa] : [])];

  // Normaliza tags previas (pudieron quedar en mayúsculas o con la vieja
  // etiqueta "GUIAS" de versiones anteriores de este endpoint) antes de
  // fusionarlas con las nuevas.
  const normalizarTags = (arr: string[] | null | undefined) =>
    (arr ?? []).map((t) => t.toLowerCase()).filter((t) => t !== "guias");

  // Si el contacto ya existía (de antes de que existiera este sistema de tags,
  // o de una visita anterior a /guias con otra variante activa), no lo
  // volvemos a insertar (eso pisaría origen/nombre/idioma de su alta
  // original) — solo le fusionamos la etiqueta de variante que le falte.
  const { data: existente } = await supabase
    .from("newsletter_contactos")
    .select("tags")
    .eq("email", emailLower)
    .maybeSingle();

  let dbError;
  if (existente) {
    const tagsFusionadas = Array.from(new Set([...normalizarTags(existente.tags), ...tags]));
    ({ error: dbError } = await supabase
      .from("newsletter_contactos")
      .update({ tags: tagsFusionadas })
      .eq("email", emailLower));
  } else {
    ({ error: dbError } = await supabase.from("newsletter_contactos").insert({
      email: emailLower,
      nombre: nombreTrim,
      idioma: "es",
      origen: "guias",
      tags,
    }));
    if (dbError?.code === "23505") {
      // Carrera: alguien insertó este email justo entre el select y el insert.
      // Nos comportamos como si hubiera existido: fusionamos tags.
      const { data: carrera } = await supabase
        .from("newsletter_contactos")
        .select("tags")
        .eq("email", emailLower)
        .maybeSingle();
      const tagsFusionadas = Array.from(new Set([...normalizarTags(carrera?.tags), ...tags]));
      ({ error: dbError } = await supabase
        .from("newsletter_contactos")
        .update({ tags: tagsFusionadas })
        .eq("email", emailLower));
    }
  }

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
        <p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:contacto@alainzulaika.com" style="color:#555;">contacto@alainzulaika.com</a></p>
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

    // La lista de guías y el párrafo de la sorpresa se calculan aquí porque
    // dependen de la variante activa; el correo solo los coloca donde toque.
    const mailBD = await cargarMailSecuencia("guias", 1, "es", {
      nombre: nombreTrim.split(" ")[0],
      guias: listaAnunciadas,
      sorpresa: sorpresaHtml,
      extra_asunto: sorpresa ? " (+1 de regalo)" : "",
    });

    await sendEmail(
      `${nombreTrim} <${emailLower}>`,
      mailBD?.asunto || (sorpresa ? "Aquí tienes tus guías (+1 de regalo)" : "Aquí tienes tus guías"),
      wrap(
        mailBD?.cuerpo ??
          `
        <p style="${pStyle}">Hola, ${nombreTrim.split(" ")[0]}.</p>
        <p style="${pStyle}">Aquí tienes las tres guías, adjuntas a este email:</p>
        <p style="${pStyle}">
          ${listaAnunciadas}
        </p>
        ${sorpresaHtml}
        <p style="${pStyle}">Además de las guías, te voy a escribir un correo diario sobre entrenamiento y salud para gente de tu edad: útil, breve y sin relleno. Si en algún momento no te aporta, te das de baja abajo en un clic.</p>
        <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
        <p style="font-size:1.15rem;color:#1a1a1a;line-height:2.1;margin-top:0.5rem;"><strong>Pd:</strong> Si respondes a este mail con un "hola" me ayudas a que gmail entienda que esto no es spam, gracias.</p>
      `
      ),
      resolveNewsletterFrom(mailBD?.remitente),
      attachments
    );
  } catch (err) {
    console.error("guias email send error:", err);
    return NextResponse.json({ error: "Ha ocurrido un error enviando las guías. Inténtalo de nuevo." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
