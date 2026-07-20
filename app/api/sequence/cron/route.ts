import { createClient } from "@supabase/supabase-js";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://alainzulaika.com";

function wrapComodin(content: string, email: string, isEu: boolean) {
  const bajaUrl = `${BASE_URL}/api/comodin/baja?email=${encodeURIComponent(email)}`;
  const text = isEu ? "Utzi email hauek jasotzeari" : "Dejar de recibir estos emails";
  return `<div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;"><div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">${content}</div><div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.95rem;color:#555;line-height:1.9;"><p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:contacto@niala.es" style="color:#555;">contacto@niala.es</a></p><p style="margin:0;"><a href="${bajaUrl}" style="color:#555;">${text}</a></p></div></div>`;
}

function wrapMision(content: string, email: string, isEu: boolean) {
  const bajaUrl = `${BASE_URL}/api/mision/baja?email=${encodeURIComponent(email)}`;
  const text = isEu ? "Utzi email hauek jasotzeari" : "Dejar de recibir estos emails";
  return `<div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;"><div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">${content}</div><div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.95rem;color:#555;line-height:1.9;"><p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:contacto@niala.es" style="color:#555;">contacto@niala.es</a></p><p style="margin:0;"><a href="${bajaUrl}" style="color:#555;">${text}</a></p></div></div>`;
}

const p = `margin:0 0 1.6rem 0;`;
const pd = `font-size:1.15rem;color:#1a1a1a;line-height:2.1;margin-top:0.5rem;`;
const lk = `color:#2a9d8f;`;

function comodinMail2(email: string, isEu: boolean) {
  const eguzkiloreUrl = `${BASE_URL}/eguzkilore`;
  const subject = isEu ? "Non egin zenuen?" : "¿Dónde lo hiciste?";
  const html = wrapComodin(isEu ? `
    <p style="${p}">Entzun,<br>Edo hobeto, irakurri.</p>
    <p style="${p}">Edalontziaren trukoa norbaiti egin al zenion?<br>Jakin nahi det.</p>
    <p style="${p}">Istorio onak iritsi zaizkit.<br>Norbaitek afarian saiatu eta edalontzia erori zitzaion.<br>Mahai guztia barrez.<br>Azkenean ez zen espero bezala atera, baina momentu polit bat sortu zen hala ere.</p>
    <p style="${p}">Orain zuri galdetzen dizut:<br>– Noiz egin zenuen?<br>– Nori?<br>– Nola erreakzionatu zuten?<br>– Norbaitek harrapatu zintuen?</p>
    <p style="${p}">Erantzun iezadazu email honetara gertatutakoa kontatuz… eta bigarren truko bat bidaliko dizut.<br>Are bisualagoa. Are zuzenagoa.<br>Edozein egoeratan egin dezakezun bat.</p>
    <p style="margin:0 0 2rem 0;">Irakurtzen zaitut.</p>
    <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
    <p style="${pd}"><strong>Pd:</strong> Eta email honi bezala, nahi duzunean erantzun ahal diozu nire mezuei.<br>Iritzia emateko, hitz egiteko, galdetzeko…<br>Dena irakurtzen dut. Eta ia dena erantzuten det.</p>
  ` : `
    <p style="${p}">Oye,<br>O bueno, lee.</p>
    <p style="${p}">¿Le hiciste el truco del vaso a alguien?<br>Quiero saberlo.</p>
    <p style="${p}">Me han llegado historias buenas.<br>Como alguien que lo intentó en una cena y se le cayó el vaso.<br>Toda la mesa riéndose.<br>Al final, no salió como esperaba, pero el momento se creó igual.</p>
    <p style="${p}">Ahora te pregunto a ti:<br>– ¿Cuándo lo hiciste?<br>– ¿A quién?<br>– ¿Cómo reaccionaron?<br>– ¿Alguien lo pilló?</p>
    <p style="${p}">Respóndeme a este email contándome lo que pasó… y te mandaré un segundo truco.<br>Más visual.<br>Más directo.</p>
    <p style="margin:0 0 2rem 0;">Uno que puedes hacer tú en cualquier situación.<br>Pero solo si me cuentas cómo fue el primero.<br>Te leo.</p>
    <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
    <p style="${pd}"><strong>Pd:</strong> Y al igual que a este mail, siéntete libre de responderme cuando quieras.<br>Ya sea para opinar, conversar, preguntar…<br>Me leo todo.<br>Y respondo a casi todo.</p>
  `, email, isEu);
  return { subject, html };
}

function comodinMail3(email: string, isEu: boolean) {
  const eguzkiloreUrl = `${BASE_URL}/eguzkilore`;
  const subject = isEu ? "Galdera arruntak (eta barregarriak)" : "Preguntas normales (y otras que me hacen reír)";
  const faqLinkText = isEu ? "Irakurri orrialde hau" : "Lee esta página";
  const faqsEs = ["Alain, ¿me enseñas otro truco?","¿Si hago magia, me llamarán friki?","¿Te tiemblan las manos cuando haces magia?","Eres un friki.","¿Y si soy un manazas? ¿También puedo aprender?","Me he motivao, ¿qué baraja me recomiendas?","¿Es solo para entretener o tiene más usos?","¿Lo puedo regalar?","¿No será como esos kits baratos de juguetería, no?","¿Qué lleva exactamente la baraja?","¿Y si quiero aprender solo?","¿Está ya disponible?","¿Y el curso?","¿Puedo hacer un show completo con esto?","¿Me va a dar miedo no saber hacerlo bien?","¿Vale para practicar con alguien? ¿Tipo plan de tarde?","¿Esto sirve también para crear momentos?","¿Y si quiero regalar magia a alguien?","¿Cuál es el siguiente paso después del truco del vaso?","He roto el vaso, ¿qué debo hacer?","¿Vendes tú alguna baraja?","¿Hay algo que me puedas recomendar para practicar a diario?","¿Qué diferencia a tu curso de lo que ya hay por ahí?","¡Estafador!","¿Es magia visual o más psicológica?","¿Hace falta buena memoria?","¿Qué contiene exactamente la baraja?","¿Cómo y cuándo puedo conseguirla?"];
  const faqsEu = ["Alain, beste truko bat irakatsi al diazu?","Magia egiten badut, friki deituko al didate?","Eskuak dardar egiten dizute magia egiten dezunian?","Friki bat zara.","Eta patoso bat banaiz? Nik ere ikasi al dezaket?","Motibatu naiz, ze karta-sorta gomendatzen didazu?","Entretenigarria bakarrik da ala beste erabilerak ditu?","Opari gisa eman al daiteke?","Ez da jostailu-dendako magia-kit bat merkeagoa izango?","Zer dakar zehazki baraja horrek?","Eta bakarrik ikasi nahi badut?","Dagoeneko erabilgarri al dago?","Eta ikastaroa?","Show oso bat egin al dezaket honekin?","Beldur banaiz gaizki egiteko?","Honek ere momentuak sortzeko balio al du?","Eta norbaiti oparitu nahi baduot?","Zein da edalontziaren trukoa egin osteko hurrengo pausoa?","Edalontzia hautsi dut, zer egin behar det?","Zu zeuk baraja bat saltzen al duzu?","Egunero praktikatzeko zerbait gomendatzen al didazu?","Zein da zure ikastaro eta bertan dagoenaren arteko aldea?","Iruzurgile bat zara!","Magia bisuala da edo psikologikoagoa?","Memoria ona behar al da?","Nola eta noiz lor dezaket?"];
  const faqs = isEu ? faqsEu : faqsEs;
  const faqHtml = faqs.map((q) => `<p style="margin:0 0 0.2rem;font-style:italic;color:#555;">${q}</p><p style="margin:0 0 1.4rem;"><a href="${eguzkiloreUrl}" style="${lk}">${faqLinkText}</a></p>`).join("");
  const html = wrapComodin(faqHtml, email, isEu);
  return { subject, html };
}

function misionMail2(email: string, isEu: boolean) {
  const subject = isEu ? "Onena ez zen trukoa… zure anekdota baizik." : "Lo mejor no fue el truco… es vuestra anécdota.";
  const html = wrapMision(isEu ? `
    <p style="${p}">Entzun,<br>Edo hobeto, irakurri.</p>
    <p style="${p}">Edalontziaren trukoa egin zenion zure txikiari?<br>Jakin nahi det.</p>
    <p style="${p}">Istorio paregabeak iritsi zaizkit.<br>Ama batek objektua desagerrarazi nahi izan zuen…<br>edalontzia erori zitzaion eta bere alabak ikusi zuen.</p>
    <p style="${p}">Familia guztia barrez.<br>Alaba ere bai.<br>Azkenean ez zen espero bezala atera, baina oroitzapena berdin sortu zen.</p>
    <p style="${p}">Orain zuri galdetzen dizut:<br>– Noiz egin zenion?<br>– Zer esan zuen zure seme-alabak?<br>– Barre egin zuen? Flipatu? Sekretua oihukatu zuen?<br>– Bideoa al duzue?</p>
    <p style="${p}">Erantzun iezadazu email honetara gertatutakoa kontatuz… eta bigarren truko bat bidaliko dizut.<br>Are bisualagoa. Are zuzenagoa.</p>
    <p style="${p}">Zuk egin dezakezun bat…<br>edo 4 urte baino gehiago baditu, zure seme-alabari ere irakatsi diezaiokezun bat.</p>
    <p style="margin:0 0 2rem 0;">Irakurtzen zaitut.</p>
    <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
    <p style="${pd}"><strong>Pd:</strong> Eta email honi bezala, nahi duzunean erantzun ahal dituzu nire mezuak.<br>Iritzia emateko, hitz egiteko, afari batera gonbidatzeko, galdetzeko…<br>Dena irakurtzen det. Eta ia dena erantzuten det.</p>
  ` : `
    <p style="${p}">Oye,<br>O bueno, lee.</p>
    <p style="${p}">¿Le hiciste el truco del vaso a tu peque?<br>Quiero saberlo.</p>
    <p style="${p}">Te lo digo porque me han llegado historias geniales.<br>Como una madre que intentó hacer desaparecer el objeto…<br>se le cayó el vaso y su hija lo vio.</p>
    <p style="${p}">Toda la familia riéndose.<br>La hija también.<br>Al final, no salió como esperaba, pero el recuerdo se creó igual.</p>
    <p style="${p}">Ahora te pregunto a ti:<br>– ¿Cuándo se lo hiciste?<br>– ¿Qué dijo tu hijo?<br>– ¿Se rió? ¿Alucinó? ¿Gritó el secreto?<br>– ¿Tenéis vídeo?</p>
    <p style="${p}">Respóndeme a este email contándome lo que pasó… y te mandaré un segundo truco.<br>Más visual.<br>Más directo.</p>
    <p style="${p}">Uno que puedes hacer tú…<br>o incluso enseñárselo a tu hijo si tiene más de 4 años.</p>
    <p style="margin:0 0 2rem 0;">Pero solo si me cuentas cómo fue el primero.<br>Te leo.<br>Y mañana mismo, si me has escrito, te lo mando.</p>
    <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
    <p style="${pd}"><strong>Pd:</strong> Y al igual que a este mail, siéntete libre de responderme cuando quieras.<br>Ya sea para opinar, conversar, invitarme a cenar, preguntar…<br>Me leo todo.<br>Y respondo a casi todo.</p>
  `, email, isEu);
  return { subject, html };
}

function misionMail3(email: string, isEu: boolean) {
  const eguzkiloreUrl = `${BASE_URL}/eguzkilore`;
  const subject = isEu ? "Galdera arruntak (eta barregarriak)" : "Preguntas normales (y otras que me hacen reír)";
  const faqLinkText = isEu ? "Irakurri orrialde hau" : "Lee esta página";
  const faqsEs = ["Alain, ¿me enseñas otro truco?","¿Si hago magia, me llamarán friki?","¿Te tiemblan las manos cuando haces magia?","Eres un friki.","¿Y si soy un manazas? ¿También puedo aprender?","Me he motivao, ¿qué baraja me recomiendas?","¿Es solo para niños o también lo puedo disfrutar yo?","¿Lo puedo regalar a mi hijo/a si tiene 10 años?","¿No será como esos kits baratos de juguetería, no?","¿Qué lleva exactamente la baraja?","¿Y si mi hijo quiere aprender solo?","¿Está ya disponible?","¿Y el curso?","¿Puedo hacer un show completo con esto?","¿Me va a dar miedo no saber hacerlo bien?","¿Vale para practicar juntos? ¿Tipo \"actividad de domingo\"?","¿Esto sirve también para crear recuerdos?","¿Y si quiero regalar magia a alguien?","¿Cuál es el siguiente paso después del truco del vaso?","He roto el vaso, ¿qué debo hacer?","¿Vendes tú alguna baraja?","¿Hay algo que me puedas recomendar para practicar a diario?","¿Qué diferencia a tu curso de lo que ya hay por ahí?","¡Estafador!","¿Es magia visual o más psicológica?","¿Hace falta buena memoria?","¿Qué contiene exactamente la baraja?","¿Cómo y cuándo puedo conseguirla?"];
  const faqsEu = ["Alain, beste truko bat irakatsi al diazu?","Magia egiten badut, friki deituko al didate?","Eskuak dardar egiten dizute magia egiten dezunian?","Friki bat zara.","Eta patoso bat banaiz? Nik ere ikasi al dezaket?","Motibatu naiz, ze karta-sorta gomendatzen didazu?","Umeekin bakarrik da ala ni ere gozatu al dezaket?","Opari gisa eman al dakioket nire seme-alabari 10 urte baditu?","Ez da jostailu-dendako magia-kit bat merkeagoa izango?","Zer dakar zehazki baraja horrek?","Eta nire seme-alabak bakarrik ikasi nahi badu?","Dagoeneko erabilgarri al dago?","Eta ikastaroa?","Show oso bat egin al dezaket honekin?","Beldur banaiz gaizki egiteko?","Elkarrekin praktikatzeko balio al du? Astebukuerako jarduera gisa?","Honek ere oroitzapenak sortzeko balio al du?","Eta norbaiti oparitu nahi baduot?","Zein da edalontziaren trukoa egin osteko hurrengo pausoa?","Edalontzia hautsi dut, zer egin behar det?","Zu zeuk baraja bat saltzen al duzu?","Egunero praktikatzeko zerbait gomendatzen al didazu?","Zein da zure ikastaro eta bertan dagoenaren arteko aldea?","Iruzurgile bat zara!","Magia bisuala da edo psikologikoagoa?","Memoria ona behar al da?","Nola eta noiz lor dezaket?"];
  const faqs = isEu ? faqsEu : faqsEs;
  const faqHtml = faqs.map((q) => `<p style="margin:0 0 0.2rem;font-style:italic;color:#555;">${q}</p><p style="margin:0 0 1.4rem;"><a href="${eguzkiloreUrl}" style="${lk}">${faqLinkText}</a></p>`).join("");
  const html = wrapMision(faqHtml, email, isEu);
  return { subject, html };
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const now = new Date();
  let enviados = 0;

  // Comodin mail2
  const { data: cMail2 } = await supabase
    .from("comodin_contactos")
    .select("email, idioma, mail2_id")
    .not("mail2_id", "is", null)
    .eq("unsubscribed", false);

  for (const row of cMail2 ?? []) {
    const sendAt = new Date(row.mail2_id);
    if (isNaN(sendAt.getTime()) || sendAt > now) continue;
    const { subject, html } = comodinMail2(row.email, row.idioma === "eu");
    await sendEmail(row.email, subject, html, resolveNewsletterFrom());
    await supabase.from("comodin_contactos").update({ mail2_id: null }).eq("email", row.email);
    enviados++;
  }

  // Comodin mail3
  const { data: cMail3 } = await supabase
    .from("comodin_contactos")
    .select("email, idioma, mail3_id")
    .not("mail3_id", "is", null)
    .eq("unsubscribed", false);

  for (const row of cMail3 ?? []) {
    const sendAt = new Date(row.mail3_id);
    if (isNaN(sendAt.getTime()) || sendAt > now) continue;
    const { subject, html } = comodinMail3(row.email, row.idioma === "eu");
    await sendEmail(row.email, subject, html, resolveNewsletterFrom());
    await supabase.from("comodin_contactos").update({ mail3_id: null }).eq("email", row.email);
    enviados++;
  }

  // Mision mail2
  const { data: mMail2 } = await supabase
    .from("mision_contactos")
    .select("email, idioma, mail2_id")
    .not("mail2_id", "is", null)
    .eq("unsubscribed", false);

  for (const row of mMail2 ?? []) {
    const sendAt = new Date(row.mail2_id);
    if (isNaN(sendAt.getTime()) || sendAt > now) continue;
    const { subject, html } = misionMail2(row.email, row.idioma === "eu");
    await sendEmail(row.email, subject, html, resolveNewsletterFrom());
    await supabase.from("mision_contactos").update({ mail2_id: null }).eq("email", row.email);
    enviados++;
  }

  // Mision mail3
  const { data: mMail3 } = await supabase
    .from("mision_contactos")
    .select("email, idioma, mail3_id")
    .not("mail3_id", "is", null)
    .eq("unsubscribed", false);

  for (const row of mMail3 ?? []) {
    const sendAt = new Date(row.mail3_id);
    if (isNaN(sendAt.getTime()) || sendAt > now) continue;
    const { subject, html } = misionMail3(row.email, row.idioma === "eu");
    await sendEmail(row.email, subject, html, resolveNewsletterFrom());
    await supabase.from("mision_contactos").update({ mail3_id: null }).eq("email", row.email);
    enviados++;
  }

  return NextResponse.json({ ok: true, enviados });
}
