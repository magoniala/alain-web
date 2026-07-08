import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email-ses";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET() {
  const { data, error } = await supabase
    .from("newsletter_contactos")
    .select("id, email, nombre, idioma, fecha_alta, origen, unsubscribed")
    .order("fecha_alta", { ascending: false });
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const { email, nombre, idioma, origen } = await req.json();
  if (!email) return NextResponse.json({ error: "Falta email." }, { status: 400 });

  const host = req.headers.get("host") || "www.alainzulaika.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const BASE_URL = `${protocol}://${host}`;

  const { data, error } = await supabase
    .from("newsletter_contactos")
    .upsert(
      { email, nombre: nombre || null, idioma: idioma || "es", origen: origen || "manual" },
      { onConflict: "email", ignoreDuplicates: true }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });

  if (data && (origen || "manual") === "manual") {
    const isEu = (idioma || "es") === "eu";
    const bajaUrl = `${BASE_URL}/api/newsletter/baja?email=${encodeURIComponent(email)}`;
    const euskeraUrl = `${BASE_URL}/api/newsletter/idioma?email=${encodeURIComponent(email)}&idioma=eu`;
    const castellanoUrl = `${BASE_URL}/api/newsletter/idioma?email=${encodeURIComponent(email)}&idioma=es`;
    const contactoEsUrl = `${BASE_URL}/es/contacto`;
    const contactoEuUrl = `${BASE_URL}/contacto`;
    const entrenamientoUrl = `mailto:contacto@niala.es?subject=Entrenamiento&body=Hola%20Alain%2C%20inf%C3%B3rmame%20sobre%20c%C3%B3mo%20trabajas.`;
    const unsubscribeText = isEu ? "Utzi email hauek jasotzeari" : "Dejar de recibir estos emails";

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
          <p style="margin:0;"><a href="${bajaUrl}" style="color:#555;">${unsubscribeText}</a></p>
        </div>
      </div>
    `;

    await sendEmail(
      nombre ? `${nombre} <${email}>` : email,
      isEu ? "Ongi etorri — zer espero dezakezu jakiteko" : "Bienvenido/a — esto es lo que puedes esperar",
      isEu
        ? wrap(`
          <p style="${pStyle}">Kaixo, Alain naiz.</p>
          <p style="${pStyle}">Magoa eszenatoki gainean. Entrenatzaile pertsonala online. Eta kuriosoa jaiotzaz eta hazkundez.</p>
          <p style="${pStyle}">Nire mezuetan entrenamenduari, osasunari eta magiari buruzko hausnarketa, ikasgai eta pasadizoak aurkituko dituzu; baita partekatzeko gogoa ematen didan beste edozer ere.</p>
          <p style="${pStyle}">Ez dago egutegi finkorik, nahiz eta normalean egunero idazten dudan.</p>
          <p style="margin:0 0 2rem 0;">Interesa galtzen baduzu, behean harpidetza bertan behera uzteko botoia duzu. Klik bat eta kitto.</p>
          <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
          <p style="${pdStyle}"><strong>Pd:</strong> Nire mezuak galdu nahi ez badituzu, mugitu hau zure sarrera-ontzi nagusira oraintxe bertan.</p>
          <p style="${pdStyle}"><strong>Pd2:</strong> Nahiago gazteleraz jasotzea? <a href="${castellanoUrl}" style="${linkStyle}">Egin klik hemen</a></p>
          <p style="${pdStyle}"><strong>Pd3:</strong> Online entrenamendua interesatzen zaizu? Egin klik hemen → <a href="${entrenamientoUrl}" style="${linkStyle}">Bai.</a></p>
          <p style="${pdStyle}"><strong>Pd4:</strong> Ekitaldi berezi bat antolatzen ari zara? <a href="${contactoEuUrl}" style="${linkStyle}">Egin klik hemen eta hitz egin dezagun.</a> Enpresa-ekitaldiak, kultur ekitaldiak, festa pribatuak… Hamar minutuko solasaldia nahikoa izaten da magiak zentzua duen ala ez ikusteko.</p>
          <p style="${pdStyle}"><strong>Pd5:</strong> Mezu honi "kaixo" soil batekin erantzuten badiozu, Gmaili lagunduko diozu hau spam ez dela ulertzen — eskerrik asko.<br>Eta nor zaren, nola aurkitu nauzun eta nire mezuetatik zer jasotzea espero duzun kontatzen badidazu... eguna alaituko didazu.</p>
          <p style="${pdStyle}"><strong>Pd6:</strong> pd,pd,pd,pd...</p>
        `)
        : wrap(`
          <p style="${pStyle}">Hola, soy Alain.</p>
          <p style="${pStyle}">Mago en los escenarios. Entrenador personal online. Y curioso de nacimiento y crecimiento.</p>
          <p style="${pStyle}">En mis mails vas a encontrar reflexiones, aprendizajes y anécdotas sobre entrenamiento, salud y magia — y lo que me apetezca contar.</p>
          <p style="${pStyle}">Sin frecuencia fija prometida, aunque lo habitual es que te escriba a diario.</p>
          <p style="margin:0 0 2rem 0;">Si en algún momento deja de interesarte, abajo tienes el botón para salir. Sin rollos.</p>
          <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
          <p style="${pdStyle}"><strong>Pd:</strong> Si no te quieres perder mis emails, mueve este ahora a tu bandeja principal.</p>
          <p style="${pdStyle}"><strong>Pd2:</strong> ¿Prefieres recibirlos en euskera? <a href="${euskeraUrl}" style="${linkStyle}">Clic aquí</a></p>
          <p style="${pdStyle}"><strong>Pd3:</strong> ¿Te interesa el entrenamiento online? <a href="${entrenamientoUrl}" style="${linkStyle}">Me interesa.</a></p>
          <p style="${pdStyle}"><strong>Pd4:</strong> ¿Tienes un evento que hacer especial? <a href="${contactoEsUrl}" style="${linkStyle}">Haz clic aquí y hablemos.</a> Eventos de empresa, eventos culturales, fiestas privadas… Diez minutos de conversación suelen aclarar si tiene sentido.</p>
          <p style="${pdStyle}"><strong>Pd5:</strong> Si respondes a este mail con un "hola" me ayudas a que gmail entienda que esto no es spam, gracias.<br>Si encima me cuentas quien eres, como me has conocido, que esperas recibir en mis mails... me alegras el día.</p>
          <p style="${pdStyle}"><strong>Pd6:</strong> pd,pd,pd,pd...</p>
        `)
    );
  }

  return NextResponse.json({ ok: true, contacto: data });
}
