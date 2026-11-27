// Idioma de la plataforma de magia /magia-tailerrak (euskera y castellano).
// Sin código de servidor: lo usan páginas, componentes de cliente y APIs.
//
//  - El idioma se guarda en la cookie `lang` (la misma del resto de la web,
//    1 año). Sin cookie: euskera (los librillos están impresos en euskera;
//    decisión de Alain, 27-nov). `?h=es` / `?h=eu` en cualquier enlace a la
//    plataforma lo fija (lo hace proxy.ts), p. ej. en los mails en castellano.
//  - Textos de juegos y librillos: columnas *_es en la BD, editables en
//    /admin › Magia-tailerrak. Si un texto en castellano está vacío, sale el
//    de euskera. Vídeo: el del idioma; si no hay, el del otro con un aviso.
//  - Textos de la interfaz (botones, avisos): en TESTUAK, abajo.

import type { Edukia, Katalogoa, Liburutxoa } from "@/lib/magia-edukiak-motak";

export type Hizkuntza = "eu" | "es";
export const HIZKUNTZA_COOKIE = "lang";
export const URTE_BAT_S = 365 * 24 * 60 * 60;

/** Cualquier valor → «es» o «eu» (por defecto, euskera). */
export function hizkuntzaGarbia(v: unknown): Hizkuntza {
  return v === "es" ? "es" : "eu";
}

const hutsa = (s: string | null | undefined) => !s || !s.trim();

/** Un contenido en el idioma pedido. `youtube` pasa a ser el vídeo que se verá. */
export function edukiaHizkuntzan(e: Edukia, h: Hizkuntza): Edukia {
  if (h === "eu") {
    const youtube = e.youtube || e.youtube_es || null;
    return { ...e, youtube, bideoHizkuntza: e.youtube ? "eu" : e.youtube_es ? "es" : null };
  }
  const youtube = e.youtube_es || e.youtube || null;
  return {
    ...e,
    izenburua: hutsa(e.izenburua_es) ? e.izenburua : e.izenburua_es!.trim(),
    etiketa: hutsa(e.etiketa_es) ? e.etiketa : e.etiketa_es!.trim(),
    sarrera: hutsa(e.sarrera_es) ? e.sarrera : e.sarrera_es!.trim(),
    materiala: hutsa(e.materiala_es) ? e.materiala : e.materiala_es!.trim(),
    youtube,
    bideoHizkuntza: e.youtube_es ? "es" : e.youtube ? "eu" : null,
  };
}

export function liburutxoaHizkuntzan(l: Liburutxoa, h: Hizkuntza): Liburutxoa {
  return h === "es" && !hutsa(l.etiketa_es) ? { ...l, etiketa: l.etiketa_es!.trim() } : l;
}

/** Todo el catálogo en el idioma pedido (para las páginas públicas). */
export function katalogoaHizkuntzan(k: Katalogoa, h: Hizkuntza): Katalogoa {
  return {
    ...k,
    liburutxoak: k.liburutxoak.map((l) => liburutxoaHizkuntzan(l, h)),
    edukiak: k.edukiak.map((e) => edukiaHizkuntzan(e, h)),
  };
}

// ---------- Textos de la interfaz ----------

const eu = {
  izena: "Niala magoa",
  liburutxoIzena: "Sekretu handiak mago txikientzat",
  metaDeskribapena: "Sekretu handiak mago txikientzat: liburutxoetako jolasak bideoan, eta opari bat.",
  sartu: "Sartu",
  irten: "Irten",
  aldatuHizkuntza: "Hizkuntza",
  pribatutasuna: "Pribatutasuna",
  // Portada
  zeinLiburutxo: "Zein liburutxo duzu?",
  portadaSarrera: "Aukeratu zure adineko karta: liburutxoko jolasak bideoan ikusiko dituzu, eta opari bat ere badago!",
  liburutxoaDe: (etiketa: string) => `${etiketa}ko liburutxoa`,
  jolasKop: (n: number) => `${n} jolas`,
  // Librillo
  hitzMagikoa: "Hitz magikoa",
  giltzaAzalpena: "Zure liburutxoan hitz magiko bat dago, eskuz idatzita. Idatzi hemen eta zure magia-gunea irekiko da.",
  itzuliNirera: (etiketa: string) => `Itzuli nire liburutxora (${etiketa})`,
  ezDaZureaGaldera: "Ez da hau zure liburutxoa?",
  aldatu: "Aldatu",
  ezDaZurea: "Liburutxo hau ez da zurea",
  zureGuneanDuzu: (etiketa: string) => `Zure gunean ${etiketa}ko liburutxoa duzu.`,
  besteBatAukeratu: "Liburutxo hau baduzu eta beste bat aukeratu bazenuen, sakatu behean.",
  hauDaNirea: "Hau da nire liburutxoa",
  zureGunea: "Zure magia-gunea",
  bideoakBidean: (n: number) => `${n} jolas, bideoak bidean`,
  bideoPrest: (p: number, n: number) => `${p}/${n} bideo prest`,
  berriak: "Liburutxo hauek berri-berriak dira, eta zuek zarete lehenak. Jolas bakoitza bideoan grabatzen ari naiz: ikusleen aurrean nola egiten den eta sekretua, pausoz pauso. Prest dagoen bakoitza hemen irekiko da.",
  opariExtra: "Opari extra bat",
  ikusiBideoa: "Ikusi bideoa",
  utziEmaila: "Utzi zure emaila eta desblokeatu bideoa. Heldu batek bete behar du: eskatu laguntza aitari edo amari.",
  goikoEmailarekin: "Goiko emailarekin irekitzen da hau ere.",
  liburutxokoJolasak: "Liburutxoko jolasak",
  ordenaBerean: "Liburutxoan duzun ordena berean.",
  grabatzen: "Grabatzen",
  bideoaGrabatzen: (izenburua: string) => `${izenburua}: bideoa grabatzen`,
  sekretuak: "Sekretuak",
  sekretuakTestua: "Gune honetan sekretu gehiago daude gordeta. Oraindik ezin dira ireki… baina laster!",
  sekretuItxia: "Sekretu itxia",
  itxita: (izenburua: string) => `Itxita: ${izenburua}`,
  // Juego
  nireGunea: (etiketa: string) => `‹ Nire magia-gunea (${etiketa})`,
  jolasaN: (n: number) => `${n}. jolasa`,
  desblokeatuta: "Desblokeatuta!",
  desblokeatutaTestua: "Bideoa zurea da. Begiratu zure posta ere: gunera itzultzeko esteka bidali dizugu.",
  bideoaGrabatzenOrria: "Bideoa grabatzen",
  /** Aviso cuando el vídeo que se ve es el del otro idioma. */
  besteHizkuntzan: "Bideo hau gaztelaniaz dago oraingoz.",
  zerDa: "Zer da",
  liburutxoan: "Liburutxoan",
  beharDuzuna: "Behar duzuna",
  hurrengoJolasa: "Hurrengo jolasa",
  ikusiBideoaIzena: (izenburua: string) => `Ikusi bideoa: ${izenburua}`,
  // Notas
  nireOharrak: "Nire oharrak",
  oharrakAzalpena: "Idatzi hemen zer ikasi duzun edo zer landu behar duzun. Gailu honetan bakarrik gordetzen dira.",
  oharrakAdibidea: "Adibidez: eskua lasai mantendu, eta begiratu ikusleari begietara…",
  gordeta: "Gordeta",
  // Formularios
  emailOkerra: "Sartu posta elektroniko baliodun bat.",
  markatuLaukia: "Markatu laukia jarraitzeko.",
  kodeaBidaliBerri: "Kode bat bidali berri dizugu: begiratu zure posta (baita spama ere).",
  kodeaBidalita: "Kode bat bidali dizugu: begiratu zure posta (baita spama ere).",
  emailaBadago: "Email hori badago gure gunean. Kode bat bidali dizugu: begiratu zure posta (baita spama ere).",
  gaizki: "Zerbait gaizki joan da. Saiatu berriro.",
  kodeOkerra: "Kode hori ez da zuzena.",
  kodeOkerraEdoIraungia: "Kode hori ez da zuzena edo iraungi da.",
  zurePosta: "Zure posta elektronikoa",
  kodea6: "6 zenbakiko kodea",
  egiaztatzen: "Egiaztatzen…",
  bidaltzen: "Bidaltzen…",
  baimena: "Heldua naiz eta onartzen dut Alainen mezuak jasotzea (magia-jolas berriak eta bere buletina). Nahi dudanean utz diezaioket jasotzeari.",
  desblokeatuBideoa: "Desblokeatu bideoa",
  idatziGiltza: "Idatzi hitz magikoa.",
  giltzaOkerra: "Hitz magiko hori ez da zuzena. Begiratu berriro zure liburutxoan.",
  irekiGunea: "Ireki nire magia-gunea",
  // Entrar
  sartuAzalpena: "Idatzi zure emaila eta kode bat bidaliko dizugu.",
  bidaliKodea: "Bidali kodea",
  ezDagoKonturik: "Email horrekin ez dago konturik. Zure liburutxoaren orrian utz dezakezu emaila, opariaren ondoan.",
  joanLiburutxoetara: "Joan liburutxoetara",
};

export type Testuak = typeof eu;

const es: Testuak = {
  izena: "Mago Niala",
  liburutxoIzena: "Grandes secretos para pequeños magos",
  metaDeskribapena: "Grandes secretos para pequeños magos: los juegos de los librillos en vídeo, y un regalo.",
  sartu: "Entrar",
  irten: "Salir",
  aldatuHizkuntza: "Idioma",
  pribatutasuna: "Privacidad",
  zeinLiburutxo: "¿Qué librillo tienes?",
  portadaSarrera: "Elige la carta de tu edad: verás en vídeo los juegos del librillo, ¡y también hay un regalo!",
  liburutxoaDe: (etiketa: string) => `Librillo de ${etiketa}`,
  jolasKop: (n: number) => (n === 1 ? "1 juego" : `${n} juegos`),
  hitzMagikoa: "Palabra mágica",
  giltzaAzalpena: "En tu librillo hay una palabra mágica escrita a mano. Escríbela aquí y se abrirá tu espacio de magia.",
  itzuliNirera: (etiketa: string) => `Volver a mi librillo (${etiketa})`,
  ezDaZureaGaldera: "¿No es este tu librillo?",
  aldatu: "Cambiar",
  ezDaZurea: "Este librillo no es tuyo",
  zureGuneanDuzu: (etiketa: string) => `En tu espacio tienes el librillo de ${etiketa}.`,
  besteBatAukeratu: "Si tienes este librillo y elegiste otro, pulsa abajo.",
  hauDaNirea: "Este es mi librillo",
  zureGunea: "Tu espacio de magia",
  bideoakBidean: (n: number) => `${n} juegos, vídeos en camino`,
  bideoPrest: (p: number, n: number) => `${p}/${n} vídeos listos`,
  berriak: "Estos librillos son nuevísimos, y sois los primeros. Estoy grabando en vídeo cada juego: cómo se hace delante del público y el secreto, paso a paso. Cada uno se abrirá aquí en cuanto esté listo.",
  opariExtra: "Un regalo extra",
  ikusiBideoa: "Ver el vídeo",
  utziEmaila: "Deja tu email y desbloquea el vídeo. Tiene que rellenarlo una persona adulta: pide ayuda a tu padre o a tu madre.",
  goikoEmailarekin: "Este también se abre con el email de arriba.",
  liburutxokoJolasak: "Los juegos del librillo",
  ordenaBerean: "En el mismo orden que en el librillo.",
  grabatzen: "Grabando",
  bideoaGrabatzen: (izenburua: string) => `${izenburua}: grabando el vídeo`,
  sekretuak: "Secretos",
  sekretuakTestua: "En este espacio hay más secretos guardados. Todavía no se pueden abrir… ¡pero pronto!",
  sekretuItxia: "Secreto cerrado",
  itxita: (izenburua: string) => `Cerrado: ${izenburua}`,
  nireGunea: (etiketa: string) => `‹ Mi espacio de magia (${etiketa})`,
  jolasaN: (n: number) => `Juego ${n}`,
  desblokeatuta: "¡Desbloqueado!",
  desblokeatutaTestua: "El vídeo es tuyo. Mira también tu correo: te hemos enviado el enlace para volver a tu espacio.",
  bideoaGrabatzenOrria: "Grabando el vídeo",
  besteHizkuntzan: "Por ahora, este vídeo está en euskera.",
  zerDa: "Qué es",
  liburutxoan: "En el librillo",
  beharDuzuna: "Lo que necesitas",
  hurrengoJolasa: "Siguiente juego",
  ikusiBideoaIzena: (izenburua: string) => `Ver el vídeo: ${izenburua}`,
  nireOharrak: "Mis notas",
  oharrakAzalpena: "Apunta aquí lo que has aprendido o lo que tienes que practicar. Solo se guardan en este dispositivo.",
  oharrakAdibidea: "Por ejemplo: mantener la mano tranquila y mirar al público a los ojos…",
  gordeta: "Guardado",
  emailOkerra: "Escribe un correo electrónico válido.",
  markatuLaukia: "Marca la casilla para continuar.",
  kodeaBidaliBerri: "Te acabamos de enviar un código: mira tu correo (también el spam).",
  kodeaBidalita: "Te hemos enviado un código: mira tu correo (también el spam).",
  emailaBadago: "Ese email ya está en nuestro espacio. Te hemos enviado un código: mira tu correo (también el spam).",
  gaizki: "Algo ha ido mal. Inténtalo de nuevo.",
  kodeOkerra: "Ese código no es correcto.",
  kodeOkerraEdoIraungia: "Ese código no es correcto o ha caducado.",
  zurePosta: "Tu correo electrónico",
  kodea6: "Código de 6 cifras",
  egiaztatzen: "Comprobando…",
  bidaltzen: "Enviando…",
  baimena: "Soy una persona adulta y acepto recibir los mensajes de Alain (juegos de magia nuevos y su boletín). Puedo dejar de recibirlos cuando quiera.",
  desblokeatuBideoa: "Desbloquear el vídeo",
  idatziGiltza: "Escribe la palabra mágica.",
  giltzaOkerra: "Esa palabra mágica no es correcta. Vuelve a mirarla en tu librillo.",
  irekiGunea: "Abrir mi espacio de magia",
  sartuAzalpena: "Escribe tu email y te enviaremos un código.",
  bidaliKodea: "Enviar código",
  ezDagoKonturik: "No hay ninguna cuenta con ese email. Puedes dejarlo en la página de tu librillo, junto al regalo.",
  joanLiburutxoetara: "Ir a los librillos",
};

export const TESTUAK: Record<Hizkuntza, Testuak> = { eu, es };
