// Opiniones de familias y espectadores después de un evento.
//
// No es /quetal: /quetal es para quien CONTRATA (va después de la factura).
// Esto es para quien VINO: un formulario corto, una pregunta por pantalla,
// que guarda cada respuesta en el momento (da igual dónde lo dejen).
//
// Cada evento es una entrada de EVENTOS. La página fija /opinion-mirariak2026
// es la de Mirariak (la URL estaba decidida y repartida); cualquier otro
// evento que se añada aquí sale solo en /opinion/<clave>.
//
// Aquí vive lo que comparten la página, el endpoint, el panel y el mail a
// las reservas: eventos, textos ES/EU y los valores internos.

export type Idioma = "es" | "eu";
export const esIdioma = (v: unknown): v is Idioma => v === "es" || v === "eu";

export const ORIGENES = ["gracias", "salida", "mail", "voz"] as const;
export type Origen = (typeof ORIGENES)[number];
export const esOrigen = (v: unknown): v is Origen => ORIGENES.includes(v as Origen);
export const ORIGEN_CORTO: Record<Origen, string> = {
  gracias: "Página de gracias",
  salida: "Cartel de la salida",
  mail: "Mail a las reservas",
  voz: "De viva voz",
};

// 4 = lo mejor. Un toque.
export const NOTAS = [4, 3, 2, 1] as const;
export type Nota = (typeof NOTAS)[number];
export const NOTA_EMOJI: Record<Nota, string> = { 4: "🤩", 3: "😀", 2: "😐", 1: "🙁" };
export const NOTA_CORTO: Record<Nota, string> = { 4: "Les encantó", 3: "Muy bien", 2: "Normal", 1: "No mucho" };

export const PERMISOS = ["sin_nombre", "con_nombre", "no"] as const;
export type Permiso = (typeof PERMISOS)[number];
export const PERMISO_CORTO: Record<Permiso, string> = { sin_nombre: "Publicable sin nombre", con_nombre: "Publicable con nombre", no: "No publicable" };

export const ESTADOS = ["nuevo", "revisado", "aprobado", "publicado", "archivado"] as const;
export type Estado = (typeof ESTADOS)[number];
export const ESTADO_CORTO: Record<Estado, string> = { nuevo: "Nuevo", revisado: "Revisado", aprobado: "Aprobado", publicado: "Publicado", archivado: "Archivado" };

export const LIMITES = { texto: 1000, palabra: 60, nombre: 120, email: 200 } as const;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CLAVE_RE = /^[A-Za-z0-9_-]{16,64}$/;

// --- Eventos ---------------------------------------------------------------

export type EventoOpinion = {
  clave: string;
  nombre: string; // tal cual sale en el formulario y en el panel
  ruta: string; // dónde vive su formulario
  // De dónde salen las reservas para «Pedir opinión a las reservas de este
  // evento». Sin esto, el evento solo tiene formulario.
  reservas?: "mirariak2026";
  // El envío real a las reservas está cerrado hasta que Alain lo abra (primero
  // hay que decidir lo de privacidad; ver la nota del encargo del 19-11-2026).
  // La vista previa y el envío de prueba a Alain funcionan siempre.
  envioRealAbierto: boolean;
  mail: Record<Idioma, { asunto: string; gracias: string; motivo: string }>;
};

export const EVENTOS: Record<string, EventoOpinion> = {
  mirariak2026: {
    clave: "mirariak2026",
    nombre: "Mirariak 2026",
    ruta: "/opinion-mirariak2026",
    reservas: "mirariak2026",
    envioRealAbierto: false,
    mail: {
      es: {
        asunto: "Mirariak 2026: ¿qué tal lo pasasteis?",
        gracias: "Soy Alain, el mago de Mirariak. Gracias por venir al fin de semana mágico de Elgoibar.",
        motivo: "Te escribo porque reservaste plaza en Mirariak 2026 con esta dirección",
      },
      eu: {
        asunto: "Mirariak 2026: zer moduz pasatu zenuten?",
        gracias: "Alain naiz, Mirariak-eko magoa. Eskerrik asko Elgoibarko asteburu magikora etortzeagatik.",
        motivo: "Mirariak 2026rako helbide honekin erreserba egin zenuelako idazten dizut",
      },
    },
  },
};

export const eventoDe = (clave: unknown): EventoOpinion | null =>
  typeof clave === "string" && Object.prototype.hasOwnProperty.call(EVENTOS, clave) ? EVENTOS[clave] : null;

export const SITIO = "https://alainzulaika.com";

export function urlOpinion(ev: EventoOpinion, opts: { origen?: Origen; idioma?: Idioma; base?: string } = {}) {
  const q = new URLSearchParams();
  if (opts.origen) q.set("e", opts.origen);
  if (opts.idioma === "es") q.set("l", "es"); // euskera es el idioma por defecto
  const s = q.toString();
  return `${opts.base ?? SITIO}${ev.ruta}${s ? `?${s}` : ""}`;
}

// --- Textos del formulario ---------------------------------------------------
// El castellano es el copy del encargo de Alain (6-11-2026). El euskera es
// traducción (batua, registro cercano) PENDIENTE DE REVISAR por Alain.

type Textos = {
  kicker: string;
  intro: string;
  nota: string;
  notas: Record<Nota, string>;
  peques: string;
  adulto: string;
  adultoAyuda: string;
  palabra: string;
  mejora: string;
  mejoraPrivada: string;
  permiso: string;
  permisos: Record<Permiso, string>;
  nombre: string;
  email: string;
  emailAyuda: string;
  compartir: string;
  privacidadAntes: string;
  privacidadEnlace: string;
  opcional: string;
  siguiente: string;
  saltar: string;
  volver: string;
  enviar: string;
  gracias: string;
  graciasDetalle: string;
  resena: string;
  errorNombre: string;
  errorEmail: string;
  noExiste: string;
  pie: { aviso: string; privacidad: string; cookies: string };
};

export const OPINION_TEXTOS: Record<Idioma, Textos> = {
  es: {
    kicker: "Tu opinión",
    intro: "Un minuto. Puedes dejarlo cuando quieras: lo que hayas contestado se guarda.",
    nota: "¿Qué tal lo pasaron los peques?",
    notas: { 4: "¡Les encantó!", 3: "Muy bien", 2: "Normal", 1: "No mucho" },
    peques: "¿Qué es lo que más les gustó?",
    adulto: "¿Y a ti?",
    adultoAyuda: "Lo que más te gustó a ti, o lo que te llamó la atención.",
    palabra: "Define el evento en una palabra",
    mejora: "¿Qué mejorarías?",
    mejoraPrivada: "Esto solo lo leo yo, no se publica.",
    permiso: "¿Puedo usar tu opinión en mi web?",
    permisos: { sin_nombre: "Sí, sin nombre", con_nombre: "Sí, con mi nombre", no: "No, es solo para ti" },
    nombre: "Tu nombre",
    email: "Email",
    emailAyuda: "Solo por si quiero enseñarte el texto antes de publicarlo. No te apunto a ninguna lista.",
    compartir: "Tu opinión puede compartirse de forma anónima con quien organizó el evento.",
    privacidadAntes: "Más información en la ",
    privacidadEnlace: "política de privacidad",
    opcional: "(opcional)",
    siguiente: "Siguiente →",
    saltar: "Saltar",
    volver: "← volver",
    enviar: "Enviar",
    gracias: "¡Eskerrik asko!",
    graciasDetalle: "Me ayuda un montón. Sin tu permiso no se publica nada.",
    resena: "¿Me dejas también una reseña en Google? Me ayuda un montón.",
    errorNombre: "Escribe tu nombre o elige otra opción.",
    errorEmail: "Ese email no parece válido.",
    noExiste: "Este formulario ya no está disponible.",
    pie: { aviso: "Aviso legal", privacidad: "Privacidad", cookies: "Cookies" },
  },
  eu: {
    kicker: "Zure iritzia",
    intro: "Minutu bat. Nahi duzunean utz dezakezu: erantzundakoa gordeta geratzen da.",
    nota: "Zer moduz pasatu zuten txikiek?",
    notas: { 4: "Izugarri gustatu zitzaien!", 3: "Oso ondo", 2: "Normal", 1: "Ez askorik" },
    peques: "Zer gustatu zitzaien gehien?",
    adulto: "Eta zuri?",
    adultoAyuda: "Zuri gehien gustatu zitzaizuna, edo deigarria egin zitzaizuna.",
    palabra: "Definitu ekitaldia hitz bakarrean",
    mejora: "Zer hobetuko zenuke?",
    mejoraPrivada: "Hau nik bakarrik irakurtzen dut, ez da argitaratzen.",
    permiso: "Zure iritzia nire webgunean erabil dezaket?",
    permisos: { sin_nombre: "Bai, izenik gabe", con_nombre: "Bai, nire izenarekin", no: "Ez, zuretzat bakarrik da" },
    nombre: "Zure izena",
    email: "Emaila",
    emailAyuda: "Argitaratu aurretik testua erakutsi nahi badizut bakarrik. Ez zaitut inongo zerrendatan sartuko.",
    compartir: "Zure iritzia modu anonimoan parteka daiteke ekitaldia antolatu zuenarekin.",
    privacidadAntes: "Informazio gehiago: ",
    privacidadEnlace: "pribatutasun-politika",
    opcional: "(aukerakoa)",
    siguiente: "Hurrengoa →",
    saltar: "Saltatu",
    volver: "← itzuli",
    enviar: "Bidali",
    gracias: "Eskerrik asko!",
    graciasDetalle: "Izugarri laguntzen dit. Zure baimenik gabe ez da ezer argitaratzen.",
    resena: "Google-n iritzi bat ere utziko didazu? Izugarri laguntzen dit.",
    errorNombre: "Idatzi zure izena edo aukeratu beste bat.",
    errorEmail: "Email horrek ez du itxura zuzenik.",
    noExiste: "Formulario hau ez dago erabilgarri.",
    pie: { aviso: "Lege oharra", privacidad: "Pribatutasuna", cookies: "Cookieak" },
  },
};

// --- Mail a las reservas -------------------------------------------------------
// Un único correo por persona, sobre el evento al que vino. No apunta a nadie
// a la newsletter ni a ninguna secuencia.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function primerNombre(nombre: string) {
  return (nombre ?? "").trim().split(/\s+/)[0] ?? "";
}

export function mailOpinion(ev: EventoOpinion, d: { nombre: string; idioma: Idioma; base?: string }) {
  const eu = d.idioma === "eu";
  const m = ev.mail[d.idioma];
  const nombre = primerNombre(d.nombre);
  const enlace = urlOpinion(ev, { origen: "mail", idioma: d.idioma, base: d.base });
  const contacto = eu ? "info@alainzulaika.com" : "contacto@alainzulaika.com";
  const saludo = nombre ? (eu ? `Kaixo, ${esc(nombre)}:` : `Hola, ${esc(nombre)}:`) : eu ? "Kaixo:" : "Hola:";
  const pregunta = eu
    ? "Kontatuko didazu zer moduz pasatu zenuten? Minutu bat da, eta asko laguntzen dit hobetzen."
    : "¿Me cuentas qué tal lo pasasteis? Es un minuto, y me ayuda mucho a mejorar.";
  const boton = eu ? "Kontatu zer moduz →" : "Contar qué tal →";
  const pie = eu
    ? `Hau da honi buruz bidaliko dizudan mezu bakarra. ${esc(m.motivo)}; ez zaitut inongo zerrendatan sartu. Berriro idaztea nahi ez baduzu, edo zure erreserbako datuak ezabatzea nahi baduzu, idatzi <a href="mailto:${contacto}" style="color:#999;">${contacto}</a> helbidera eta egingo dut. Azkenean etortzerik izan ez bazenuten, ez duzu ezer egin behar.`
    : `Este es el único correo que te envío sobre esto. ${esc(m.motivo)}; no te he apuntado a ninguna lista. Si no quieres que te vuelva a escribir, o prefieres que borre los datos de tu reserva, escríbeme a <a href="mailto:${contacto}" style="color:#999;">${contacto}</a> y lo hago. Si al final no pudisteis venir, no hace falta que hagas nada.`;
  const p = "font-size:1rem;line-height:1.75;color:#333;margin:0 0 1.25rem 0;";
  const html = `
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#fff;">
      <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.25em;color:#bbb;margin:0 0 2rem 0;">${esc(ev.nombre.toUpperCase())}</p>
      <p style="font-size:1.25rem;font-weight:500;margin:0 0 1rem 0;">${saludo}</p>
      <p style="${p}">${esc(m.gracias)}</p>
      <p style="${p}">${pregunta}</p>
      <p style="margin:0 0 2rem 0;"><a href="${enlace}" style="display:inline-block;border:1px solid #1a1a1a;padding:0.85rem 1.6rem;color:#1a1a1a;text-decoration:none;font-size:0.98rem;letter-spacing:0.04em;">${boton}</a></p>
      <p style="${p}">Alain Zulaika</p>
      <div style="padding-top:1.5rem;border-top:1px solid #eee;font-size:0.82rem;color:#999;line-height:1.7;">
        <p style="margin:0;">${pie}</p>
      </div>
    </div>`;
  return { asunto: m.asunto, html, enlace };
}

export const CAMPANA_OPINION = (ev: EventoOpinion) => `opinion-${ev.clave}`;
