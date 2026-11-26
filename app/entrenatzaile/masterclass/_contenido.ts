// Copy de la landing de la preventa (castellano y euskera).
// Sale de la nota del vault «2026-11-24 Preventa masterclass — Material para la
// landing» (§5, con la decisión legal de §10). El euskera es de Álex y Alain no
// lo ha repasado. Reglas de Alain: comillas "así", sin separadores, nada
// inventado. (Lo de las preguntas sin ¿ y con ?? es solo para los mails.)

import type { Idioma } from "@/lib/preventa-reglas";

export interface Faq {
  p: string;
  r: string;
}

export interface Contenido {
  marca: string;
  antes: { titulo: string; texto: string[] };
  cerrada: { titulo: string; texto: string[] };
  B: { titulo: string; promesa: string; paraQuien: string };
  A: { titulo: string; promesa: string; paraQuien: string };
  yaSomosTres: string;
  queRecibes: { titulo: string; lineas: string[] };
  precio: { titulo: string; B: string; A: string; real: string };
  preventa: { titulo: string; texto: string[] };
  quienSoy: { titulo: string; texto: string };
  testimonio: { cita: string; autor: string };
  faqTitulo: string;
  faq: Faq[];
  form: {
    titulo: string;
    tituloSubida: string;
    nombre: string;
    email: string;
    emailAyudaA: string;
    continuar: string;
    cargando: string;
    antesDePagar: string;
    cambiarCorreo: string;
    yaB: string;
    yaA: string;
    noAbierta: string;
    errorEmail: string;
    errorGeneral: string;
    verDesistimiento: string;
  };
  modelo: string;
  privacidad: string;
}

export const CONTENIDO: Record<Idioma, Contenido> = {
  es: {
    marca: "Entrenatzaile · Masterclasses en vídeo",
    antes: {
      titulo: "Dos masterclasses en vídeo, en preventa",
      texto: [
        "Del martes 1 al viernes 4 de diciembre: \"Por dónde empezar a entrenar a partir de los 50\", a 7 €.",
        "Del sábado 5 al miércoles 9 de diciembre: \"Que la espalda no te pare\", a 17 €, con la anterior de regalo.",
        "La preventa abre el martes 1 de diciembre.",
      ],
    },
    cerrada: {
      titulo: "La preventa está cerrada",
      texto: [
        "Cerró el miércoles 9 de diciembre a las 23:59, como estaba anunciado.",
        "Si compraste, todo te llega por correo. Si has perdido el enlace para ver las masterclasses, pídelo aquí abajo.",
      ],
    },
    B: {
      titulo: "Por dónde empezar a entrenar a partir de los 50",
      promesa:
        "Una masterclass en vídeo en la que te enseño por dónde empezar a entrenar a partir de los 50. Cómo empezar si nunca has hecho entrenamiento de fuerza ni has ido a un gimnasio: con qué empezar, a qué ritmo, cuántos días a la semana y por qué tanta gente lo deja o ni consigue arrancar bien.",
      paraQuien: "Para ti si tienes 50 años o más, quieres entrenar y no sabes por dónde empezar.",
    },
    A: {
      titulo: "Que la espalda no te pare",
      promesa:
        "Una masterclass en vídeo para que el dolor de espalda no te impida entrenar. Ejercicios adaptados para trabajar toda la musculatura del cuerpo, con variantes según tu tipo de dolor de espalda o tu limitación: si te duele la espalda, el pecho se entrena así, y las piernas, y lo demás. No te prometo quitarte el dolor; te enseño a adaptar el entrenamiento para que puedas seguir. Lleva de regalo la masterclass de empezar a entrenar a partir de los 50.",
      paraQuien:
        "Para ti si tienes problemas de espalda (lumbago, ciática, hernias, protrusiones…) y quieres seguir entrenando en vez de parar.",
    },
    yaSomosTres: "Ya somos 3: se graba.",
    queRecibes: {
      titulo: "Qué recibes",
      lineas: [
        "Una masterclass en vídeo en la que me ves a cámara, comparto pantalla y te enseño con fotos y vídeos de los ejercicios cómo adaptarlos.",
        "La ves desde mi web con tu correo durante 24 meses desde la compra. No se puede descargar. Los vídeos están en castellano.",
        "Fecha de entrega: la de empezar, el lunes 28 de diciembre (para que empieces en enero). La de la espalda, el domingo 10 de enero.",
        "Con la de la espalda te llevas la de empezar de regalo, y te llega también el 28 de diciembre.",
      ],
    },
    precio: {
      titulo: "Precio y plazo",
      B: "Por dónde empezar a entrenar a partir de los 50: 7 €. Hasta el viernes 4 de diciembre a las 23:59. Después, desaparece.",
      A: "Que la espalda no te pare: 17 €, con la anterior de regalo. Del sábado 5 al miércoles 9 de diciembre a las 23:59. Si ya compraste la de empezar, pagas solo 10 € más. IVA incluido.",
      real: "Este plazo es real: pasada la hora, se cierra de verdad.",
    },
    preventa: {
      titulo: "Por qué es una preventa (y qué pasa si no se llega)",
      texto: [
        "Todavía no la he grabado, y la grabo solo si se apuntan al menos 3 personas distintas. El jueves 10 de diciembre cuento cuántas somos y os escribo.",
        "Si no llegamos a 3, te devuelvo el dinero con un correo explicándotelo. Si la de empezar llega y la de la espalda no, recibes la de empezar y te devuelvo los 10 € de la diferencia (o todo, si prefieres que te devuelva todo).",
      ],
    },
    quienSoy: {
      titulo: "Quién soy",
      texto:
        "Soy Alain Zulaika, entrenador personal titulado (grado superior de Animación Sociodeportiva), y llevo Entrenatzaile, mi servicio de entrenamiento online.",
    },
    testimonio: {
      cita: "Sin falsas promesas y sin prisas.",
      autor: "Juan García, sobre su Hoja de Ruta conmigo (no sobre estas masterclasses)",
    },
    faqTitulo: "Preguntas frecuentes",
    faq: [
      { p: "¿Cuándo lo recibo?", r: "La de empezar, el 28 de diciembre; la de la espalda, el 10 de enero. Si compras la de la espalda, la de empezar te llega también el 28 de diciembre." },
      { p: "¿Qué pasa si no se apunta nadie más?", r: "Si no llegamos a 3 personas por producto, te devuelvo el dinero." },
      { p: "¿Puedo comprar la de empezar y luego la de la espalda?", r: "Sí, hasta el 9 de diciembre a las 23:59, pagando 10 € más. Usa el mismo correo con el que compraste." },
      { p: "¿Y si no me gusta?", r: "Tienes 15 días desde la compra y otros 15 desde que recibes el acceso para pedirme la devolución, sin dar ningún motivo." },
      { p: "¿Me quita el dolor de espalda?", r: "No lo prometo: te enseño a adaptar el entrenamiento para que el dolor no te pare." },
      { p: "¿En qué idioma está?", r: "Los vídeos, en castellano. Esta página y los correos, en castellano y en euskera." },
      { p: "¿Cómo lo veo?", r: "Desde mi web, con tu correo, durante 24 meses desde la compra. No se puede descargar." },
      { p: "¿Me haces factura?", r: "Stripe te manda el justificante del pago. Si necesitas factura completa con tus datos, respóndeme al correo de confirmación y te la mando." },
      { p: "¿Puedo preguntarte dudas?", r: "Sí, escribiéndome a contacto@alainzulaika.com." },
    ],
    form: {
      titulo: "Apúntate",
      tituloSubida: "Apúntate (si ya tienes la de empezar, pagas solo 10 €)",
      nombre: "Nombre",
      email: "Correo",
      emailAyudaA: "Si ya compraste la de empezar, usa el mismo correo: pagarás solo la diferencia, 10 €.",
      continuar: "Continuar",
      cargando: "Un momento…",
      antesDePagar: "Antes de pagar",
      cambiarCorreo: "Cambiar los datos",
      yaB: "Con este correo ya tienes la de empezar. Te llega el 28 de diciembre.",
      yaA: "Con este correo ya tienes las dos. Te llegan el 28 de diciembre y el 10 de enero.",
      noAbierta: "Ahora mismo no está a la venta.",
      errorEmail: "Revisa el correo: parece que no está bien escrito.",
      errorGeneral: "Algo ha fallado. Prueba otra vez en un momento o escríbeme a contacto@alainzulaika.com.",
      verDesistimiento: "Ver las condiciones de devolución y desistimiento",
    },
    modelo: "Modelo de formulario de desistimiento",
    privacidad: "Política de privacidad",
  },
  eu: {
    marca: "Entrenatzaile · Bideozko masterclassak",
    antes: {
      titulo: "Bi masterclass bideoan, aurrez salgai",
      texto: [
        "Abenduaren 1etik 4ra: \"Zer egin 50 urtetik aurrera entrenatzen hasteko\", 7 €.",
        "Abenduaren 5etik 9ra: \"Bizkarrak ez zaitzala gelditu\", 17 €, aurrekoa opari.",
        "Aurrez salmenta abenduaren 1ean irekiko da, asteartean.",
      ],
    },
    cerrada: {
      titulo: "Aurrez salmenta itxita dago",
      texto: [
        "Abenduaren 9ko 23:59an itxi zen, iragarri bezala.",
        "Erosi baduzu, dena postaz iritsiko zaizu. Masterclassak ikusteko esteka galdu baduzu, eskatu hemen behean.",
      ],
    },
    B: {
      titulo: "Zer egin 50 urtetik aurrera entrenatzen hasteko",
      promesa:
        "Bideo bidezko masterclass bat, 50 urtetik aurrera entrenatzen nondik hasi irakasteko. Inoiz indar-lanik egin ez baduzu edo gimnasiora inoiz joan ez bazara: zerekin hasi, zein erritmotan, astean zenbat egunez, eta zergatik uzten duen hainbesteko jendeak edo ez duen hasten asmatzen.",
      paraQuien: "50 urte edo gehiago badituzu, entrenatu nahi baduzu eta nondik hasi ez badakizu.",
    },
    A: {
      titulo: "Bizkarrak ez zaitzala gelditu",
      promesa:
        "Bideo bidezko masterclass bat, bizkarreko minak entrenatzea eragotz ez dezan. Gorputzeko muskulu guztiak lantzeko ariketa egokituak, zure bizkarreko min motaren edo mugaren arabera aldaerekin. Ez dizut minik kentzea agintzen; entrenamendua egokitzen irakasten dizut, jarraitu ahal izateko. Oparitzat, 50 urtetik aurrera entrenatzen hasteko masterclassa.",
      paraQuien: "Bizkarreko arazoak badituzu (lumbagoa, ziatika, herniak, protrusioak…) eta gelditu beharrean entrenatzen jarraitu nahi baduzu.",
    },
    yaSomosTres: "3 gara jada: grabatuko dut.",
    queRecibes: {
      titulo: "Zer jasotzen duzu",
      lineas: [
        "Bideo bidezko masterclass bat: kamera aurrean nauzu, pantaila partekatzen dut eta ariketen argazki eta bideoekin egokitzen irakasten dizut.",
        "Nire webgunetik ikusten duzu, zure posta elektronikoarekin, erosi eta 24 hilabetez. Ezin da deskargatu. Bideoak gaztelaniaz daude.",
        "Entrega: hastekoa, abenduaren 28an (urtarrilean hasteko). Bizkarrekoa, urtarrilaren 10ean.",
        "Bizkarrekoa erosten baduzu, hastekoa opari, eta hori ere abenduaren 28an jasoko duzu.",
      ],
    },
    precio: {
      titulo: "Prezioa eta epea",
      B: "Zer egin 50 urtetik aurrera entrenatzen hasteko: 7 €, abenduaren 4ko 23:59ra arte. Gero, desagertu egiten da.",
      A: "Bizkarrak ez zaitzala gelditu: 17 €, aurrekoa opari, abenduaren 5etik 9ko 23:59ra arte. Hasteko masterclassa erosi baduzu, 10 € gehiago bakarrik. BEZa barne.",
      real: "Epe hau benetakoa da: ordua pasatuta, benetan ixten da.",
    },
    preventa: {
      titulo: "Zergatik aurrez salgai (eta zer gertatzen den iristen ez bagara)",
      texto: [
        "Oraindik ez dut grabatu, eta gutxienez 3 pertsona desberdin apuntatzen badira bakarrik grabatzen dut. Abenduaren 10ean, ostegunean, zenbat garen kontatuko dut eta idatziko dizuet.",
        "3ra iristen ez bagara, dirua itzuliko dizut, azalpen batekin. Hastekoa iristen bada eta bizkarrekoa ez, hastekoa jasoko duzu eta 10 €-ko aldea itzuliko dizut (edo dena, nahiago baduzu).",
      ],
    },
    quienSoy: {
      titulo: "Nor naiz",
      texto:
        "Alain Zulaika naiz, entrenatzaile pertsonal titulatua (Animazio Soziokiroleko goi-mailako zikloa), eta Entrenatzaile daramat, nire online entrenamendu zerbitzua.",
    },
    testimonio: {
      cita: "Sin falsas promesas y sin prisas.",
      autor: "Juan García, nirekin egin zuen Hoja de Rutari buruz (ez masterclass hauei buruz)",
    },
    faqTitulo: "Ohiko galderak",
    faq: [
      { p: "Noiz jasoko dut?", r: "Hastekoa, abenduaren 28an; bizkarrekoa, urtarrilaren 10ean. Bizkarrekoa erosten baduzu, hastekoa ere abenduaren 28an jasoko duzu." },
      { p: "Eta inor gehiago apuntatzen ez bada?", r: "Produktu bakoitzean 3 pertsonara iristen ez bagara, dirua itzuliko dizut." },
      { p: "Hastekoa erosi eta gero bizkarrekoa eros dezaket?", r: "Bai, abenduaren 9ko 23:59ra arte, 10 € gehiago ordainduta. Erabili erosteko erabili zenuen posta bera." },
      { p: "Eta gustatzen ez bazait?", r: "Erosi eta 15 egun dituzu, eta beste 15 sarbidea jasotzen duzunetik, itzulketa eskatzeko, arrazoirik eman gabe." },
      { p: "Bizkarreko mina kentzen dit?", r: "Ez dut agintzen: entrenamendua egokitzen irakasten dizut, minak gelditu ez zaitzan." },
      { p: "Zein hizkuntzatan dago?", r: "Bideoak, gaztelaniaz. Orri hau eta mezuak, euskaraz eta gaztelaniaz." },
      { p: "Nola ikusten dut?", r: "Nire webgunetik, zure postarekin, erosi eta 24 hilabetez. Ezin da deskargatu." },
      { p: "Faktura egiten didazu?", r: "Stripek ordainketaren egiaztagiria bidaltzen dizu. Faktura osoa behar baduzu zure datuekin, erantzun berrespen-mezuari eta bidaliko dizut." },
      { p: "Zalantzak galdetu ditzaket?", r: "Bai, contacto@alainzulaika.com helbidera idatzita." },
    ],
    form: {
      titulo: "Apuntatu",
      tituloSubida: "Apuntatu (hastekoa baduzu, 10 € bakarrik)",
      nombre: "Izena",
      email: "Posta elektronikoa",
      emailAyudaA: "Hastekoa erosi bazenuen, erabili posta bera: aldea bakarrik ordainduko duzu, 10 €.",
      continuar: "Jarraitu",
      cargando: "Itxaron…",
      antesDePagar: "Ordaindu aurretik",
      cambiarCorreo: "Datuak aldatu",
      yaB: "Posta honekin hastekoa baduzu jada. Abenduaren 28an jasoko duzu.",
      yaA: "Posta honekin biak dituzu jada. Abenduaren 28an eta urtarrilaren 10ean jasoko dituzu.",
      noAbierta: "Une honetan ez dago salgai.",
      errorEmail: "Begiratu posta: ez dirudi ondo idatzita dagoenik.",
      errorGeneral: "Zerbait gaizki atera da. Saiatu berriro pixka bat barru edo idatzi contacto@alainzulaika.com helbidera.",
      verDesistimiento: "Itzulketa eta atzera egiteko baldintzak ikusi",
    },
    modelo: "Atzera egiteko formulario-eredua",
    privacidad: "Pribatutasun-politika",
  },
};
