import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email-ses";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: Request) {
  const { email, lang } = await req.json();
  const isEu = lang === "eu";
  const host = req.headers.get("host") || "alainzulaika.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const BASE_URL = `${protocol}://${host}`;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }

  const { error: dbError } = await supabase
    .from("comodin_contactos")
    .insert({ email, idioma: lang || "es" });

  if (dbError && dbError.code !== "23505") {
    return NextResponse.json({ error: "Error al guardar." }, { status: 500 });
  }

  await supabase.from("newsletter_contactos")
    .upsert({ email, origen: "comodin" }, { onConflict: "email", ignoreDuplicates: true });

  const tutorialUrl = isEu
    ? `${BASE_URL}/comodin/tutorial`
    : `${BASE_URL}/es/comodin/tutorial`;
  const euskeraUrl = `${BASE_URL}/api/comodin/idioma?email=${encodeURIComponent(email)}&idioma=eu`;
  const castellanoUrl = `${BASE_URL}/api/comodin/idioma?email=${encodeURIComponent(email)}&idioma=es`;
  const contactoUrl = isEu ? `${BASE_URL}/contacto` : `${BASE_URL}/es/contacto`;
  const entrenamientoUrl = `mailto:contacto@niala.es?subject=Entrenamiento&body=Hola%20Alain%2C%20inf%C3%B3rmame%20sobre%20c%C3%B3mo%20trabajas.`;
  const bajaUrl = `${BASE_URL}/api/comodin/baja?email=${encodeURIComponent(email)}`;
  const unsubscribeText = isEu ? "Utzi email hauek jasotzeari" : "Dejar de recibir estos emails";

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

  const pdStyle = `font-size:1.15rem;color:#1a1a1a;line-height:2.1;margin-top:0.5rem;`;
  const linkStyle = `color:#2a9d8f;`;
  const pStyle = `margin:0 0 1.6rem 0;`;

  await sendEmail(
    email,
    isEu ? "Eskuan eman nizun trukoa" : "El truco que te di en mano",
    isEu
      ? wrap(`
        <p style="${pStyle}">Txartel horrek…<br>egin du lehen ilusioa dagoeneko.</p>
        <p style="${pStyle}">Baina onena ez da txartela.<br>Zuk zeuk edozein sukaldeko objetuekin egin dezakezuna baizik.</p>
        <p style="${pStyle}">Edalontzi bat.<br>Aluminiozko papera.<br>Edozein objektu.<br>Pase magiko bat...<br>puf!<br>Desagertu egiten da.</p>
        <p style="${pStyle}">Hiru minututan ikasi eta hurrengo afarian denak liluratuko dituzu.</p>
        <p style="${pStyle}">Tutorial labur bat presta dizut:<br>Ustekabeko desagerpenaren sekretua.<br>Esperientziarik gabe. Material berezirik gabe. Aldez aurretiko ezagutzarik gabe.</p>
        <p style="${pStyle}"><a href="${tutorialUrl}" style="${linkStyle}font-weight:bold;">Egin klik hemen sekretua ikasteko.</a></p>
        <p style="margin:0 0 2rem 0;">Proba ezazu.<br>Gozatu.<br>Eta animatzen bazera, erantzun eta kontatu non egin zenuen eta nola erreakzionatu zuten.</p>
        <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
        <p style="${pdStyle}"><strong>Pd:</strong> Gaztelaniaz jaso nahi dituzu hurrengo emailak?<br><a href="${castellanoUrl}" style="${linkStyle}">Klik hemen</a></p>
        <p style="${pdStyle}"><strong>Pd2:</strong> Nire hurrengo emailak ez galtzeko: mugitu mezu hau zure sarrera nagusira.</p>
        <p style="${pdStyle}"><strong>Pd3:</strong> Noizbait nire mezuak jasotzeaz aspertzen bazera, ez dago arazorik. Amaieran ni desagertarazteko botoi bat daukazu beti.</p>
        <p style="${pdStyle}"><strong>Pd4:</strong> Ekitaldi bat berezia egin nahi duzu? <a href="${contactoUrl}" style="${linkStyle}">Egin klik hemen eta hitz egin dezagun.</a> Enpresa-ekitaldiak, ekitaldi kulturalak, festa pribatuak… Normalean hamar minutuko solasaldi batekin zentzurik ote duen argitzen duzu.</p>
        <p style="${pdStyle}"><strong>Pd5:</strong> Bide batez, newsletter honetan ez dut soilik magiaz hitz egiten. Entrenamendua, osasuna eta kontatu nahi dudana ere bai. Baliteke ez espero izatea.</p>
        <p style="${pdStyle}"><strong>Pd6:</strong> Bai, mago izateaz gain, entrenatzaile naiz. Zure forma fisikoa hobetu nahi duzu? Sakatu hemen → <a href="${entrenamientoUrl}" style="${linkStyle}">Interesatzen zait.</a></p>
        <p style="${pdStyle}"><strong>Pd7:</strong> Mezu honi "kaixo" batekin erantzuten badidazu, gmailek hau spam ez dela ulertzen lagunduko didazu, eskerrik asko.<br>Gainera nor zaren, nola ezagutu nauzun eta nire mailetik zer espero duzun kontatzen badidazu... eguna alaituko didazu.</p>
        <p style="${pdStyle}"><strong>Pd8:</strong> pd,pd,pd,pd...</p>
      `)
      : wrap(`
        <p style="${pStyle}">Esa tarjeta que tienes…<br>ya ha hecho su primera ilusión.</p>
        <p style="${pStyle}">Pero lo bueno no es la tarjeta.<br>Es lo que puedes hacer tú con lo que hay en cualquier cocina.</p>
        <p style="${pStyle}">Un vaso.<br>Papel de aluminio.<br>Un objeto cualquiera.<br>Pase mágico...<br>¡puff!<br>Desaparece.</p>
        <p style="${pStyle}">He visto a gente aprenderlo en tres minutos y dejarlo todo callado en la siguiente cena.<br>Al que más dudaba, primero.</p>
        <p style="${pStyle}">Por eso te he preparado un tutorial muy corto:<br>El secreto de la desaparición inesperada.<br>Sin experiencia. Sin material especial. Sin ensayo previo.</p>
        <p style="${pStyle}"><a href="${tutorialUrl}" style="${linkStyle}font-weight:bold;">Haz clic aquí para aprender el secreto.</a></p>
        <p style="margin:0 0 2rem 0;">Hazlo.<br>Disfrútalo.<br>Y si te animas, respóndeme y cuéntame dónde lo hiciste y cómo reaccionaron.</p>
        <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
        <p style="${pdStyle}"><strong>Pd:</strong> ¿Prefieres recibir los próximos mails en euskera?<br><a href="${euskeraUrl}" style="${linkStyle}">Clic aquí</a></p>
        <p style="${pdStyle}"><strong>Pd2:</strong> Si no te quieres perder mis emails, mueve este ahora a tu bandeja principal.</p>
        <p style="${pdStyle}"><strong>Pd3:</strong> Si un día te aburres de recibir mis mails, no pasa nada. Al final de todos hay un botón para hacerme desaparecer.</p>
        <p style="${pdStyle}"><strong>Pd4:</strong> ¿Tienes un evento que hacer especial? <a href="${contactoUrl}" style="${linkStyle}">Haz clic aquí y hablemos.</a> Eventos de empresa, eventos culturales, fiestas privadas… Diez minutos de conversación suelen aclarar si tiene sentido.</p>
        <p style="${pdStyle}"><strong>Pd5:</strong> Por cierto, en este newsletter no solo hablo de magia. También de entrenamiento, salud y lo que me apetezca. Por si acaso no te lo esperabas.</p>
        <p style="${pdStyle}"><strong>Pd6:</strong> Sí, más allá de mago, soy entrenador. ¿Te interesa mejorar tu condición física? Dale aquí → <a href="${entrenamientoUrl}" style="${linkStyle}">Me interesa.</a></p>
        <p style="${pdStyle}"><strong>Pd7:</strong> Si respondes a este mail con un "hola" me ayudas a que gmail entienda que esto no es spam, gracias.<br>Si encima me cuentas quien eres, como me has conocido, que esperas recibir en mis mails... me alegras el día.</p>
        <p style="${pdStyle}"><strong>Pd8:</strong> pd,pd,pd,pd...</p>
      `)
  );

  const mail2SendAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const mail3SendAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from("comodin_contactos")
    .update({ mail2_id: mail2SendAt, mail3_id: mail3SendAt })
    .eq("email", email);

  return NextResponse.json({ ok: true });
}
