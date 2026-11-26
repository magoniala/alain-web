// Textos de la preventa de las masterclasses (castellano y euskera): lo legal
// que se repite en la landing y en los correos, y los correos automáticos.
//
// Sin dependencias de servidor: lo importan la landing (cliente) y lib/preventa.ts.
// Reglas de Alain para el copy: comillas "así", nunca «así»; sin separadores;
// preguntas sin ¿ de apertura y con ??; postdata como "Pd:".
// El euskera es de Álex y Alain no lo ha repasado (26-11-2026).

import { FECHAS, NOMBRE, euros, type Idioma, type Producto, type CasoRecuento } from "./preventa-reglas";

export const CONTACTO = "contacto@alainzulaika.com";
export const BASE_ENT = "https://entrenatzaile.alainzulaika.com";

/** Ruta pública de cada página de la preventa en el subdominio. */
export function rutaPreventa(l: Idioma, pagina: "" | "gracias" | "desistimiento" | "acceso" = ""): string {
  const base = l === "es" ? "/es/masterclass" : "/masterclass";
  return pagina ? `${base}/${pagina}` : base;
}

const HILABETEAK = ["urtarrilaren", "otsailaren", "martxoaren", "apirilaren", "maiatzaren", "ekainaren", "uztailaren", "abuztuaren", "irailaren", "urriaren", "azaroaren", "abenduaren"];

/** "lunes 28 de diciembre" (con el año si no es 2026) · "2026ko abenduaren 28a". En hora de Madrid. */
export function fechaLarga(d: Date, l: Idioma): string {
  const p = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", year: "numeric" }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const mes = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", month: "numeric" }).format(d));
  if (l === "eu") return `${v("year")}ko ${HILABETEAK[mes - 1]} ${v("day")}a`;
  return `${v("weekday")} ${v("day")} de ${v("month")}${v("year") === "2026" ? "" : ` de ${v("year")}`}`;
}

// ---------------------------------------------------------------------------
// Legal: desistimiento, aviso de salud, datos
// ---------------------------------------------------------------------------

export const DESISTIMIENTO: Record<Idioma, { titulo: string; parrafos: string[] }> = {
  es: {
    titulo: "Devolución y derecho de desistimiento",
    parrafos: [
      "Tienes 15 días naturales desde la compra para desistir sin dar ningún motivo. Y como las masterclasses se entregan más tarde, tienes además otros 15 días naturales desde el día en que recibas el acceso.",
      `Para desistir, dímelo de forma clara: con el formulario de desistimiento de esta web, respondiendo al correo de confirmación de la compra o escribiendo a ${CONTACTO}. Puedes usar el modelo de formulario, pero no es obligatorio.`,
      "Te devuelvo todo lo que pagaste sin demora y como muy tarde en 14 días naturales desde que me lo digas, por el mismo medio de pago y sin ningún coste para ti.",
      "Y aparte de esto, si no se llega a 3 personas, te devuelvo el dinero igual, sin que tengas que pedírmelo.",
    ],
  },
  eu: {
    titulo: "Itzulketa eta atzera egiteko eskubidea",
    parrafos: [
      "Erosi eta 15 egun natural dituzu atzera egiteko, inolako arrazoirik eman gabe. Eta masterclassak geroago ematen direnez, beste 15 egun natural ere badituzu sarbidea jasotzen duzun egunetik aurrera.",
      `Atzera egiteko, esan iezadazu argi: webgune honetako atzera egiteko formularioarekin, erosketaren berrespen-mezuari erantzunez edo ${CONTACTO} helbidera idatziz. Formulario-eredua erabil dezakezu, baina ez da derrigorrezkoa.`,
      "Ordaindutako guztia itzuliko dizut berehala, eta gehienez ere 14 egun naturaleko epean, esaten didazunetik, ordaintzeko bide beretik eta zuretzat inolako kosturik gabe.",
      "Eta horrez gain, 3 pertsonara iristen ez bagara, dirua itzuliko dizut berdin, zuk eskatu beharrik gabe.",
    ],
  },
};

/** Modelo de formulario de desistimiento (anexo B del texto refundido de consumidores). */
export const MODELO_DESISTIMIENTO: Record<Idioma, string> = {
  es: [
    `A la atención de Alain Zulaika Fuente (Entrenatzaile), 20870 Elgoibar (Gipuzkoa), ${CONTACTO}:`,
    "Por la presente le comunico que desisto de mi contrato de la prestación del siguiente servicio: masterclass en vídeo [cuál].",
    "Comprado el: [fecha]",
    "Nombre: [tu nombre]",
    "Correo con el que compré: [tu correo]",
    "Fecha: [fecha de hoy]",
  ].join("\n"),
  eu: [
    `Alain Zulaika Fuente (Entrenatzaile), 20870 Elgoibar (Gipuzkoa), ${CONTACTO}:`,
    "Honen bidez jakinarazten dizut atzera egiten dudala zerbitzu honen kontratutik: bideozko masterclassa [zein].",
    "Erosketa-data: [data]",
    "Izena: [zure izena]",
    "Erosteko erabili nuen posta: [zure posta]",
    "Data: [gaurko data]",
  ].join("\n"),
};

export const AVISO_SALUD: Record<Idioma, string> = {
  es: "Aviso de salud: estas masterclasses no sustituyen el consejo de tu médico ni de tu fisioterapeuta. Si tienes dolor de espalda, una lesión o cualquier problema de salud, consulta con tu médico antes de empezar a entrenar, y deja un ejercicio si te aumenta el dolor.",
  eu: "Osasun-oharra: masterclass hauek ez dute zure medikuaren edo fisioterapeutaren aholkua ordezten. Bizkarreko mina, lesioren bat edo osasun-arazoren bat baduzu, galdetu zure medikuari entrenatzen hasi aurretik, eta utzi ariketa bat mina handitzen badizu.",
};

export const DATOS: Record<Idioma, string> = {
  es: "Protección de datos: el responsable es Alain Zulaika Fuente. Uso tu nombre y tu correo para gestionar tu compra, mandarte la masterclass y, si toca, devolverte el dinero (base: el contrato). El pago lo procesa Stripe; yo no veo los datos de tu tarjeta. Las facturas se guardan 6 años y los datos de las devoluciones, hasta que prescriban las posibles reclamaciones. Puedes ejercer tus derechos escribiendo a " + CONTACTO + ". Más en la política de privacidad.",
  eu: "Datuen babesa: arduraduna Alain Zulaika Fuente da. Zure izena eta posta erabiltzen ditut erosketa kudeatzeko, masterclassa bidaltzeko eta, behar izanez gero, dirua itzultzeko (oinarria: kontratua). Ordainketa Stripek kudeatzen du; nik ez ditut zure txartelaren datuak ikusten. Fakturak 6 urtez gordetzen dira, eta itzulketen datuak, erreklamazioak preskribatu arte. Zure eskubideak erabiltzeko, idatzi " + CONTACTO + " helbidera. Gehiago, pribatutasun-politikan.",
};

export const CASILLA_NEWSLETTER: Record<Idioma, string> = {
  es: "Quiero recibir también el correo diario de Alain (entrenamiento y lo que voy aprendiendo). Me puedo dar de baja cuando quiera.",
  eu: "Alainen eguneroko posta ere jaso nahi dut (entrenamendua eta ikasten dudana). Nahi dudanean eman dezaket baja.",
};

export const BOTON_PAGO: Record<Idioma, string> = {
  es: "Pedido con obligación de pago",
  eu: "Ordaintzeko betebeharra duen eskaera",
};

/** Lo que se enseña justo antes del botón de pago (y se guarda tal cual en la compra). */
export function infoPrevia(p: Producto, importeCent: number, l: Idioma): string[] {
  const entregaB = fechaLarga(FECHAS.entregaB, l);
  const entregaA = fechaLarga(FECHAS.entregaA, l);
  if (l === "eu") {
    const que =
      p === "B"
        ? `"${NOMBRE.B.eu}" masterclassa`
        : p === "A"
          ? `"${NOMBRE.A.eu}" masterclassa, eta "${NOMBRE.B.eu}" opari`
          : `"${NOMBRE.A.eu}" masterclassa (hastekoa baduzu jada: aldea bakarrik ordaintzen duzu)`;
    return [
      `Zer erosten duzu: ${que}.`,
      `Azken prezioa: ${euros(importeCent)}, BEZa (% 21) barne.`,
      p === "B" ? `Noiz jasoko duzu: ${entregaB}.` : `Noiz jasoko duzu: hastekoa ${entregaB}; bizkarrekoa ${entregaA}.`,
      "Aurrez salmenta da: gutxienez 3 pertsona apuntatzen badira bakarrik grabatzen dut. Abenduaren 10ean kontatuko dut; iristen ez bagara, dirua itzuliko dizut.",
      "Atzera egitea: 15 egun erosketatik eta beste 15 sarbidea jasotzen duzunetik.",
      "Bideoak gaztelaniaz daude. Nire webgunean ikusten dira zure postarekin, 24 hilabetez; ezin dira deskargatu.",
    ];
  }
  const que =
    p === "B"
      ? `la masterclass "${NOMBRE.B.es}"`
      : p === "A"
        ? `la masterclass "${NOMBRE.A.es}" y, de regalo, "${NOMBRE.B.es}"`
        : `la masterclass "${NOMBRE.A.es}" (ya tienes la de empezar: pagas solo la diferencia)`;
  return [
    `Qué compras: ${que}.`,
    `Precio final: ${euros(importeCent)}, IVA (21 %) incluido.`,
    p === "B" ? `Cuándo la recibes: el ${entregaB}.` : `Cuándo las recibes: la de empezar, el ${entregaB}; la de la espalda, el ${entregaA}.`,
    "Es una preventa: la grabo solo si se apuntan al menos 3 personas. Lo cuento el 10 de diciembre; si no llegamos, te devuelvo el dinero.",
    "Desistimiento: 15 días desde la compra y otros 15 desde que recibas el acceso.",
    "Los vídeos están en castellano. Se ven en mi web con tu correo, durante 24 meses; no se pueden descargar.",
  ];
}

// ---------------------------------------------------------------------------
// Correos
// ---------------------------------------------------------------------------

const P = "margin:0 0 1.4rem 0;";
const PEQ = "margin:0 0 0.9rem 0;font-size:0.95rem;color:#444;";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const parr = (s: string) => `<p style="${P}">${s}</p>`;

/** Envoltorio de los correos de la preventa: transaccionales, sin enlace de baja. */
export function envolver(cuerpo: string): string {
  return `
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
      <div style="font-size:1.1rem;line-height:1.9;color:#1a1a1a;">${cuerpo}</div>
      <div style="margin-top:2.5rem;padding-top:1.2rem;border-top:1px solid #eee;font-size:0.88rem;color:#666;line-height:1.8;">
        <p style="margin:0;">Alain Zulaika · Entrenatzaile · <a href="mailto:${CONTACTO}" style="color:#666;">${CONTACTO}</a></p>
      </div>
    </div>`;
}

function bloqueDesistimiento(l: Idioma): string {
  const d = DESISTIMIENTO[l];
  const form = `${BASE_ENT}${rutaPreventa(l, "desistimiento")}`;
  const modelo = MODELO_DESISTIMIENTO[l].split("\n").map(esc).join("<br>");
  return `
    <p style="${P}"><strong>${d.titulo}</strong></p>
    ${d.parrafos.map((t) => `<p style="${PEQ}">${esc(t)}</p>`).join("")}
    <p style="${PEQ}">${l === "es" ? "Formulario de desistimiento" : "Atzera egiteko formularioa"}: <a href="${form}">${form}</a></p>
    <p style="${PEQ}">${l === "es" ? "Modelo de formulario" : "Formulario-eredua"}:<br>${modelo}</p>`;
}

function saludo(nombre: string | null, l: Idioma) {
  const n = nombre?.trim().split(/\s+/)[0];
  return l === "es" ? (n ? `Hola, ${esc(n)}.` : "Hola.") : n ? `Kaixo, ${esc(n)}.` : "Kaixo.";
}

export function correoConfirmacion(a: {
  producto: Producto;
  importeCent: number;
  nombre: string | null;
  idioma: Idioma;
  accesoHasta: Date;
}): { asunto: string; html: string } {
  const { producto: p, idioma: l } = a;
  const entregaB = fechaLarga(FECHAS.entregaB, l);
  const entregaA = fechaLarga(FECHAS.entregaA, l);
  const hasta = fechaLarga(a.accesoHasta, l);
  if (l === "eu") {
    const que =
      p === "B"
        ? `"${NOMBRE.B.eu}" masterclassean duzu lekua (${euros(a.importeCent)}, BEZa barne).`
        : p === "A"
          ? `"${NOMBRE.A.eu}" masterclassean duzu lekua, eta "${NOMBRE.B.eu}" opari (${euros(a.importeCent)}, BEZa barne). Zure erosketak bietan kontatzen du.`
          : `Hastekoa bazenuen jada; ${euros(a.importeCent)} hauekin "${NOMBRE.A.eu}" ere baduzu (BEZa barne).`;
    const noiz =
      p === "B"
        ? `3ra iristen bagara, ${entregaB} jasoko duzu posta honetan, nire webgunetik ikusteko esteka batekin.`
        : `3ra iristen bagara, hastekoa ${entregaB} jasoko duzu, eta bizkarrekoa ${entregaA}, posta honetan, nire webgunetik ikusteko esteka batekin.`;
    return {
      asunto: p === "B" ? `Erosketa berretsita: ${NOMBRE.B.eu}` : `Erosketa berretsita: ${NOMBRE.A.eu}`,
      html: envolver(
        [
          parr(saludo(a.nombre, l)),
          parr(`Ordainketa jaso dut. ${esc(que)}`),
          parr("Aurrez salmenta da: oraindik ez dut grabatu. Gutxienez 3 pertsona desberdin apuntatzen badira grabatzen dut. Abenduaren 10ean, ostegunean, zenbat garen kontatuko dut eta idatziko dizut esateko. 3ra iristen ez bagara, dirua itzuliko dizut."),
          parr(esc(noiz)),
          parr(`Bideoak gaztelaniaz daude. ${esc(hasta)} arte dituzu ikusgai (erosi eta 24 hilabete). Ezin dira deskargatu.`),
          p === "B" ? parr(`Abenduaren 5etik 9ra bizkarrekoa irekiko dut ("${esc(NOMBRE.A.eu)}"). Hau baduzunez, nahi baduzu, 10 € gehiago bakarrik ordainduko dituzu.`) : "",
          parr("Ordainketaren egiaztagiria Stripek bidaltzen dizu. Faktura osoa behar baduzu zure datuekin, erantzun mezu honi izenarekin edo sozietatearen izenarekin, IFZarekin eta helbidearekin, eta bidaliko dizut."),
          bloqueDesistimiento(l),
          parr("Zalantzarik baduzu, erantzun mezu honi."),
          `<p style="margin:0;">Alain</p>`,
        ].join("")
      ),
    };
  }
  const que =
    p === "B"
      ? `tienes tu plaza en la masterclass "${NOMBRE.B.es}" (${euros(a.importeCent)}, IVA incluido).`
      : p === "A"
        ? `tienes tu plaza en la masterclass "${NOMBRE.A.es}" y, de regalo, en "${NOMBRE.B.es}" (${euros(a.importeCent)}, IVA incluido). Tu compra cuenta para las dos.`
        : `ya tenías la de empezar; con estos ${euros(a.importeCent)} te llevas también "${NOMBRE.A.es}" (IVA incluido).`;
  const noiz =
    p === "B"
      ? `Si llegamos a 3, la recibes el ${entregaB} en este correo, con un enlace para verla desde mi web.`
      : `Si llegamos a 3, la de empezar te llega el ${entregaB} y la de la espalda el ${entregaA}, en este correo, con un enlace para verlas desde mi web.`;
  return {
    asunto: p === "B" ? `Compra confirmada: ${NOMBRE.B.es}` : `Compra confirmada: ${NOMBRE.A.es}`,
    html: envolver(
      [
        parr(saludo(a.nombre, l)),
        parr(`Pago recibido: ${esc(que)}`),
        parr("Es una preventa: todavía no la he grabado. La grabo si se apuntan al menos 3 personas distintas. El jueves 10 de diciembre cuento cuántas somos y te escribo para decírtelo. Si no llegamos a 3, te devuelvo el dinero."),
        parr(esc(noiz)),
        parr(`Los vídeos están en castellano. Los tienes hasta el ${esc(hasta)} (24 meses desde la compra). No se pueden descargar.`),
        p === "B" ? parr(`Del sábado 5 al miércoles 9 de diciembre abro la de la espalda ("${esc(NOMBRE.A.es)}"). Como ya tienes esta, si la quieres pagarás solo 10 € más.`) : "",
        parr("El justificante del pago te lo manda Stripe. Si necesitas factura completa con tus datos, respóndeme a este correo con tu nombre o razón social, NIF y dirección, y te la mando."),
        bloqueDesistimiento(l),
        parr("Cualquier duda, respóndeme a este correo."),
        `<p style="margin:0;">Alain</p>`,
      ].join("")
    ),
  };
}

export function correoRecuento(a: {
  caso: CasoRecuento;
  nombre: string | null;
  idioma: Idioma;
  devolverCent: number;
  comproA: boolean;
}): { asunto: string; html: string } {
  const l = a.idioma;
  const entregaB = fechaLarga(FECHAS.entregaB, l);
  const entregaA = fechaLarga(FECHAS.entregaA, l);
  const firma = `<p style="margin:0;">Alain</p>`;
  if (l === "eu") {
    if (a.caso === "nada_llega")
      return {
        asunto: "Ez gara 3ra iritsi: dirua itzuliko dizut",
        html: envolver(
          parr(saludo(a.nombre, l)) +
            parr("Gaur kontatu dut zenbat garen, eta ez gara 3 pertsonara iritsi. Beraz, ez dut masterclassa grabatuko eta ordaindutakoa itzuliko dizut" + (a.devolverCent ? ` (${euros(a.devolverCent)})` : "") + ". Ez duzu ezer egin behar: zure txartelera itzuliko da, eta bankuaren arabera egun batzuk behar izaten ditu.") +
            parr("Eskerrik asko nigan konfiantza izateagatik.") +
            firma
        ),
      };
    if (a.caso === "b_si_a_no")
      return {
        asunto: "Hastekoa grabatuko dut; bizkarrekoa ez",
        html: envolver(
          parr(saludo(a.nombre, l)) +
            parr(`Gaur kontatu dut zenbat garen. Hastekoa ("${esc(NOMBRE.B.eu)}") 3ra iritsi da eta grabatuko dut: ${esc(entregaB)} jasoko duzu.`) +
            parr(`Bizkarrekoa ("${esc(NOMBRE.A.eu)}") ez da iritsi, beraz 10 €-ko aldea itzuliko dizut. Dena itzultzea nahiago baduzu, erantzun mezu honi eta hala egingo dut.`) +
            firma
        ),
      };
    return {
      asunto: "3ra iritsi gara: grabatuko dut",
      html: envolver(
        parr(saludo(a.nombre, l)) +
          parr("Gaur kontatu dut zenbat garen, eta 3ra iritsi gara: grabatuko dut.") +
          parr(a.comproA ? `Hastekoa ${esc(entregaB)} jasoko duzu, eta bizkarrekoa ${esc(entregaA)}, posta honetan.` : `${esc(entregaB)} jasoko duzu, posta honetan.`) +
          firma
      ),
    };
  }
  if (a.caso === "nada_llega")
    return {
      asunto: "No hemos llegado a 3: te devuelvo el dinero",
      html: envolver(
        parr(saludo(a.nombre, l)) +
          parr("Hoy he contado cuántas personas somos y no hemos llegado a 3. Así que no grabo la masterclass y te devuelvo lo que pagaste" + (a.devolverCent ? ` (${euros(a.devolverCent)})` : "") + ". No tienes que hacer nada: vuelve a tu tarjeta, y según el banco tarda unos días en aparecer.") +
          parr("Gracias por fiarte de mí.") +
          firma
      ),
    };
  if (a.caso === "b_si_a_no")
    return {
      asunto: "La de empezar se graba; la de la espalda, no",
      html: envolver(
        parr(saludo(a.nombre, l)) +
          parr(`Hoy he contado cuántas personas somos. La de empezar ("${esc(NOMBRE.B.es)}") ha llegado a 3 y la grabo: te llega el ${esc(entregaB)}.`) +
          parr(`La de la espalda ("${esc(NOMBRE.A.es)}") no ha llegado, así que te devuelvo los 10 € de la diferencia. Si prefieres que te devuelva todo, respóndeme a este correo y lo hago.`) +
          firma
      ),
    };
  return {
    asunto: "Hemos llegado a 3: se graba",
    html: envolver(
      parr(saludo(a.nombre, l)) +
        parr("Hoy he contado cuántas personas somos y hemos llegado a 3: se graba.") +
        parr(a.comproA ? `La de empezar te llega el ${esc(entregaB)} y la de la espalda el ${esc(entregaA)}, en este correo.` : `Te llega el ${esc(entregaB)}, en este correo.`) +
        firma
    ),
  };
}

export function correoEntrega(a: {
  producto: "A" | "B";
  nombre: string | null;
  idioma: Idioma;
  enlace: string;
  accesoHasta: Date;
}): { asunto: string; html: string } {
  const l = a.idioma;
  const n = NOMBRE[a.producto][l];
  const hasta = fechaLarga(a.accesoHasta, l);
  const boton = (t: string) =>
    `<p style="${P}"><a href="${a.enlace}" style="display:inline-block;background:#0F2240;color:#F7F1E6;padding:0.8rem 1.6rem;border-radius:0.6rem;text-decoration:none;">${t}</a></p>`;
  if (l === "eu")
    return {
      asunto: `Hemen duzu: ${n}`,
      html: envolver(
        parr(saludo(a.nombre, l)) +
          parr(`"${esc(n)}" masterclassa prest dago. Nire webgunean ikusten da, esteka honekin (zure postari lotuta dago; ez ezazu publikoki partekatu):`) +
          boton("Masterclassa ikusi") +
          parr(`Bideoa gaztelaniaz dago. ${esc(hasta)} arte duzu ikusgai.`) +
          `<p style="${PEQ}">${esc(AVISO_SALUD.eu)}</p>` +
          `<p style="${PEQ}">Gustatzen ez bazaizu, 15 egun dituzu gaurtik aurrera itzulketa eskatzeko: erantzun mezu honi, besterik ez.</p>` +
          `<p style="margin:0;">Alain</p>`
      ),
    };
  return {
    asunto: `Ya la tienes: ${n}`,
    html: envolver(
      parr(saludo(a.nombre, l)) +
        parr(`La masterclass "${esc(n)}" ya está lista. Se ve en mi web, con este enlace (va ligado a tu correo; no lo publiques):`) +
        boton("Ver la masterclass") +
        parr(`La tienes hasta el ${esc(hasta)}.`) +
        `<p style="${PEQ}">${esc(AVISO_SALUD.es)}</p>` +
        `<p style="${PEQ}">Si no te convence, tienes 15 días desde hoy para pedirme la devolución: basta con responder a este correo.</p>` +
        `<p style="margin:0;">Alain</p>`
    ),
  };
}

export function correoEnlaceAcceso(a: { idioma: Idioma; enlace: string }): { asunto: string; html: string } {
  if (a.idioma === "eu")
    return {
      asunto: "Zure masterclassetarako esteka",
      html: envolver(parr("Kaixo.") + parr(`Hona hemen zure masterclassak ikusteko esteka: <a href="${a.enlace}">${a.enlace}</a>`) + `<p style="margin:0;">Alain</p>`),
    };
  return {
    asunto: "Tu enlace para ver las masterclasses",
    html: envolver(parr("Hola.") + parr(`Aquí tienes el enlace para ver tus masterclasses: <a href="${a.enlace}">${a.enlace}</a>`) + `<p style="margin:0;">Alain</p>`),
  };
}

export function correoAcuseDesistimiento(a: { idioma: Idioma; nombre: string | null }): { asunto: string; html: string } {
  if (a.idioma === "eu")
    return {
      asunto: "Atzera egiteko eskaera jaso dut",
      html: envolver(
        parr(saludo(a.nombre, "eu")) +
          parr("Atzera egiteko eskaera jaso dut. Ordaindutakoa itzuliko dizut lehenbailehen, eta gehienez ere 14 egun naturaleko epean, ordaintzeko bide beretik.") +
          `<p style="margin:0;">Alain</p>`
      ),
    };
  return {
    asunto: "He recibido tu solicitud de desistimiento",
    html: envolver(
      parr(saludo(a.nombre, "es")) +
        parr("He recibido tu solicitud de desistimiento. Te devuelvo lo que pagaste lo antes posible y como muy tarde en 14 días naturales, por el mismo medio de pago.") +
        `<p style="margin:0;">Alain</p>`
    ),
  };
}
