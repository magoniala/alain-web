import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

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
    .from("mision_contactos")
    .insert({ email, idioma: lang || "es" });

  if (dbError && dbError.code !== "23505") {
    return NextResponse.json({ error: "Error al guardar." }, { status: 500 });
  }

  // Auto-suscribir a newsletter
  await supabase.from("newsletter_contactos")
    .upsert({ email, origen: "tumision" }, { onConflict: "email", ignoreDuplicates: true });

  const tutorialUrl = isEu
    ? `${BASE_URL}/tumision/tutorial`
    : `${BASE_URL}/es/tumision/tutorial`;
  const euskeraUrl = `${BASE_URL}/api/mision/idioma?email=${encodeURIComponent(email)}&idioma=eu`;
  const castellanoUrl = `${BASE_URL}/api/mision/idioma?email=${encodeURIComponent(email)}&idioma=es`;
  const contactoUrl = `${BASE_URL}/contacto`;
  const eguzkiloreUrl = `${BASE_URL}/eguzkilore`;
  const bajaUrl = `${BASE_URL}/api/mision/baja?email=${encodeURIComponent(email)}`;

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

  // Mail 1 — inmediato
  await resend.emails.send({
    from: "Alain Zulaika <contacto@niala.es>",
    to: email,
    replyTo: "contacto@niala.es",
    subject: isEu ? "Zure guraso misioa" : "Tu misión como madre (o padre)",
    html: isEu
      ? wrap(`
        <p style="${pStyle}">Zure seme-alabak eraman zuen txartel horrek…<br>egin du lehen trukoa dagoeneko (zure laguntzari esker).</p>
        <p style="${pStyle}">Baina misioa ez da hemen amaitzen.<br>Ikuskizunean bizitako magiak aste honetan jarrai dezake…<br>zuen etxeko egongelan (edo sukaldean).</p>
        <p style="${pStyle}">Lur izeneko lehengusina bat daukat.<br>Bi urte baino ez ditu.<br>Eta dagoeneko bere lehen desagerpen magikoak bizi izan ditu.</p>
        <p style="${pStyle}">Edalontzi bat.<br>Aluminiozko papera.<br>Tenis pilota bat (edo edozein objektu).<br>Pase magiko bat...<br>puf!<br>Desagertu egiten da.</p>
        <p style="${pStyle}">Bere amak ere saiatu ziren.<br>Lehenengo barre egin zuten, gero lehiatu ziren…<br>eta azkenean lortu zutenean, Lurren erreakzioa izugarria izan zen.</p>
        <p style="${pStyle}">Begi urdin haiek distira egiten… ez dira ahazten.<br>Eta horrelako oroitzapenak… ezta ere.</p>
        <p style="${pStyle}">Horregatik prestatu dizut tutorial labur bat:<br>Zuk zeuk zure seme-alabari egin ahal diozun truko bat,<br>inolako esperientziarik gabe.</p>
        <p style="${pStyle}">Edalontzi bat, zilarrezko paper pixka bat… eta hiru minutu besterik ez dituzu behar.</p>
        <p style="${pStyle}"><a href="${tutorialUrl}" style="${linkStyle}font-weight:bold;">Egin klik hemen ustekabeko desagerpenaren sekretua ikasteko.</a></p>
        <p style="${pStyle}"><strong>PASAHITZA: Ander</strong><br>Tenis munduan (4 urterekin) murgildu ninduen lagunaren izena da.</p>
        <p style="${pStyle}">Proba ezazu.<br>Gozatu.<br>Eta animatzen bazera, grabatu eta bidali iezadazu bideoa edo kontatu zer gertatu zen.</p>
        <p style="margin:0 0 2rem 0;">Egiten badezu, beste truko are magikoago bat daukat zure zain.<br>Bestalde, zenbat urte ditu zure txikiak?<br>Erantzun iezadazu zenbaki batekin.<br>Horrela, bere adinera egokitutako trukoak bidal diezazkizuket.</p>
        <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
        <p style="${pdStyle}"><strong>Pd:</strong> Gaztelaniaz jaso nahi dituzu hurrengo emailak?<br><a href="${castellanoUrl}" style="${linkStyle}">Klik hemen</a></p>
        <p style="${pdStyle}"><strong>Pd2:</strong> Ez galdu nire hurrengo emailak: mugitu mezu hau zure sarrera nagusira.</p>
        <p style="${pdStyle}"><strong>Pd3:</strong> Noizbait nere mezuak jasotzeaz aspertzen bazera, ez dago arazorik. Amaieran ni desagertarazteko botoi bat daukazu beti.</p>
        <p style="${pdStyle}"><strong>Pd4:</strong> Urtebetetze edo jaunartze bat ospatu nahi?<br><a href="${contactoUrl}" style="${linkStyle}">Egin klik hemen eta hitz egin dezagun.</a> Urteetan zehar gogoratuko duten egun berezia nahi baduzu, hau da gomendatuko dizudana. Bat 7 urteko semearentzat eta baita zure 73 urteko aitarentzat.</p>
        <p style="${pdStyle}"><strong>Pd5:</strong> pd, pd, pd…</p>
      `)
      : wrap(`
        <p style="${pStyle}">Esa tarjeta que tu hijo se llevó…<br>ya ha hecho su primer truco (gracias a tu ayuda).</p>
        <p style="${pStyle}">Pero la misión no acaba ahí.<br>La magia que vivisteis en el espectáculo puede continuar esta misma semana…<br>en el salón de vuestra casa (o en la cocina).</p>
        <p style="${pStyle}">Tengo una prima que se llama Lur.<br>Tiene solo dos años.<br>Y ya ha vivido sus primeras desapariciones mágicas.</p>
        <p style="${pStyle}">Un vaso.<br>Papel de aluminio.<br>Una pelota de tenis (o cualquier objeto).<br>Pase mágico...<br>¡puff!<br>Desaparece.</p>
        <p style="${pStyle}">Vi cómo sus madres lo intentaban también.<br>Primero se reían, luego se picaban…<br>y cuando por fin lo consiguieron, la reacción de Lur fue brutal.</p>
        <p style="${pStyle}">Esos ojos azules brillando no se olvidan.<br>Y ese tipo de recuerdos… tampoco.</p>
        <p style="${pStyle}">Por eso te he preparado un tutorial muy corto:<br>Un truco de magia que puedes hacer tú mismo a tu hijo,<br>aunque no tengas ninguna experiencia.</p>
        <p style="${pStyle}">Solo necesitas un vaso, un poco de papel de aluminio… y tres minutos.</p>
        <p style="${pStyle}"><a href="${tutorialUrl}" style="${linkStyle}font-weight:bold;">Haz clic aquí para aprender el secreto de la desaparición inesperada.</a></p>
        <p style="${pStyle}"><strong>LA CONTRASEÑA: Ander</strong><br>Es el nombre de quien me introdujo en el tenis (a mis 4 años).</p>
        <p style="${pStyle}">Hazlo.<br>Disfrútalo.<br>Y si te animas, grábalo y me envías el vídeo o me cuentas qué pasó.</p>
        <p style="margin:0 0 2rem 0;">Te prometo que si lo haces, tengo otro truco aún más mágico para ti.<br>Por cierto, ¿qué edad tiene tu peque?<br>Respóndeme con un número.<br>Así te puedo enviar trucos acordes a su edad.</p>
        <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
        <p style="${pdStyle}"><strong>Pd:</strong> ¿Prefieres recibir los próximos mails en euskera?<br><a href="${euskeraUrl}" style="${linkStyle}">Clic aquí</a></p>
        <p style="${pdStyle}"><strong>Pd2:</strong> Si no te quieres perder mis emails, mueve este ahora a tu bandeja principal.</p>
        <p style="${pdStyle}"><strong>Pd3:</strong> Si un día te aburres de recibir mis mails, no pasa nada.<br>Al final de todos hay un botón para hacerme desaparecer.</p>
        <p style="${pdStyle}"><strong>Pd4:</strong> ¿Tienes un cumpleaños que celebrar?<br><a href="${contactoUrl}" style="${linkStyle}">Haz clic aquí y hablemos.</a><br>Si quieres que hablen y recuerden ese día especial durante años, es lo mejor que te puedo recomendar.<br>Tanto para tu hijo de 8 años, como para tu padre de 65.</p>
        <p style="${pdStyle}"><strong>Pd5:</strong> pd, pd, pd…</p>
      `),
  });

  // Mail 2 — +2 días
  const twoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const mail2 = await resend.emails.send({
    from: "Alain Zulaika <contacto@niala.es>",
    to: email,
    replyTo: "contacto@niala.es",
    subject: isEu ? "Onena ez zen trukoa… zure anekdota baizik." : "Lo mejor no fue el truco… es vuestra anécdota.",
    scheduledAt: twoDays.toISOString(),
    html: isEu
      ? wrap(`
        <p style="${pStyle}">Entzun,<br>Edo hobeto, irakurri.</p>
        <p style="${pStyle}">Edalontziaren trukoa egin zenion zure txikiari?<br>Jakin nahi det.</p>
        <p style="${pStyle}">Istorio paregabeak iritsi zaizkit.<br>Ama batek objektua desagerrarazi nahi izan zuen…<br>edalontzia erori zitzaion eta bere alabak ikusi zuen.</p>
        <p style="${pStyle}">Familia guztia barrez.<br>Alaba ere bai.<br>Azkenean ez zen espero bezala atera, baina oroitzapena berdin sortu zen.</p>
        <p style="${pStyle}">Orain zuri galdetzen dizut:<br>– Noiz egin zenion?<br>– Zer esan zuen zure seme-alabak?<br>– Barre egin zuen? Flipatu? Sekretua oihukatu zuen?<br>– Bideoa al duzue?</p>
        <p style="${pStyle}">Erantzun iezadazu email honetara gertatutakoa kontatuz… eta bigarren truko bat bidaliko dizut.<br>Are bisualagoa. Are zuzenagoa.</p>
        <p style="${pStyle}">Zuk egin dezakezun bat…<br>edo 4 urte baino gehiago baditu, zure seme-alabari ere irakatsi diezaiokezun bat.</p>
        <p style="margin:0 0 2rem 0;">Irakurtzen zaitut.</p>
        <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
        <p style="${pdStyle}"><strong>Pd:</strong> Eta email honi bezala, nahi duzunean erantzun ahal dituzu nire mezuak.<br>Iritzia emateko, hitz egiteko, afari batera gonbidatzeko, galdetzeko…<br>Dena irakurtzen det. Eta ia dena erantzuten det.</p>
      `)
      : wrap(`
        <p style="${pStyle}">Oye,<br>O bueno, lee.</p>
        <p style="${pStyle}">¿Le hiciste el truco del vaso a tu peque?<br>Quiero saberlo.</p>
        <p style="${pStyle}">Te lo digo porque me han llegado historias geniales.<br>Como una madre que intentó hacer desaparecer el objeto…<br>se le cayó el vaso y su hija lo vio.</p>
        <p style="${pStyle}">Toda la familia riéndose.<br>La hija también.<br>Al final, no salió como esperaba, pero el recuerdo se creó igual.</p>
        <p style="${pStyle}">Ahora te pregunto a ti:<br>– ¿Cuándo se lo hiciste?<br>– ¿Qué dijo tu hijo?<br>– ¿Se rió? ¿Alucinó? ¿Gritó el secreto?<br>– ¿Tenéis vídeo?</p>
        <p style="${pStyle}">Respóndeme a este email contándome lo que pasó… y te mandaré un segundo truco.<br>Más visual.<br>Más directo.</p>
        <p style="${pStyle}">Uno que puedes hacer tú…<br>o incluso enseñárselo a tu hijo si tiene más de 4 años.</p>
        <p style="margin:0 0 2rem 0;">Pero solo si me cuentas cómo fue el primero.<br>Te leo.<br>Y mañana mismo, si me has escrito, te lo mando.</p>
        <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
        <p style="${pdStyle}"><strong>Pd:</strong> Y al igual que a este mail, siéntete libre de responderme cuando quieras.<br>Ya sea para opinar, conversar, invitarme a cenar, preguntar…<br>Me leo todo.<br>Y respondo a casi todo.</p>
      `),
  });

  // Mail 3 — +4 días
  const fourDays = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

  const faqsEs = [
    "Alain, ¿me enseñas otro truco?",
    "¿Si hago magia, me llamarán friki?",
    "¿Te tiemblan las manos cuando haces magia?",
    "Eres un friki.",
    "¿Y si soy un manazas? ¿También puedo aprender?",
    "Me he motivao, ¿qué baraja me recomiendas?",
    "¿Es solo para niños o también lo puedo disfrutar yo?",
    "¿Lo puedo regalar a mi hijo/a si tiene 10 años?",
    "¿No será como esos kits baratos de juguetería, no?",
    "¿Qué lleva exactamente la baraja?",
    "¿Y si mi hijo quiere aprender solo?",
    "¿Está ya disponible?",
    "¿Y el curso?",
    "¿Puedo hacer un show completo con esto?",
    "¿Me va a dar miedo no saber hacerlo bien?",
    "¿Vale para practicar juntos? ¿Tipo \"actividad de domingo\"?",
    "¿Esto sirve también para crear recuerdos?",
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

  const faqsEu = [
    "Alain, beste truko bat irakatsi al diazu?",
    "Magia egiten badut, friki deituko al didate?",
    "Eskuak dardar egiten dizute magia egiten dezunian?",
    "Friki bat zara.",
    "Eta patoso bat banaiz? Nik ere ikasi al dezaket?",
    "Motibatu naiz, ze karta-sorta gomendatzen didazu?",
    "Umeekin bakarrik da ala ni ere gozatu al dezaket?",
    "Opari gisa eman al dakioket nire seme-alabari 10 urte baditu?",
    "Ez da jostailu-dendako magia-kit bat merkeagoa izango?",
    "Zer dakar zehazki baraja horrek?",
    "Eta nire seme-alabak bakarrik ikasi nahi badu?",
    "Dagoeneko erabilgarri al dago?",
    "Eta ikastaroa?",
    "Show oso bat egin al dezaket honekin?",
    "Beldur banaiz gaizki egiteko?",
    "Elkarrekin praktikatzeko balio al du? Astebukuerako jarduera gisa?",
    "Honek ere oroitzapenak sortzeko balio al du?",
    "Eta norbaiti oparitu nahi baduot?",
    "Zein da edalontziaren trukoa egin osteko hurrengo pausoa?",
    "Edalontzia hautsi dut, zer egin behar det?",
    "Zu zeuk baraja bat saltzen al duzu?",
    "Egunero praktikatzeko zerbait gomendatzen al didazu?",
    "Zein da zure ikastaro eta bertan dagoenaren arteko aldea?",
    "Iruzurgile bat zara!",
    "Magia bisuala da edo psikologikoagoa?",
    "Memoria ona behar al da?",
    "Nola eta noiz lor dezaket?",
  ];

  const faqs = isEu ? faqsEu : faqsEs;
  const faqLinkText = isEu ? "Irakurri orrialde hau" : "Lee esta página";

  const faqHtml = faqs
    .map((q) => `<p style="margin:0 0 0.2rem;font-style:italic;color:#555;">${q}</p><p style="margin:0 0 1.4rem;"><a href="${eguzkiloreUrl}" style="${linkStyle}">${faqLinkText}</a></p>`)
    .join("");

  const mail3 = await resend.emails.send({
    from: "Alain Zulaika <contacto@niala.es>",
    to: email,
    replyTo: "contacto@niala.es",
    subject: isEu ? "Galdera arruntak (eta barregarriak)" : "Preguntas normales (y otras que me hacen reír)",
    scheduledAt: fourDays.toISOString(),
    html: wrap(faqHtml),
  });

  // Guardar IDs de emails programados para poder cancelarlos si se da de baja
  const mail2Id = (mail2 as { data?: { id?: string } }).data?.id;
  const mail3Id = (mail3 as { data?: { id?: string } }).data?.id;

  if (mail2Id || mail3Id) {
    await supabase
      .from("mision_contactos")
      .update({ mail2_id: mail2Id ?? null, mail3_id: mail3Id ?? null })
      .eq("email", email);
  }

  return NextResponse.json({ ok: true });
}
