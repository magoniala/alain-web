import { createClient } from "@supabase/supabase-js";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import { cargarMailSecuencia } from "@/lib/secuencia-mails";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const TOTAL_PLAZAS = 10;
// Plazas ya ocupadas fuera de este formulario (peticiones directas antes de la landing).
const YA_RESERVADAS = 2;

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
  const { nombre, edad, email, motivo, turno, newsletter, idioma } = body;
  const isEu = idioma === "eu";
  const contactEmail = isEu ? "kontaktu@alainzulaika.com" : "contacto@alainzulaika.com";

  if (!nombre?.trim() || !edad || !email?.trim() || !motivo?.trim() || !turno) {
    return NextResponse.json(
      { error: isEu ? "Bete beharrezko eremu guztiak, mesedez." : "Faltan campos obligatorios." },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json(
      { error: isEu ? "Sartu baliozko helbide elektroniko bat." : "El email no es válido." },
      { status: 400 }
    );
  }
  const edadNum = Number(edad);
  if (!Number.isFinite(edadNum) || edadNum < 14 || edadNum > 100) {
    return NextResponse.json(
      { error: isEu ? "Sartu baliozko adin bat." : "Introduce una edad válida." },
      { status: 400 }
    );
  }

  const { count, error: countError } = await supabase
    .from("valoracion_entrenatzaile")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("valoracion_entrenatzaile count error:", countError);
    return NextResponse.json(
      { error: isEu ? "Errore bat gertatu da. Saiatu berriro." : "Ha ocurrido un error. Inténtalo de nuevo." },
      { status: 500 }
    );
  }

  if (YA_RESERVADAS + (count ?? 0) >= TOTAL_PLAZAS) {
    return NextResponse.json(
      {
        error: isEu
          ? `Plaza guztiak beteta daude. Idatzi ${contactEmail} helbidera etorkizuneko irekierez jakinarazi nahi baduzu.`
          : `Todas las plazas están cubiertas. Escribe a ${contactEmail} si quieres avisarte para futuras aperturas.`,
      },
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
    idioma: isEu ? "eu" : "es",
  });

  if (dbError) {
    console.error("valoracion_entrenatzaile insert error:", dbError);
    return NextResponse.json(
      { error: isEu ? "Errore bat gertatu da. Saiatu berriro." : "Ha ocurrido un error. Inténtalo de nuevo." },
      { status: 500 }
    );
  }

  const remaining = Math.max(0, TOTAL_PLAZAS - YA_RESERVADAS - (count ?? 0) - 1);

  if (newsletter) {
    await supabase.from("newsletter_contactos").upsert(
      {
        email: email.trim().toLowerCase(),
        nombre: nombre.trim(),
        idioma: isEu ? "eu" : "es",
        origen: "entrenatzaile_valoracion",
      },
      { onConflict: "email", ignoreDuplicates: true }
    );

    // Siempre apunta al dominio principal: /api/newsletter/baja, /idioma y /contacto
    // solo existen ahí, no bajo el subdominio entrenatzaile.alainzulaika.com desde
    // donde se envía este formulario (ese subdominio reescribe todo lo demás a
    // /entrenatzaile/*, así que reusar el host de la petición daría 404).
    const host = req.headers.get("host") || "";
    const BASE_URL = host.includes("localhost") ? `http://${host}` : "https://alainzulaika.com";
    const emailLower = email.trim().toLowerCase();
    const bajaUrl = `${BASE_URL}/api/newsletter/baja?email=${encodeURIComponent(emailLower)}`;
    const idiomaUrl = `${BASE_URL}/api/newsletter/idioma?email=${encodeURIComponent(emailLower)}&idioma=${isEu ? "es" : "eu"}`;
    const contactoUrl = isEu ? `${BASE_URL}/contacto` : `${BASE_URL}/es/contacto`;

    const pdStyle = `font-size:1.15rem;color:#1a1a1a;line-height:2.1;margin-top:0.5rem;`;
    const linkStyle = `color:#2a9d8f;`;
    const pStyle = `margin:0 0 1.6rem 0;`;
    const wrap = (content: string) => `
      <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
        <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">
          ${content}
        </div>
        <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.95rem;color:#555;line-height:1.9;">
          <p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:${contactEmail}" style="color:#555;">${contactEmail}</a></p>
          <p style="margin:0;"><a href="${bajaUrl}" style="color:#555;">${isEu ? "Utzi email hauek jasotzeari" : "Dejar de recibir estos emails"}</a></p>
        </div>
      </div>
    `;

    const mailBD = await cargarMailSecuencia("entrenatzaile_valoracion", 1, isEu ? "eu" : "es", {
      nombre: nombre.trim(),
      cambiar_idioma: idiomaUrl,
      contacto: contactoUrl,
    });

    await sendEmail(
      nombre.trim() ? `${nombre.trim()} <${emailLower}>` : emailLower,
      mailBD?.asunto || (isEu ? "Ongi etorri — jada jaso dut zure balorazioa" : "Bienvenido/a — ya tengo tu valoración"),
      wrap(
        mailBD?.cuerpo ??
          (isEu
            ? `
          <p style="${pStyle}">Kaixo, Alain naiz.</p>
          <p style="${pStyle}">Jada jaso dut formularioan bidali didazun informazioa. 48 ordu baino gutxiagoan zurekin harremanetan jarriko naiz 90 minutuko balorazio-deia antolatzeko.</p>
          <p style="${pStyle}">Bitartean, hau da nire mezuetatik espero dezakezuna: magoa eszenatoki gainean, entrenatzaile pertsonala online, eta kuriosoa jaiotzaz eta hazkundez.</p>
          <p style="${pStyle}">Nire mezuetan entrenamenduari, osasunari eta magiari buruzko hausnarketa, ikasgai eta pasadizoak aurkituko dituzu — baita partekatzeko gogoa ematen didan beste edozer ere.</p>
          <p style="${pStyle}">Ez dago egutegi finkorik, nahiz eta normalean egunero idazten dudan.</p>
          <p style="margin:0 0 2rem 0;">Interesa galtzen baduzu, behean harpidetza bertan behera uzteko botoia duzu. Klik bat eta kitto.</p>
          <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
          <p style="${pdStyle}"><strong>Pd:</strong> Nire mezuak galdu nahi ez badituzu, mugitu hau zure sarrera-ontzi nagusira oraintxe bertan.</p>
          <p style="${pdStyle}"><strong>Pd2:</strong> Nahiago gazteleraz jasotzea? <a href="${idiomaUrl}" style="${linkStyle}">Egin klik hemen</a></p>
          <p style="${pdStyle}"><strong>Pd3:</strong> Ekitaldi berezi bat antolatzen ari zara? <a href="${contactoUrl}" style="${linkStyle}">Egin klik hemen eta hitz egin dezagun.</a> Enpresa-ekitaldiak, kultur ekitaldiak, festa pribatuak… Hamar minutuko solasaldia nahikoa izaten da magiak zentzua duen ala ez ikusteko.</p>
          <p style="${pdStyle}"><strong>Pd4:</strong> Mezu honi "kaixo" soil batekin erantzuten badiozu, Gmaili lagunduko diozu hau spam ez dela ulertzen — eskerrik asko.<br>Eta nor zaren, nola aurkitu nauzun eta nire mezuetatik zer jasotzea espero duzun kontatzen badidazu... eguna alaituko didazu.</p>
        `
            : `
          <p style="${pStyle}">Hola, soy Alain.</p>
          <p style="${pStyle}">Ya tengo la información que me has enviado en el formulario. Te contacto en menos de 48h para agendar la llamada de valoración de 90 minutos.</p>
          <p style="${pStyle}">Mientras tanto, esto es lo que puedes esperar de mis mails: mago en los escenarios, entrenador personal online, y curioso de nacimiento y crecimiento.</p>
          <p style="${pStyle}">En mis mails vas a encontrar reflexiones, aprendizajes y anécdotas sobre entrenamiento, salud y magia — y lo que me apetezca contar.</p>
          <p style="${pStyle}">Sin frecuencia fija prometida, aunque lo habitual es que te escriba a diario.</p>
          <p style="margin:0 0 2rem 0;">Si en algún momento deja de interesarte, abajo tienes el botón para salir. Sin rollos.</p>
          <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
          <p style="${pdStyle}"><strong>Pd:</strong> Si no te quieres perder mis emails, mueve este ahora a tu bandeja principal.</p>
          <p style="${pdStyle}"><strong>Pd2:</strong> ¿Prefieres recibirlos en euskera? <a href="${idiomaUrl}" style="${linkStyle}">Clic aquí</a></p>
          <p style="${pdStyle}"><strong>Pd3:</strong> ¿Tienes un evento que hacer especial? <a href="${contactoUrl}" style="${linkStyle}">Haz clic aquí y hablemos.</a> Eventos de empresa, eventos culturales, fiestas privadas… Diez minutos de conversación suelen aclarar si tiene sentido.</p>
          <p style="${pdStyle}"><strong>Pd4:</strong> Si respondes a este mail con un "hola" me ayudas a que gmail entienda que esto no es spam, gracias.<br>Si encima me cuentas quien eres, como me has conocido, que esperas recibir en mis mails... me alegras el día.</p>
        `)
      ),
      resolveNewsletterFrom(mailBD?.remitente)
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
        <tr><td style="${rowStyle}"><strong>Idioma</strong></td><td style="${rowStyle}">${isEu ? "Euskera" : "Castellano"}</td></tr>
        <tr><td style="${rowStyle}"><strong>Turno</strong></td><td style="${rowStyle}">${turno}</td></tr>
        <tr><td style="${rowStyle}"><strong>Newsletter</strong></td><td style="${rowStyle}">${newsletter ? "Sí" : "No"}</td></tr>
        <tr><td style="${rowStyle}vertical-align:top;"><strong>Motivo</strong></td><td style="${rowStyle}">${motivo.trim()}</td></tr>
      </table>
      <p style="margin:1rem 0 0;color:#999;">Quedan ${remaining} plazas de ${TOTAL_PLAZAS}.</p>
    </div>
  `;

  await sendEmail(
    "newsletter@alainzulaika.com",
    `Entrenatzaile — Nueva valoración: ${nombre.trim()}`,
    notifHtml,
    "Entrenatzaile <alain@alainzulaika.com>"
  );

  return NextResponse.json({ ok: true, remaining });
}
