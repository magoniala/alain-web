import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  const { email } = await req.json();
  const host = req.headers.get("host") || "alainzulaika.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const BASE_URL = `${protocol}://${host}`;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }

  const { error: dbError } = await supabase
    .from("comodin_contactos")
    .insert({ email });

  if (dbError && dbError.code !== "23505") {
    return NextResponse.json({ error: "Error al guardar." }, { status: 500 });
  }

  const tutorialUrl = `${BASE_URL}/es/comodin/tutorial`;
  const euskeraUrl = `${BASE_URL}/api/comodin/idioma?email=${encodeURIComponent(email)}&idioma=eu`;
  const contactoUrl = `${BASE_URL}/contacto`;
  const eguzkiloreUrl = `${BASE_URL}/eguzkilore`;
  const bajaUrl = `${BASE_URL}/api/comodin/baja?email=${encodeURIComponent(email)}`;

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

  const pdStyle = `font-size:1.15rem;color:#1a1a1a;line-height:2.1;margin-top:0.5rem;`;
  const linkStyle = `color:#2a9d8f;`;
  const pStyle = `margin:0 0 1.6rem 0;`;

  // Mail 1 — inmediato
  await resend.emails.send({
    from: "Alain Zulaika <contacto@niala.es>",
    to: email,
    replyTo: "contacto@niala.es",
    subject: "El truco que te di en mano",
    html: wrap(`
      <p style="${pStyle}">Esa tarjeta que tienes…<br>ya ha hecho su primer truco.</p>
      <p style="${pStyle}">Pero lo bueno no es la tarjeta.<br>Es lo que puedes hacer tú con lo que hay en cualquier cocina.</p>
      <p style="${pStyle}">Un vaso.<br>Papel de aluminio.<br>Un objeto cualquiera.<br>Pase mágico...<br>¡puff!<br>Desaparece.</p>
      <p style="${pStyle}">He visto a gente aprenderlo en tres minutos y dejarlo todo callado en la siguiente cena.<br>Al que más dudaba, primero.</p>
      <p style="${pStyle}">Por eso te he preparado un tutorial muy corto:<br>El secreto de la desaparición inesperada.<br>Sin experiencia. Sin material especial. Sin ensayo previo.</p>
      <p style="${pStyle}"><a href="${tutorialUrl}" style="${linkStyle}font-weight:bold;">Haz clic aquí para aprender el secreto.</a></p>
      <p style="${pStyle}">Hazlo.<br>Disfrútalo.<br>Y si te animas, respóndeme y cuéntame dónde lo hiciste y cómo reaccionaron.</p>
      <p style="margin:0 0 2rem 0;">Si me escribes, tengo un segundo truco aún más visual esperándote.</p>
      <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
      <p style="${pdStyle}"><strong>Pd:</strong> ¿Prefieres recibir los próximos mails en euskera?<br><a href="${euskeraUrl}" style="${linkStyle}">Clic aquí</a></p>
      <p style="${pdStyle}"><strong>Pd2:</strong> Si no te quieres perder mis emails, mueve este ahora a tu bandeja principal.</p>
      <p style="${pdStyle}"><strong>Pd3:</strong> Si un día te aburres de recibir mis mails, no pasa nada.<br>Al final de todos hay un botón para hacerme desaparecer.</p>
      <p style="${pdStyle}"><strong>Pd4:</strong> ¿Tienes un evento que hacer especial?<br><a href="${contactoUrl}" style="${linkStyle}">Haz clic aquí y hablemos.</a><br>Cumpleaños, cena de empresa, despedida, presentación…<br>Diez minutos de conversación suelen aclarar si tiene sentido.</p>
    `),
  });

  // Mail 2 — +2 días
  const twoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const mail2 = await resend.emails.send({
    from: "Alain Zulaika <contacto@niala.es>",
    to: email,
    replyTo: "contacto@niala.es",
    subject: "¿Dónde lo hiciste?",
    scheduledAt: twoDays.toISOString(),
    html: wrap(`
      <p style="${pStyle}">Oye,<br>O bueno, lee.</p>
      <p style="${pStyle}">¿Le hiciste el truco del vaso a alguien?<br>Quiero saberlo.</p>
      <p style="${pStyle}">Me han llegado historias buenas.<br>Como alguien que lo intentó en una cena y se le cayó el vaso.<br>Toda la mesa riéndose.<br>Al final, no salió como esperaba, pero el momento se creó igual.</p>
      <p style="${pStyle}">Ahora te pregunto a ti:<br>– ¿Cuándo lo hiciste?<br>– ¿A quién?<br>– ¿Cómo reaccionaron?<br>– ¿Alguien lo pilló?</p>
      <p style="${pStyle}">Respóndeme a este email contándome lo que pasó… y te mandaré un segundo truco.<br>Más visual.<br>Más directo.</p>
      <p style="margin:0 0 2rem 0;">Uno que puedes hacer tú en cualquier situación.<br>Pero solo si me cuentas cómo fue el primero.<br>Te leo.</p>
      <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
      <p style="${pdStyle}"><strong>Pd:</strong> Y al igual que a este mail, siéntete libre de responderme cuando quieras.<br>Ya sea para opinar, conversar, preguntar…<br>Me leo todo.<br>Y respondo a casi todo.</p>
    `),
  });

  // Mail 3 — +4 días
  const fourDays = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

  const faqs = [
    "Alain, ¿me enseñas otro truco?",
    "¿Si hago magia, me llamarán friki?",
    "¿Te tiemblan las manos cuando haces magia?",
    "Eres un friki.",
    "¿Y si soy un manazas? ¿También puedo aprender?",
    "Me he motivao, ¿qué baraja me recomiendas?",
    "¿Es solo para entretener o tiene más usos?",
    "¿Lo puedo regalar?",
    "¿No será como esos kits baratos de juguetería, no?",
    "¿Qué lleva exactamente la baraja?",
    "¿Y si quiero aprender solo?",
    "¿Está ya disponible?",
    "¿Y el curso?",
    "¿Puedo hacer un show completo con esto?",
    "¿Me va a dar miedo no saber hacerlo bien?",
    "¿Vale para practicar con alguien? ¿Tipo plan de tarde?",
    "¿Esto sirve también para crear momentos?",
    "¿Y si quiero regalar magia a alguien?",
    "¿Cuál es el siguiente paso después del truco del vaso?",
    "He roto el vaso, ¿qué debo hacer?",
    "¿Vendes tú alguna baraja?",
    "¿Hay algo que me puedas recomendar para practicar a diario?",
    "¿Qué diferencia a tu curso de lo que ya hay por ahí?",
    "¡Estafador!",
    "¿Es magia visual o más psicológica?",
    "¿Hace falta buena memoria?",
    "¿Qué contiene exactamente la baraja?",
    "¿Cómo y cuándo puedo conseguirla?",
  ];

  const faqHtml = faqs
    .map((q) => `<p style="margin:0 0 0.2rem;font-style:italic;color:#555;">${q}</p><p style="margin:0 0 1.4rem;"><a href="${eguzkiloreUrl}" style="${linkStyle}">Lee esta página</a></p>`)
    .join("");

  const mail3 = await resend.emails.send({
    from: "Alain Zulaika <contacto@niala.es>",
    to: email,
    replyTo: "contacto@niala.es",
    subject: "Preguntas normales (y otras que me hacen reír)",
    scheduledAt: fourDays.toISOString(),
    html: wrap(faqHtml),
  });

  // Guardar IDs de emails programados para poder cancelarlos si se da de baja
  const mail2Id = (mail2 as { data?: { id?: string } }).data?.id;
  const mail3Id = (mail3 as { data?: { id?: string } }).data?.id;

  if (mail2Id || mail3Id) {
    await supabase
      .from("comodin_contactos")
      .update({ mail2_id: mail2Id ?? null, mail3_id: mail3Id ?? null })
      .eq("email", email);
  }

  return NextResponse.json({ ok: true });
}
