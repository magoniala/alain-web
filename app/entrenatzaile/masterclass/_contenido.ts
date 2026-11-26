// Copy de la landing de la preventa (castellano y euskera). Modelo del
// 26-11-2026: se vende "Que la espalda no te pare" a 17 €; del 1 al 4-dic con
// "Por dónde empezar a entrenar a partir de los 50" de regalo.
// Sale de la nota del vault «2026-11-24 Preventa masterclass — Material para la
// landing» (§1 qué cubre cada una, §10 legal) y del encargo del 26-11. Nada
// inventado: la duración es la horquilla que dio Alain (20 min a 5 h, 26-11); ni ni valor en euros del regalo (nunca se ha vendido
// suelto a ese precio). El euskera es de Álex y Alain no lo ha repasado.
// Reglas de Alain: comillas "así", sin separadores. (Lo de las preguntas sin ¿
// y con ?? es solo para los mails.)

import type { Idioma } from "@/lib/preventa-reglas";

export interface Contenido {
  marca: string;
  titulo: string;
  promesa: string;
  paraQuien: string;
  precio: string;
  plazo: string;
  cta: string;
  garantia: string;
  abre: string;
  bonus: {
    titulo: string;
    nombre: string;
    texto: string;
    entrega: string;
    quedan: (dias: number) => string;
    ultimoDia: string;
    antes: string;
  };
  yaSomosTres: string;
  paraTi: { titulo: string; si: string[]; noTitulo: string; no: string[] };
  aprendes: { titulo: string; lineas: string[] };
  formato: { titulo: string; lineas: string[] };
  como: { titulo: string; pasos: { cuando: string; que: string; soloBonus?: boolean }[] };
  quienSoy: { titulo: string; texto: string; alt: string };
  testimonio: { cita: string; autor: string };
  faqTitulo: string;
  faq: { p: string; r: string; soloBonus?: boolean }[];
  form: {
    titulo: string;
    nombre: string;
    email: string;
    continuar: string;
    cargando: string;
    antesDePagar: string;
    cambiarCorreo: string;
    yaLaTiene: string;
    noAbierta: string;
    errorEmail: string;
    errorGeneral: string;
    verDesistimiento: string;
  };
  cerrada: { titulo: string; texto: string[] };
  modelo: string;
  privacidad: string;
}

export const CONTENIDO: Record<Idioma, Contenido> = {
  es: {
    marca: "Masterclass en vídeo de Entrenatzaile",
    titulo: "Que la espalda no te pare",
    promesa:
      "Una masterclass en vídeo para seguir entrenando todo el cuerpo aunque tengas dolor de espalda. Si te duele la espalda, el pecho se entrena así, las piernas así y lo demás así: con variantes según tu tipo de dolor o tu limitación.",
    paraQuien: "Para ti si tienes lumbago, ciática, una hernia o una protrusión, y quieres seguir entrenando en vez de parar.",
    precio: "17 €",
    plazo: "IVA incluido. Se puede comprar hasta el miércoles 9 de diciembre a las 23:59.",
    cta: "Apuntarme por 17 €",
    garantia: "Si no llegamos a 3 personas, te devuelvo el dinero. Y tienes 15 días para desistir sin dar ningún motivo.",
    abre: "Se abre el martes 1 de diciembre.",
    bonus: {
      titulo: "De regalo si la compras antes del viernes 4 a las 23:59",
      nombre: "Por dónde empezar a entrenar a partir de los 50",
      texto:
        "Otra masterclass en vídeo: cómo empezar si nunca has hecho entrenamiento de fuerza ni has ido a un gimnasio. Con qué empezar, a qué ritmo, cuántos días a la semana y por qué tanta gente lo deja o no consigue arrancar bien.",
      entrega: "Te llega el lunes 28 de diciembre, para que empieces en enero.",
      quedan: (d) => (d === 1 ? "Queda 1 día." : `Quedan ${d} días.`),
      ultimoDia: "Último día: hasta hoy a las 23:59.",
      antes: "Del martes 1 al viernes 4 de diciembre.",
    },
    yaSomosTres: "Ya somos 3: se graba.",
    paraTi: {
      titulo: "Para quién es",
      si: [
        "Te duele la espalda (lumbago, ciática, hernias, protrusiones…) y por eso entrenas menos o has dejado de entrenar.",
        "Quieres trabajar toda la musculatura del cuerpo, no solo hacer estiramientos.",
        "Prefieres entender cómo adaptar cada ejercicio a no tener que preguntar cada vez.",
      ],
      noTitulo: "Para quién no es",
      no: [
        "Si buscas que te quite el dolor. No te lo prometo: te enseño a adaptar el entrenamiento para que el dolor no te pare.",
        "Si tu dolor no lo ha visto todavía un médico. Consulta antes de empezar a entrenar.",
      ],
    },
    aprendes: {
      titulo: "Qué vas a ver",
      lineas: [
        "Ejercicios adaptados para trabajar toda la musculatura del cuerpo a pesar de la espalda.",
        "Variantes para distintos tipos de dolor de espalda y de limitación.",
        "Cómo adaptar un ejercicio cuando te molesta, en vez de dejarlo.",
      ],
    },
    formato: {
      titulo: "Cómo es",
      lineas: [
        "Me ves a cámara, comparto pantalla y te enseño con fotos y vídeos de los ejercicios cómo adaptarlos.",
        "La ves en mi web con tu correo durante 24 meses desde la compra. No se puede descargar. Está en castellano.",
      ],
    },
    como: {
      titulo: "Cómo funciona la preventa",
      pasos: [
        { cuando: "Hasta el 9 de diciembre", que: "Te apuntas y pagas 17 €. Todavía no la he grabado." },
        { cuando: "Jueves 10 de diciembre", que: "Cuento cuántas personas somos. La grabo si la compran al menos 3; si no, te devuelvo el dinero sin que me lo pidas." },
        { cuando: "Lunes 28 de diciembre", que: "Si la compraste con el regalo, te llega \"Por dónde empezar a entrenar a partir de los 50\".", soloBonus: true },
        { cuando: "Domingo 10 de enero", que: "Te llega \"Que la espalda no te pare\" a tu correo, con el enlace para verla." },
      ],
    },
    quienSoy: {
      titulo: "Quién soy",
      texto:
        "Soy Alain Zulaika, entrenador personal titulado (grado superior de Animación Sociodeportiva), y llevo Entrenatzaile, mi servicio de entrenamiento online.",
      alt: "Alain Zulaika, entrenador de Entrenatzaile",
    },
    testimonio: {
      cita: "Sin falsas promesas y sin prisas.",
      autor: "Juan García, sobre su Hoja de Ruta conmigo (no sobre esta masterclass)",
    },
    faqTitulo: "Preguntas",
    faq: [
      { p: "¿Cuánto dura?", r: "Lo que tenga que durar para que te sirva. No te prometo una duración exacta, pero calculo que entre 20 minutos y 5 horas." },
      { p: "¿Qué pasa si no se apunta nadie más?", r: "Si el 10 de diciembre no hemos llegado a 3 personas, no la grabo y te devuelvo el dinero. No tienes que pedírmelo." },
      { p: "¿Y si no me gusta?", r: "Tienes 15 días desde la compra y otros 15 desde que recibes el acceso para pedirme la devolución, sin dar ningún motivo." },
      { p: "¿Me quita el dolor de espalda?", r: "No lo prometo. Te enseño a adaptar el entrenamiento para que el dolor no te pare." },
      { p: "¿Qué pasa con el regalo si compro el sábado 5 o después?", r: "La masterclass sigue costando 17 €, pero ya sin el regalo. El regalo es solo para quien compra antes del viernes 4 a las 23:59.", soloBonus: true },
      { p: "¿Cómo la veo?", r: "Desde mi web (en el ordenador, el móvil o la tablet), con tu correo, durante 24 meses desde la compra. No se puede descargar." },
      { p: "¿En qué idioma está?", r: "Los vídeos, en castellano. Esta página y los correos, en castellano y en euskera." },
      { p: "¿Me haces factura?", r: "Stripe te manda el justificante del pago. Si necesitas factura completa con tus datos, respóndeme al correo de confirmación y te la mando." },
      { p: "¿Puedo preguntarte dudas?", r: "Sí, escribiéndome a contacto@alainzulaika.com." },
    ],
    form: {
      titulo: "Apúntate",
      nombre: "Nombre",
      email: "Correo",
      continuar: "Continuar",
      cargando: "Un momento…",
      antesDePagar: "Antes de pagar",
      cambiarCorreo: "Cambiar los datos",
      yaLaTiene: "Con este correo ya la tienes comprada. Todo te llega por correo.",
      noAbierta: "Ahora mismo no está a la venta.",
      errorEmail: "Revisa el correo: parece que no está bien escrito.",
      errorGeneral: "Algo ha fallado. Prueba otra vez en un momento o escríbeme a contacto@alainzulaika.com.",
      verDesistimiento: "Ver las condiciones de devolución y desistimiento",
    },
    cerrada: {
      titulo: "La preventa está cerrada",
      texto: [
        "Cerró el miércoles 9 de diciembre a las 23:59, como estaba anunciado.",
        "Si compraste, todo te llega por correo. Si has perdido el enlace para ver la masterclass, pídelo aquí abajo.",
      ],
    },
    modelo: "Modelo de formulario de desistimiento",
    privacidad: "Política de privacidad",
  },
  eu: {
    marca: "Entrenatzaileren bideozko masterclassa",
    titulo: "Bizkarrak ez zaitzala gelditu",
    promesa:
      "Bideozko masterclass bat, bizkarreko mina izan arren gorputz osoa entrenatzen jarraitzeko. Bizkarra mintzen bazaizu, bularra horrela entrenatzen da, hankak horrela eta gainerakoa horrela: zure min motaren edo mugaren araberako aldaerekin.",
    paraQuien: "Lumbagoa, ziatika, hernia bat edo protrusio bat baduzu eta gelditu beharrean entrenatzen jarraitu nahi baduzu.",
    precio: "17 €",
    plazo: "BEZa barne. Abenduaren 9ko 23:59ra arte eros daiteke.",
    cta: "Apuntatu 17 €-tan",
    garantia: "3 pertsonara iristen ez bagara, dirua itzuliko dizut. Eta 15 egun dituzu atzera egiteko, inolako arrazoirik eman gabe.",
    abre: "Abenduaren 1ean irekiko da, asteartean.",
    bonus: {
      titulo: "Opari, abenduaren 4ko 23:59ra arte erosten baduzu",
      nombre: "Zer egin 50 urtetik aurrera entrenatzen hasteko",
      texto:
        "Beste bideozko masterclass bat: nola hasi inoiz indar-lanik egin ez baduzu edo gimnasiora joan ez bazara. Zerekin hasi, zein erritmotan, astean zenbat egunez, eta zergatik uzten duen hainbeste jendek edo ez duen ondo hasten asmatzen.",
      entrega: "Abenduaren 28an jasoko duzu, urtarrilean hasteko.",
      quedan: (d) => (d === 1 ? "Egun 1 geratzen da." : `${d} egun geratzen dira.`),
      ultimoDia: "Azken eguna: gaur 23:59ra arte.",
      antes: "Abenduaren 1etik 4ra.",
    },
    yaSomosTres: "3 gara jada: grabatuko dut.",
    paraTi: {
      titulo: "Norentzat den",
      si: [
        "Bizkarra mintzen zaizu (lumbagoa, ziatika, herniak, protrusioak…) eta horregatik gutxiago entrenatzen duzu edo utzi egin duzu.",
        "Gorputzeko muskulu guztiak landu nahi dituzu, ez luzaketak bakarrik.",
        "Ariketa bakoitza nola egokitu ulertu nahi duzu, aldiro galdetu beharrean.",
      ],
      noTitulo: "Norentzat ez den",
      no: [
        "Mina kentzea bilatzen baduzu. Ez dizut agintzen: entrenamendua egokitzen irakasten dizut, minak gelditu ez zaitzan.",
        "Zure mina medikuak oraindik ikusi ez badu. Galdetu entrenatzen hasi aurretik.",
      ],
    },
    aprendes: {
      titulo: "Zer ikusiko duzun",
      lineas: [
        "Gorputzeko muskulu guztiak lantzeko ariketa egokituak, bizkarra gorabehera.",
        "Bizkarreko min eta muga mota desberdinetarako aldaerak.",
        "Ariketa bat nola egokitu molestatzen dizunean, utzi beharrean.",
      ],
    },
    formato: {
      titulo: "Nolakoa den",
      lineas: [
        "Kamera aurrean nauzu, pantaila partekatzen dut eta ariketen argazki eta bideoekin egokitzen irakasten dizut.",
        "Nire webgunean ikusten duzu zure postarekin, erosi eta 24 hilabetez. Ezin da deskargatu. Gaztelaniaz dago.",
      ],
    },
    como: {
      titulo: "Nola dabilen aurrez salmenta",
      pasos: [
        { cuando: "Abenduaren 9ra arte", que: "Apuntatu eta 17 € ordaintzen dituzu. Oraindik ez dut grabatu." },
        { cuando: "Abenduaren 10ean, ostegunean", que: "Zenbat garen kontatuko dut. Gutxienez 3k erosten badute grabatuko dut; bestela, dirua itzuliko dizut, eskatu beharrik gabe." },
        { cuando: "Abenduaren 28an, astelehenean", que: "Opariarekin erosi bazenuen, \"Zer egin 50 urtetik aurrera entrenatzen hasteko\" jasoko duzu.", soloBonus: true },
        { cuando: "Urtarrilaren 10ean, igandean", que: "\"Bizkarrak ez zaitzala gelditu\" jasoko duzu postan, ikusteko estekarekin." },
      ],
    },
    quienSoy: {
      titulo: "Nor naiz",
      texto:
        "Alain Zulaika naiz, entrenatzaile pertsonal titulatua (Animazio Soziokiroleko goi-mailako zikloa), eta Entrenatzaile daramat, nire online entrenamendu zerbitzua.",
      alt: "Alain Zulaika, Entrenatzaileko entrenatzailea",
    },
    testimonio: {
      cita: "Sin falsas promesas y sin prisas.",
      autor: "Juan García, nirekin egin zuen Hoja de Rutari buruz (ez masterclass honi buruz)",
    },
    faqTitulo: "Galderak",
    faq: [
      { p: "Zenbat irauten du?", r: "Balio dizun arte behar duena. Ez dizut iraupen zehatzik agintzen, baina 20 minutu eta 5 ordu artean izango dela uste dut." },
      { p: "Eta inor gehiago apuntatzen ez bada?", r: "Abenduaren 10ean 3 pertsonara iritsi ez bagara, ez dut grabatuko eta dirua itzuliko dizut. Ez duzu eskatu beharrik." },
      { p: "Eta gustatzen ez bazait?", r: "Erosi eta 15 egun dituzu, eta beste 15 sarbidea jasotzen duzunetik, itzulketa eskatzeko, arrazoirik eman gabe." },
      { p: "Bizkarreko mina kentzen dit?", r: "Ez dut agintzen. Entrenamendua egokitzen irakasten dizut, minak gelditu ez zaitzan." },
      { p: "Zer gertatzen da opariarekin abenduaren 5ean edo geroago erosten badut?", r: "Masterclassak 17 € balio ditu oraindik, baina opari gabe. Oparia abenduaren 4ko 23:59 baino lehen erosten dutenentzat bakarrik da.", soloBonus: true },
      { p: "Nola ikusten dut?", r: "Nire webgunetik (ordenagailuan, mugikorrean edo tabletan), zure postarekin, erosi eta 24 hilabetez. Ezin da deskargatu." },
      { p: "Zein hizkuntzatan dago?", r: "Bideoak, gaztelaniaz. Orri hau eta mezuak, euskaraz eta gaztelaniaz." },
      { p: "Faktura egiten didazu?", r: "Stripek ordainketaren egiaztagiria bidaltzen dizu. Faktura osoa behar baduzu zure datuekin, erantzun berrespen-mezuari eta bidaliko dizut." },
      { p: "Zalantzak galdetu ditzaket?", r: "Bai, contacto@alainzulaika.com helbidera idatzita." },
    ],
    form: {
      titulo: "Apuntatu",
      nombre: "Izena",
      email: "Posta elektronikoa",
      continuar: "Jarraitu",
      cargando: "Itxaron…",
      antesDePagar: "Ordaindu aurretik",
      cambiarCorreo: "Datuak aldatu",
      yaLaTiene: "Posta honekin erosita duzu jada. Dena postaz jasoko duzu.",
      noAbierta: "Une honetan ez dago salgai.",
      errorEmail: "Begiratu posta: ez dirudi ondo idatzita dagoenik.",
      errorGeneral: "Zerbait gaizki atera da. Saiatu berriro pixka bat barru edo idatzi contacto@alainzulaika.com helbidera.",
      verDesistimiento: "Itzulketa eta atzera egiteko baldintzak ikusi",
    },
    cerrada: {
      titulo: "Aurrez salmenta itxita dago",
      texto: [
        "Abenduaren 9ko 23:59an itxi zen, iragarri bezala.",
        "Erosi baduzu, dena postaz iritsiko zaizu. Masterclassa ikusteko esteka galdu baduzu, eskatu hemen behean.",
      ],
    },
    modelo: "Atzera egiteko formulario-eredua",
    privacidad: "Pribatutasun-politika",
  },
};
