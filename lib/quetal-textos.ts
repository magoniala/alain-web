// Todos los textos de alainzulaika.com/quetal, en castellano y en euskera.
//
// El castellano es el copy de Alain. El euskera es traducción mía (batua,
// registro cercano) PENDIENTE DE REVISAR por Alain.
//
// Las preguntas del tipo de evento se guardan con el enunciado de aquí, en
// el idioma en que se contestaron: cambiar un texto no cambia lo que ya está
// guardado.

import type { Audiencia, CampoValoracion, Opcion, Permiso, Repetir, TipoEvento } from "./quetal";

type Textos = {
  meta: string;
  kicker: string;
  titulo: string;
  intro: string;
  opcional: string;
  siguiente: string;
  volver: string;
  enviar: string;
  enviando: string;

  secciones: [string, string, string, string, string, string];

  nombre: string;
  cargo: string;
  cargoPlaceholder: string;
  entidad: string;
  email: string;
  emailAyuda: string;
  eventoTitulo: string;
  tipoEvento: string;
  nombreEvento: string;
  fechaEvento: string;
  tipos: Record<TipoEvento, string>;

  npsPregunta: string;
  npsMin: string;
  npsMax: string;
  testimonio: Record<Audiencia | "generico", string>;
  testimonioAyuda: string;
  momento: string;
  dudas: string;

  preguntasTipo: Record<string, string>;
  opciones: Record<Opcion, string>;
  sinPreguntasTipo: string;

  valorarTitulo: string;
  valoraciones: Record<CampoValoracion, string>;
  noAplica: string;
  comentarioTrato: string;

  repetir: string;
  repetirOpciones: Record<Repetir, string>;
  referido: string;
  referidoNombre: string;
  referidoContacto: string;
  referidoAyuda: string;
  referidoPermiso: string;
  mejora: string;
  mejoraPrivada: string;

  permiso: string;
  permisoOpciones: Record<Permiso, string>;
  permisoLogo: string;
  permisoFotos: string;
  privacidadAntes: string;
  privacidadEnlace: string;
  privacidadDespues: string;

  gracias: string;
  resena: string;
  yaRespondido: string;

  errores: {
    obligatorios: string;
    email: string;
    nps: string;
    testimonio: string;
    permiso: string;
    privacidad: string;
    envio: string;
  };

  pie: { aviso: string; privacidad: string; cookies: string };
};

export const QUETAL_TEXTOS: Record<"es" | "eu", Textos> = {
  es: {
    meta: "¿Qué tal fue? — Alain Zulaika",
    kicker: "Valoración",
    titulo: "¿Qué tal fue?",
    intro:
      "Gracias por contar conmigo. Te lleva 3 minutos y me ayuda muchísimo, tanto a mejorar como a que otros organizadores sepan qué esperar.",
    opcional: "(opcional)",
    siguiente: "Siguiente →",
    volver: "← volver",
    enviar: "Enviar",
    enviando: "Enviando…",

    secciones: ["Tú", "La valoración", "Cómo lo vivisteis", "Trabajar conmigo", "Lo que viene", "Permisos"],

    nombre: "Nombre",
    cargo: "Cargo / papel en el evento",
    cargoPlaceholder: "p. ej. Comisión de fiestas, Responsable de RRHH",
    entidad: "Entidad",
    email: "Email",
    emailAyuda: "Opcional, por si quiero enseñarte el texto antes de publicarlo.",
    eventoTitulo: "El evento",
    tipoEvento: "Tipo de evento",
    nombreEvento: "Nombre del evento",
    fechaEvento: "Fecha",
    tipos: {
      familiar: "Show familiar",
      taller: "Taller",
      fiestas: "Magia itinerante o cóctel en fiestas",
      empresa: "Evento interno de empresa",
      feria: "Feria / stand",
      externo: "Puertas abiertas o evento externo de empresa",
      hosteleria: "Bar o restaurante",
      centro: "Charla o show en centro educativo",
      privado: "Celebración privada",
    },

    npsPregunta: "¿Qué probabilidad hay de que me recomiendes a otra persona que organice eventos?",
    npsMin: "Nada probable",
    npsMax: "Muy probable",
    testimonio: {
      comision: "Si alguien de otra comisión u organización te preguntase por mí, ¿qué le dirías?",
      empresa: "Si alguien de otra empresa te preguntase por mí, ¿qué le dirías?",
      centro: "Si alguien de otro centro educativo te preguntase por mí, ¿qué le dirías?",
      hosteleria: "Si alguien de otro bar o restaurante te preguntase por mí, ¿qué le dirías?",
      privado: "Si alguien que esté preparando una celebración te preguntase por mí, ¿qué le dirías?",
      generico: "Si otra persona que organiza un evento te preguntase por mí, ¿qué le dirías?",
    },
    testimonioAyuda: "Escríbelo como se lo dirías a esa persona, con tus palabras.",
    momento: "¿Hubo algún momento o reacción del público que se te haya quedado?",
    dudas: "Antes del evento, ¿teníais alguna duda o algo que os preocupase? ¿Cómo salió al final?",

    preguntasTipo: {
      fam_ninos: "¿Cómo respondieron los niños y las niñas?",
      fam_adultos: "¿Y las personas adultas?",
      fam_familias: "¿Os llegó algún comentario de las familias después del show?",
      magia_antes: "¿Habíais tenido magia otros años?",
      magia_diferencia: "¿Notasteis alguna diferencia?",
      tal_vivencia: "¿Cómo vivieron el taller los participantes?",
      tal_casa: "¿Se fueron con algo que puedan repetir en casa?",
      fie_grupos: "¿Cómo reaccionaba la gente cuando me acercaba a los grupos?",
      emp_ambiente: "¿Notaste algún efecto en el ambiente del equipo, durante el evento o después?",
      fer_stand: "¿Se paró más gente en el stand de lo habitual?",
      fer_conversaciones: "¿Ayudó a que los comerciales empezasen conversaciones?",
      ext_mensaje: "¿Crees que ayudó a que el mensaje del evento llegase y se recordase?",
      ext_comentarios: "Algún comentario de asistentes que te llegase",
      hos_local: "¿Notaste algún efecto en el local (más gente, gente que se quedó más rato, comentarios de clientes)?",
      cen_alumnado: "¿Cómo respondió el alumnado?",
      cen_profesorado: "¿Y el profesorado?",
      cen_aula: "¿Notasteis después alguna conversación en el aula sobre el tema?",
      pri_celebracion: "¿Qué celebrabais y cómo encajó la magia en el momento?",
    },
    opciones: {
      si: "Sí",
      no: "No",
      nose: "No lo sé",
      masomenos: "Más o menos",
      bastante_mas: "Bastante más",
      algo_mas: "Algo más",
      igual: "Igual",
      nosabria: "No sabría decir",
      claramente: "Sí, claramente",
      algo: "Algo",
    },
    sinPreguntasTipo: "Elige el tipo de evento en el primer paso para ver estas preguntas.",

    valorarTitulo: "Valora de 1 a 5",
    valoraciones: {
      val_comunicacion: "Comunicación y respuesta antes del evento",
      val_promocional: "Cartel y texto promocional",
      val_puntualidad: "Puntualidad y montaje",
      val_adaptacion: "Adaptación al espacio y al público",
    },
    noAplica: "No aplica",
    comentarioTrato: "¿Algo que añadir sobre cómo fue trabajar conmigo?",

    repetir: "¿Os gustaría repetir?",
    repetirOpciones: {
      proxima: "Sí, en la próxima edición",
      otro_tipo: "Sí, en otro tipo de evento",
      puede: "Puede ser",
      no: "No por ahora",
    },
    referido: "¿Conoces a alguien que organice eventos y al que le pueda venir bien?",
    referidoNombre: "Nombre / entidad",
    referidoContacto: "Teléfono o email",
    referidoAyuda: "Solo le escribiré mencionándote si tú me lo dices aquí.",
    referidoPermiso: "Puedes decirle que vienes de mi parte",
    mejora: "Si tuvieras que mejorar una cosa, ¿cuál sería?",
    mejoraPrivada: "Esto solo lo leo yo, no se publica.",

    permiso: "¿Puedo publicar tu valoración en mi web y redes?",
    permisoOpciones: {
      completo: "Sí, con mi nombre, cargo y entidad",
      entidad: "Sí, solo con la entidad",
      anonimo: "Sí, de forma anónima",
      no: "No, es solo para ti",
    },
    permisoLogo: "Puedes usar el logo de la entidad junto a la valoración",
    permisoFotos: "Puedes usar fotos o vídeos del evento",
    privacidadAntes: "He leído y acepto la ",
    privacidadEnlace: "política de privacidad",
    privacidadDespues: "",

    gracias: "¡Eskerrik asko! Lo leo con calma y, si quiero publicarlo, te lo enseño antes.",
    resena: "¿Me dejas también una reseña en Google? Me ayuda un montón.",
    yaRespondido: "Ya tengo tu respuesta, eskerrik asko.",

    errores: {
      obligatorios: "Rellena los campos marcados con *.",
      email: "Ese email no parece válido.",
      nps: "Elige un número del 0 al 10.",
      testimonio: "Cuéntame qué le dirías.",
      permiso: "Elige una opción.",
      privacidad: "Para enviarlo tienes que aceptar la política de privacidad.",
      envio: "Algo ha fallado. Vuelve a intentarlo o escríbeme a contacto@alainzulaika.com.",
    },

    pie: { aviso: "Aviso legal", privacidad: "Privacidad", cookies: "Cookies" },
  },

  eu: {
    meta: "Nola joan zen? — Alain Zulaika",
    kicker: "Balorazioa",
    titulo: "Nola joan zen?",
    intro:
      "Eskerrik asko niregana jotzeagatik. 3 minutu baino ez dira, eta asko laguntzen dit, bai hobetzeko, bai beste antolatzaile batzuek zer espero duten jakin dezaten.",
    opcional: "(aukerakoa)",
    siguiente: "Hurrengoa →",
    volver: "← itzuli",
    enviar: "Bidali",
    enviando: "Bidaltzen…",

    secciones: ["Zu", "Balorazioa", "Nola bizi izan zenuten", "Nirekin lan egitea", "Hemendik aurrera", "Baimenak"],

    nombre: "Izena",
    cargo: "Kargua / zeregina ekitaldian",
    cargoPlaceholder: "adib. Jai-batzordea, Giza Baliabideetako arduraduna",
    entidad: "Erakundea",
    email: "Emaila",
    emailAyuda: "Aukerakoa, argitaratu aurretik testua erakutsi nahi badizut.",
    eventoTitulo: "Ekitaldia",
    tipoEvento: "Ekitaldi mota",
    nombreEvento: "Ekitaldiaren izena",
    fechaEvento: "Data",
    tipos: {
      familiar: "Familia-ikuskizuna",
      taller: "Tailerra",
      fiestas: "Magia ibiltaria edo koktela jaietan",
      empresa: "Enpresaren barne-ekitaldia",
      feria: "Azoka / standa",
      externo: "Ate irekiak edo enpresaren kanpo-ekitaldia",
      hosteleria: "Taberna edo jatetxea",
      centro: "Hitzaldia edo ikuskizuna ikastetxean",
      privado: "Ospakizun pribatua",
    },

    npsPregunta: "Zenbateko probabilitatea dago ekitaldiak antolatzen dituen beste norbaiti ni gomendatzeko?",
    npsMin: "Batere ez",
    npsMax: "Oso litekeena",
    testimonio: {
      comision: "Beste batzorde edo erakunde bateko norbaitek nitaz galdetuko balizu, zer esango zenioke?",
      empresa: "Beste enpresa bateko norbaitek nitaz galdetuko balizu, zer esango zenioke?",
      centro: "Beste ikastetxe bateko norbaitek nitaz galdetuko balizu, zer esango zenioke?",
      hosteleria: "Beste taberna edo jatetxe bateko norbaitek nitaz galdetuko balizu, zer esango zenioke?",
      privado: "Ospakizun bat prestatzen ari den norbaitek nitaz galdetuko balizu, zer esango zenioke?",
      generico: "Ekitaldi bat antolatzen ari den beste norbaitek nitaz galdetuko balizu, zer esango zenioke?",
    },
    testimonioAyuda: "Idatzi pertsona horri esango zeniokeen bezala, zure hitzekin.",
    momento: "Ikusleen une edo erreakzioren bat geratu zaizu gogoan?",
    dudas: "Ekitaldiaren aurretik, zalantzaren bat edo kezkatzen zintuzten zerbait bazenuten? Azkenean nola atera zen?",

    preguntasTipo: {
      fam_ninos: "Nola erantzun zuten neska-mutikoek?",
      fam_adultos: "Eta helduek?",
      fam_familias: "Familien iruzkinen bat iritsi zitzaizuen ikuskizunaren ondoren?",
      magia_antes: "Beste urte batzuetan magiarik izan zenuten?",
      magia_diferencia: "Alderik nabaritu zenuten?",
      tal_vivencia: "Nola bizi izan zuten tailerra parte-hartzaileek?",
      tal_casa: "Etxean errepika dezaketen zerbait eraman zuten?",
      fie_grupos: "Nola erreakzionatzen zuen jendeak taldeetara hurbiltzen nintzenean?",
      emp_ambiente: "Taldearen giroan eraginik nabaritu zenuen, ekitaldian bertan edo ondoren?",
      fer_stand: "Ohi baino jende gehiago gelditu zen standean?",
      fer_conversaciones: "Lagundu zuen komertzialek elkarrizketak has zitzaten?",
      ext_mensaje: "Uste duzu lagundu zuela ekitaldiaren mezua iristen eta gogoan geratzen?",
      ext_comentarios: "Bertaratuen iruzkinen bat iritsi bazaizu",
      hos_local: "Eraginik nabaritu zenuen lokalean (jende gehiago, denbora gehiago geratu zen jendea, bezeroen iruzkinak)?",
      cen_alumnado: "Nola erantzun zuten ikasleek?",
      cen_profesorado: "Eta irakasleek?",
      cen_aula: "Gero, gaiari buruzko elkarrizketarik sortu zen ikasgelan?",
      pri_celebracion: "Zer ospatzen zenuten, eta nola egokitu zen magia une horretan?",
    },
    opciones: {
      si: "Bai",
      no: "Ez",
      nose: "Ez dakit",
      masomenos: "Gutxi gorabehera",
      bastante_mas: "Dezente gehiago",
      algo_mas: "Zertxobait gehiago",
      igual: "Berdin",
      nosabria: "Ez nuke jakingo esaten",
      claramente: "Bai, argi eta garbi",
      algo: "Zertxobait",
    },
    sinPreguntasTipo: "Aukeratu ekitaldi mota lehen urratsean galdera hauek ikusteko.",

    valorarTitulo: "Baloratu 1etik 5era",
    valoraciones: {
      val_comunicacion: "Komunikazioa eta erantzuna ekitaldiaren aurretik",
      val_promocional: "Kartela eta sustapen-testua",
      val_puntualidad: "Puntualtasuna eta muntaketa",
      val_adaptacion: "Espaziora eta ikusleetara egokitzea",
    },
    noAplica: "Ez dagokio",
    comentarioTrato: "Nirekin lan egiteaz, zerbait gehitu nahi duzu?",

    repetir: "Errepikatu nahiko zenukete?",
    repetirOpciones: {
      proxima: "Bai, hurrengo edizioan",
      otro_tipo: "Bai, beste ekitaldi mota batean",
      puede: "Agian",
      no: "Oraingoz ez",
    },
    referido: "Ezagutzen duzu ekitaldiak antolatzen dituen norbait, ondo etor dakiokeena?",
    referidoNombre: "Izena / erakundea",
    referidoContacto: "Telefonoa edo emaila",
    referidoAyuda: "Zure izena aipatuta idatziko diot, hemen hala esaten badidazu bakarrik.",
    referidoPermiso: "Esan diezaiokezu nire partetik zoazela",
    mejora: "Gauza bat hobetu beharko bazenu, zein izango litzateke?",
    mejoraPrivada: "Hau nik bakarrik irakurtzen dut, ez da argitaratzen.",

    permiso: "Zure balorazioa nire webgunean eta sare sozialetan argitara dezaket?",
    permisoOpciones: {
      completo: "Bai, nire izena, kargua eta erakundea jarrita",
      entidad: "Bai, erakundea bakarrik jarrita",
      anonimo: "Bai, modu anonimoan",
      no: "Ez, zuretzat bakarrik da",
    },
    permisoLogo: "Erakundearen logoa erabil dezakezu balorazioarekin batera",
    permisoFotos: "Ekitaldiko argazkiak edo bideoak erabil ditzakezu",
    privacidadAntes: "",
    privacidadEnlace: "Pribatutasun-politika",
    privacidadDespues: " irakurri dut eta onartzen dut",

    gracias: "Eskerrik asko! Lasai irakurriko dut eta, argitaratu nahi badut, aurrez erakutsiko dizut.",
    resena: "Google-n iritzi bat ere utziko didazu? Izugarri laguntzen dit.",
    yaRespondido: "Zure erantzuna jasota daukat, eskerrik asko.",

    errores: {
      obligatorios: "Bete * ikurra duten eremuak.",
      email: "Email horrek ez du itxura zuzenik.",
      nps: "Aukeratu zenbaki bat 0tik 10era.",
      testimonio: "Kontatu zer esango zenioke.",
      permiso: "Aukeratu bat.",
      privacidad: "Bidaltzeko, pribatutasun-politika onartu behar duzu.",
      envio: "Zerbait gaizki joan da. Saiatu berriro edo idatzi kontaktu@alainzulaika.com helbidera.",
    },

    pie: { aviso: "Lege oharra", privacidad: "Pribatutasuna", cookies: "Cookieak" },
  },
};
