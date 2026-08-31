// Contenido de las secuencias de Comodín y Tu Misión tal y como estaba
// escrito en el cron.
//
// Sigue aquí como RESERVA: el cron busca primero el mail en secuencia_mails
// (editable desde /admin) y solo usa esto si no encuentra fila activa. Así,
// si alguien vacía o desactiva una fila por error, el correo sigue saliendo
// en vez de dejar de enviarse en silencio.
//
// Los envoltorios (cabecera, pie y enlace de baja) NO se guardan en la base
// de datos: son distintos para cada secuencia y no hay nada que editar en
// ellos. En la tabla vive solo el cuerpo.

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://alainzulaika.com";

export function wrapComodin(content: string, email: string, isEu: boolean) {
  const bajaUrl = `${BASE_URL}/api/comodin/baja?email=${encodeURIComponent(email)}`;
  const text = isEu ? "Utzi email hauek jasotzeari" : "Dejar de recibir estos emails";
  const contactEmail = isEu ? "kontaktu@alainzulaika.com" : "contacto@alainzulaika.com";
  return `<div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;"><div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">${content}</div><div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.95rem;color:#555;line-height:1.9;"><p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:${contactEmail}" style="color:#555;">${contactEmail}</a></p><p style="margin:0;"><a href="${bajaUrl}" style="color:#555;">${text}</a></p></div></div>`;
}

export function wrapMision(content: string, email: string, isEu: boolean) {
  const bajaUrl = `${BASE_URL}/api/mision/baja?email=${encodeURIComponent(email)}`;
  const text = isEu ? "Utzi email hauek jasotzeari" : "Dejar de recibir estos emails";
  const contactEmail = isEu ? "kontaktu@alainzulaika.com" : "contacto@alainzulaika.com";
  return `<div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;"><div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">${content}</div><div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.95rem;color:#555;line-height:1.9;"><p style="margin:0 0 0.25rem;">Alain Zulaika · <a href="mailto:${contactEmail}" style="color:#555;">${contactEmail}</a></p><p style="margin:0;"><a href="${bajaUrl}" style="color:#555;">${text}</a></p></div></div>`;
}

const p = `margin:0 0 1.6rem 0;`;
const pd = `font-size:1.15rem;color:#1a1a1a;line-height:2.1;margin-top:0.5rem;`;
const lk = `color:#2a9d8f;`;

export function comodinMail2(email: string, isEu: boolean) {
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

export function comodinMail3(email: string, isEu: boolean) {
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

export function misionMail2(email: string, isEu: boolean) {
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

export function misionMail3(email: string, isEu: boolean) {
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

/** URLs que los mails de Comodín y Misión insertan en su cuerpo. */
export interface UrlsMail1 extends Record<string, string> {
  tutorial: string;
  cambiar_idioma: string;
  contacto: string;
  entrenamiento: string;
}

/**
 * Los valores de {{tutorial}}, {{cambiar_idioma}}, {{contacto}} y
 * {{entrenamiento}} para una persona concreta.
 *
 * Vive aquí y no repetido en cada ruta porque lo necesitan tres sitios: el
 * envío del mail 1 de Comodín, el de Misión, y el cron que manda los mails 2
 * y 3. Ese último no los pasaba, así que un mail 2 escrito desde el panel
 * con un {{tutorial}} habría salido con el marcador literal en la bandeja
 * —el mismo fallo que tenía el mail de cortesía—. Hoy no hay ninguno escrito
 * ahí, así que era una trampa esperando, no un correo roto.
 */
export function urlsSecuencia(secuencia: "comodin" | "mision", email: string, isEu: boolean): UrlsMail1 {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://alainzulaika.com";
  const contactEmail = isEu ? "kontaktu@alainzulaika.com" : "contacto@alainzulaika.com";
  const camino = secuencia === "comodin" ? "comodin" : "tumision";
  const otroIdioma = isEu ? "es" : "eu";
  return {
    tutorial: isEu ? `${base}/${camino}/tutorial` : `${base}/es/${camino}/tutorial`,
    cambiar_idioma: `${base}/api/${secuencia}/idioma?email=${encodeURIComponent(email)}&idioma=${otroIdioma}`,
    contacto: isEu ? `${base}/contacto` : `${base}/es/contacto`,
    entrenamiento: `mailto:${contactEmail}?subject=Entrenamiento&body=Hola%20Alain%2C%20inf%C3%B3rmame%20sobre%20c%C3%B3mo%20trabajas.`,
  };
}

export function comodinMail1(isEu: boolean, u: UrlsMail1) {
  const subject = isEu ? "Eskuan eman nizun trukoa" : "El truco que te di en mano";
  const cuerpo = isEu
    ? `
        <p style="${p}">Txartel horrek…<br>egin du lehen ilusioa dagoeneko.</p>
        <p style="${p}">Baina onena ez da txartela.<br>Zuk zeuk edozein sukaldeko objetuekin egin dezakezuna baizik.</p>
        <p style="${p}">Edalontzi bat.<br>Aluminiozko papera.<br>Edozein objektu.<br>Pase magiko bat...<br>puf!<br>Desagertu egiten da.</p>
        <p style="${p}">Hiru minututan ikasi eta hurrengo afarian denak liluratuko dituzu.</p>
        <p style="${p}">Tutorial labur bat presta dizut:<br>Ustekabeko desagerpenaren sekretua.<br>Esperientziarik gabe. Material berezirik gabe. Aldez aurretiko ezagutzarik gabe.</p>
        <p style="${p}"><a href="${u.tutorial}" style="${lk}font-weight:bold;">Egin klik hemen sekretua ikasteko.</a></p>
        <p style="margin:0 0 2rem 0;">Proba ezazu.<br>Gozatu.<br>Eta animatzen bazera, erantzun eta kontatu non egin zenuen eta nola erreakzionatu zuten.</p>
        <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
        <p style="${pd}"><strong>Pd:</strong> Gaztelaniaz jaso nahi dituzu hurrengo emailak?<br><a href="${u.cambiar_idioma}" style="${lk}">Klik hemen</a></p>
        <p style="${pd}"><strong>Pd2:</strong> Nire hurrengo emailak ez galtzeko: mugitu mezu hau zure sarrera nagusira.</p>
        <p style="${pd}"><strong>Pd3:</strong> Noizbait nire mezuak jasotzeaz aspertzen bazera, ez dago arazorik. Amaieran ni desagertarazteko botoi bat daukazu beti.</p>
        <p style="${pd}"><strong>Pd4:</strong> Ekitaldi bat berezia egin nahi duzu? <a href="${u.contacto}" style="${lk}">Egin klik hemen eta hitz egin dezagun.</a> Enpresa-ekitaldiak, ekitaldi kulturalak, festa pribatuak… Normalean hamar minutuko solasaldi batekin zentzurik ote duen argitzen duzu.</p>
        <p style="${pd}"><strong>Pd5:</strong> Bide batez, newsletter honetan ez dut soilik magiaz hitz egiten. Entrenamendua, osasuna eta kontatu nahi dudana ere bai. Baliteke ez espero izatea.</p>
        <p style="${pd}"><strong>Pd6:</strong> Bai, mago izateaz gain, entrenatzaile naiz. Zure forma fisikoa hobetu nahi duzu? Sakatu hemen → <a href="${u.entrenamiento}" style="${lk}">Interesatzen zait.</a></p>
        <p style="${pd}"><strong>Pd7:</strong> Mezu honi "kaixo" batekin erantzuten badidazu, gmailek hau spam ez dela ulertzen lagunduko didazu, eskerrik asko.<br>Gainera nor zaren, nola ezagutu nauzun eta nire mailetik zer espero duzun kontatzen badidazu... eguna alaituko didazu.</p>
        <p style="${pd}"><strong>Pd8:</strong> pd,pd,pd,pd...</p>
      `
    : `
        <p style="${p}">Esa tarjeta que tienes…<br>ya ha hecho su primera ilusión.</p>
        <p style="${p}">Pero lo bueno no es la tarjeta.<br>Es lo que puedes hacer tú con lo que hay en cualquier cocina.</p>
        <p style="${p}">Un vaso.<br>Papel de aluminio.<br>Un objeto cualquiera.<br>Pase mágico...<br>¡puff!<br>Desaparece.</p>
        <p style="${p}">He visto a gente aprenderlo en tres minutos y dejarlo todo callado en la siguiente cena.<br>Al que más dudaba, primero.</p>
        <p style="${p}">Por eso te he preparado un tutorial muy corto:<br>El secreto de la desaparición inesperada.<br>Sin experiencia. Sin material especial. Sin ensayo previo.</p>
        <p style="${p}"><a href="${u.tutorial}" style="${lk}font-weight:bold;">Haz clic aquí para aprender el secreto.</a></p>
        <p style="margin:0 0 2rem 0;">Hazlo.<br>Disfrútalo.<br>Y si te animas, respóndeme y cuéntame dónde lo hiciste y cómo reaccionaron.</p>
        <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
        <p style="${pd}"><strong>Pd:</strong> ¿Prefieres recibir los próximos mails en euskera?<br><a href="${u.cambiar_idioma}" style="${lk}">Clic aquí</a></p>
        <p style="${pd}"><strong>Pd2:</strong> Si no te quieres perder mis emails, mueve este ahora a tu bandeja principal.</p>
        <p style="${pd}"><strong>Pd3:</strong> Si un día te aburres de recibir mis mails, no pasa nada. Al final de todos hay un botón para hacerme desaparecer.</p>
        <p style="${pd}"><strong>Pd4:</strong> ¿Tienes un evento que hacer especial? <a href="${u.contacto}" style="${lk}">Haz clic aquí y hablemos.</a> Eventos de empresa, eventos culturales, fiestas privadas… Diez minutos de conversación suelen aclarar si tiene sentido.</p>
        <p style="${pd}"><strong>Pd5:</strong> Por cierto, en este newsletter no solo hablo de magia. También de entrenamiento, salud y lo que me apetezca. Por si acaso no te lo esperabas.</p>
        <p style="${pd}"><strong>Pd6:</strong> Sí, más allá de mago, soy entrenador. ¿Te interesa mejorar tu condición física? Dale aquí → <a href="${u.entrenamiento}" style="${lk}">Me interesa.</a></p>
        <p style="${pd}"><strong>Pd7:</strong> Si respondes a este mail con un "hola" me ayudas a que gmail entienda que esto no es spam, gracias.<br>Si encima me cuentas quien eres, como me has conocido, que esperas recibir en mis mails... me alegras el día.</p>
        <p style="${pd}"><strong>Pd8:</strong> pd,pd,pd,pd...</p>
      `;
  return { subject, cuerpo };
}

export function misionMail1(isEu: boolean, u: UrlsMail1) {
  const subject = isEu ? "Zure guraso misioa" : "Tu misión como madre (o padre)";
  const cuerpo = isEu
    ? `
        <p style="${p}">Zure seme-alabak eraman zuen txartel horrek…<br>egin du lehen trukoa dagoeneko (zure laguntzari esker).</p>
        <p style="${p}">Baina misioa ez da hemen amaitzen.<br>Ikuskizunean bizitako magiak aste honetan jarrai dezake…<br>zuen etxeko egongelan (edo sukaldean).</p>
        <p style="${p}">Lur izeneko lehengusina bat daukat.<br>Bi urte baino ez ditu.<br>Eta dagoeneko bere lehen desagerpen magikoak bizi izan ditu.</p>
        <p style="${p}">Edalontzi bat.<br>Aluminiozko papera.<br>Tenis pilota bat (edo edozein objektu).<br>Pase magiko bat...<br>puf!<br>Desagertu egiten da.</p>
        <p style="${p}">Bere amak ere saiatu ziren.<br>Lehenengo barre egin zuten, gero lehiatu ziren…<br>eta azkenean lortu zutenean, Lurren erreakzioa izugarria izan zen.</p>
        <p style="${p}">Begi urdin haiek distira egiten… ez dira ahazten.<br>Eta horrelako oroitzapenak… ezta ere.</p>
        <p style="${p}">Horregatik prestatu dizut tutorial labur bat:<br>Zuk zeuk zure seme-alabari egin ahal diozun truko bat,<br>inolako esperientziarik gabe.</p>
        <p style="${p}">Edalontzi bat, zilarrezko paper pixka bat… eta hiru minutu besterik ez dituzu behar.</p>
        <p style="${p}"><a href="${u.tutorial}" style="${lk}font-weight:bold;">Egin klik hemen ustekabeko desagerpenaren sekretua ikasteko.</a></p>
        <p style="${p}"><strong>PASAHITZA: Ander</strong><br>Tenis munduan (4 urterekin) murgildu ninduen lagunaren izena da.</p>
        <p style="margin:0 0 2rem 0;">Proba ezazu.<br>Gozatu.<br>Eta animatzen bazera, grabatu eta bidali iezadazu bideoa edo kontatu zer gertatu zen.</p>
        <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
        <p style="${pd}"><strong>Pd:</strong> Gaztelaniaz jaso nahi dituzu hurrengo emailak?<br><a href="${u.cambiar_idioma}" style="${lk}">Klik hemen</a></p>
        <p style="${pd}"><strong>Pd2:</strong> Ez galdu nire hurrengo emailak: mugitu mezu hau zure sarrera nagusira.</p>
        <p style="${pd}"><strong>Pd3:</strong> Noizbait nire mezuak jasotzeaz aspertzen bazera, ez dago arazorik. Amaieran ni desagertarazteko botoi bat daukazu beti.</p>
        <p style="${pd}"><strong>Pd4:</strong> Urtebetetze edo beste ekitaldi bat ospatu nahi duzu? <a href="${u.contacto}" style="${lk}">Egin klik hemen eta hitz egin dezagun.</a> Zure 8 urteko seme-alabarentzat edo zure 65 urteko aitarentzat, urteetan zehar gogoratuko dutena da.</p>
        <p style="${pd}"><strong>Pd5:</strong> Bide batez, newsletter honetan ez dut soilik magiaz hitz egiten. Entrenamendua, osasuna eta kontatu nahi dudana ere bai. Baliteke ez espero izatea.</p>
        <p style="${pd}"><strong>Pd6:</strong> Bai, mago izateaz gain, entrenatzaile naiz. Zure forma fisikoa hobetu nahi duzu? Sakatu hemen → <a href="${u.entrenamiento}" style="${lk}">Interesatzen zait.</a></p>
        <p style="${pd}"><strong>Pd7:</strong> Mezu honi "kaixo" batekin erantzuten badidazu, gmailek hau spam ez dela ulertzen lagunduko didazu, eskerrik asko.<br>Gainera nor zaren, nola ezagutu nauzun eta nire mailetik zer espero duzun kontatzen badidazu... eguna alaituko didazu.</p>
        <p style="${pd}"><strong>Pd8:</strong> pd,pd,pd,pd...</p>
      `
    : `
        <p style="${p}">Esa tarjeta que tu hijo se llevó…<br>ya ha hecho su primer truco (gracias a tu ayuda).</p>
        <p style="${p}">Pero la misión no acaba ahí.<br>La magia que vivisteis en el espectáculo puede continuar esta misma semana…<br>en el salón de vuestra casa (o en la cocina).</p>
        <p style="${p}">Tengo una prima que se llama Lur.<br>Tiene solo dos años.<br>Y ya ha vivido sus primeras desapariciones mágicas.</p>
        <p style="${p}">Un vaso.<br>Papel de aluminio.<br>Una pelota de tenis (o cualquier objeto).<br>Pase mágico...<br>¡puff!<br>Desaparece.</p>
        <p style="${p}">Vi cómo sus madres lo intentaban también.<br>Primero se reían, luego se picaban…<br>y cuando por fin lo consiguieron, la reacción de Lur fue brutal.</p>
        <p style="${p}">Esos ojos azules brillando no se olvidan.<br>Y ese tipo de recuerdos… tampoco.</p>
        <p style="${p}">Por eso te he preparado un tutorial muy corto:<br>Un truco de magia que puedes hacer tú mismo a tu hijo,<br>aunque no tengas ninguna experiencia.</p>
        <p style="${p}">Solo necesitas un vaso, un poco de papel de aluminio… y tres minutos.</p>
        <p style="${p}"><a href="${u.tutorial}" style="${lk}font-weight:bold;">Haz clic aquí para aprender el secreto de la desaparición inesperada.</a></p>
        <p style="${p}"><strong>LA CONTRASEÑA: Ander</strong><br>Es el nombre de quien me introdujo en el tenis (a mis 4 años).</p>
        <p style="margin:0 0 2rem 0;">Hazlo.<br>Disfrútalo.<br>Y si te animas, grábalo y me envías el vídeo o me cuentas qué pasó.</p>
        <div style="border-top:1px solid #eee;margin:1.5rem 0;"></div>
        <p style="${pd}"><strong>Pd:</strong> ¿Prefieres recibir los próximos mails en euskera?<br><a href="${u.cambiar_idioma}" style="${lk}">Clic aquí</a></p>
        <p style="${pd}"><strong>Pd2:</strong> Si no te quieres perder mis emails, mueve este ahora a tu bandeja principal.</p>
        <p style="${pd}"><strong>Pd3:</strong> Si un día te aburres de recibir mis mails, no pasa nada. Al final de todos hay un botón para hacerme desaparecer.</p>
        <p style="${pd}"><strong>Pd4:</strong> ¿Tienes un cumpleaños u otro evento que celebrar? <a href="${u.contacto}" style="${lk}">Haz clic aquí y hablemos.</a> Tanto para tu hijo de 8 años como para tu padre de 65, es lo que mejor recuerdan años después.</p>
        <p style="${pd}"><strong>Pd5:</strong> Por cierto, en este newsletter no solo hablo de magia. También de entrenamiento, salud y lo que me apetezca. Por si acaso no te lo esperabas.</p>
        <p style="${pd}"><strong>Pd6:</strong> Sí, más allá de mago, soy entrenador. ¿Te interesa mejorar tu condición física? Dale aquí → <a href="${u.entrenamiento}" style="${lk}">Me interesa.</a></p>
        <p style="${pd}"><strong>Pd7:</strong> Si respondes a este mail con un "hola" me ayudas a que gmail entienda que esto no es spam, gracias.<br>Si encima me cuentas quien eres, como me has conocido, que esperas recibir en mis mails... me alegras el día.</p>
        <p style="${pd}"><strong>Pd8:</strong> pd,pd,pd,pd...</p>
      `;
  return { subject, cuerpo };
}
