import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email-ses";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const TOTAL_PLAZAS = 10;
// Plazas ya ocupadas fuera de este formulario (peticiones directas antes de la landing).
const YA_RESERVADAS = 3;

export async function GET() {
  const { count, error } = await supabase
    .from("valoracion_entrenatzaile")
    .select("*", { count: "exact", head: true });

  if (error) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }

  const usadas = YA_RESERVADAS + (count ?? 0);
  return NextResponse.json(
    { remaining: Math.max(0, TOTAL_PLAZAS - usadas), full: usadas >= TOTAL_PLAZAS },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  const { nombre, edad, email, motivo, turno, newsletter } = body;

  if (!nombre?.trim() || !edad || !email?.trim() || !motivo?.trim() || !turno) {
    return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "El email no es válido." }, { status: 400 });
  }
  const edadNum = Number(edad);
  if (!Number.isFinite(edadNum) || edadNum < 14 || edadNum > 100) {
    return NextResponse.json({ error: "Introduce una edad válida." }, { status: 400 });
  }

  const { count, error: countError } = await supabase
    .from("valoracion_entrenatzaile")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("valoracion_entrenatzaile count error:", countError);
    return NextResponse.json({ error: "Ha ocurrido un error. Inténtalo de nuevo." }, { status: 500 });
  }

  if (YA_RESERVADAS + (count ?? 0) >= TOTAL_PLAZAS) {
    return NextResponse.json(
      { error: "Todas las plazas están cubiertas. Escribe a contacto@niala.es si quieres avisarte para futuras aperturas." },
      { status: 409 }
    );
  }

  const { error: dbError } = await supabase.from("valoracion_entrenatzaile").insert({
    nombre: nombre.trim(),
    edad: edadNum,
    email: email.trim().toLowerCase(),
    motivo: motivo.trim(),
    turno,
    newsletter: !!newsletter,
  });

  if (dbError) {
    console.error("valoracion_entrenatzaile insert error:", dbError);
    return NextResponse.json({ error: "Ha ocurrido un error. Inténtalo de nuevo." }, { status: 500 });
  }

  const remaining = Math.max(0, TOTAL_PLAZAS - YA_RESERVADAS - (count ?? 0) - 1);

  if (newsletter) {
    await supabase.from("newsletter_contactos").upsert(
      {
        email: email.trim().toLowerCase(),
        nombre: nombre.trim(),
        idioma: "es",
        origen: "entrenatzaile_valoracion",
      },
      { onConflict: "email", ignoreDuplicates: true }
    );

    const host = req.headers.get("host") || "www.alainzulaika.com";
    const protocol = host.includes("localhost") ? "http" : "https";
    const BASE_URL = `${protocol}://${host}`;
    const emailLower = email.trim().toLowerCase();
    const bajaUrl = `${BASE_URL}/api/newsletter/baja?email=${encodeURIComponent(emailLower)}`;
    const euskeraUrl = `${BASE_URL}/api/newsletter/idioma?email=${encodeURIComponent(emailLower)}&idioma=eu`;
    const contactoEsUrl = `${BASE_URL}/es/contacto`;

    const pdStyle = `font-size:1.15rem;color:#1a1a1a;line-height:2.1;margin-top:0.5rem;`;
    const linkStyle = `color:#2a9d8f;`;
    const pStyle = `margin:0 0 1.6rem 0;`;
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

    await sendEmail(
      nombre.trim() ? `${nombre.trim()} <${emailLower}>` : emailLower,
      "Bienvenido/a — ya tengo tu valoración",
      wrap(`
        <p style="${pStyle}">Hola, soy Alain.</p>
        <p style="${pStyle}">Ya tengo la información que me has enviado en el formulario. Te contacto en menos de 48h para agendar la llamada de valoración de 90 minutos.</p>
        <p style="${pStyle}">Mientras tanto, esto es lo que puedes esperar de mis mails: mago en los escenarios, entrenador personal online, y curioso de nacimiento y crecimiento.</p>
        <p style="${pStyle}">En mis mails vas a encontrar reflexiones, aprendizajes y anécdotas sobre entrenamiento, salud y magia — y lo que me apetezca contar.</p>
        <p style="${pStyle}">Sin frecuencia fija prometida, aunque lo habitual es que te escriba a diario.</p>
        <p style="margin:0 0 2rem 0;">Si en algún momento deja de interesarte, abajo tienes el botón para salir. Sin rollos.</p>
        <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
        <p style="${pdStyle}"><strong>Pd:</strong> Si no te quieres perder mis emails, mueve este ahora a tu bandeja principal.</p>
        <p style="${pdStyle}"><strong>Pd2:</strong> ¿Prefieres recibirlos en euskera? <a href="${euskeraUrl}" style="${linkStyle}">Clic aquí</a></p>
        <p style="${pdStyle}"><strong>Pd3:</strong> ¿Tienes un evento que hacer especial? <a href="${contactoEsUrl}" style="${linkStyle}">Haz clic aquí y hablemos.</a> Eventos de empresa, eventos culturales, fiestas privadas… Diez minutos de conversación suelen aclarar si tiene sentido.</p>
        <p style="${pdStyle}"><strong>Pd4:</strong> Si respondes a este mail con un "hola" me ayudas a que gmail entienda que esto no es spam, gracias.<br>Si encima me cuentas quien eres, como me has conocido, que esperas recibir en mis mails... me alegras el día.</p>
      `)
    );
  }

  const rowStyle = "padding:0.3rem 0.6rem;border-bottom:1px solid #eee;";
  const notifHtml = `
    <div style="font-family:monospace;max-width:560px;margin:0 auto;padding:1.5rem;color:#1a1a1a;background:#f8f8f8;border:1px solid #ddd;font-size:0.88rem;">
      <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.12em;color:#999;margin:0 0 1rem 0;">ENTRENATZAILE · VALORACIÓN GRATUITA</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="${rowStyle}"><strong>Nombre</strong></td><td style="${rowStyle}">${nombre.trim()}</td></tr>
        <tr><td style="${rowStyle}"><strong>Edad</strong></td><td style="${rowStyle}">${edadNum}</td></tr>
        <tr><td style="${rowStyle}"><strong>Email</strong></td><td style="${rowStyle}">${email.trim().toLowerCase()}</td></tr>
        <tr><td style="${rowStyle}"><strong>Turno</strong></td><td style="${rowStyle}">${turno}</td></tr>
        <tr><td style="${rowStyle}"><strong>Newsletter</strong></td><td style="${rowStyle}">${newsletter ? "Sí" : "No"}</td></tr>
        <tr><td style="${rowStyle}vertical-align:top;"><strong>Motivo</strong></td><td style="${rowStyle}">${motivo.trim()}</td></tr>
      </table>
      <p style="margin:1rem 0 0;color:#999;">Quedan ${remaining} plazas de ${TOTAL_PLAZAS}.</p>
    </div>
  `;

  await sendEmail(
    "newsletter@niala.es",
    `Entrenatzaile — Nueva valoración: ${nombre.trim()}`,
    notifHtml,
    "Entrenatzaile <contacto@niala.es>"
  );

  return NextResponse.json({ ok: true, remaining });
}
