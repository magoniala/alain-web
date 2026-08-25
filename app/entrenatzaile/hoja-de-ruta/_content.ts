// Copy de la landing /hoja-de-ruta.
//
// UNA sola plantilla para las dos versiones. Todo el copy es común salvo lo
// que está explícitamente partido por variante: los micro-copys de precio,
// el párrafo de precio del cierre, su última línea, y la sección "Por qué te
// la regalo" (marcada con soloEn: "ventana").
//
// Regla: si tocas una frase, se toca en las dos versiones a la vez porque
// solo existe una vez. Lo único que hay que tocar dos veces es lo que está
// dentro de un objeto con claves `ventana` / `evergreen`.

export type VarianteHR = "ventana" | "evergreen";

export type PorVariante<T> = Record<VarianteHR, T>;

export interface Parrafo {
  // Primera línea en negrita (los subtítulos internos del copy).
  destacado?: string;
  // Apostilla en la misma línea del destacado, pero sin negrita.
  nota?: string;
  // Cuerpo. Los saltos de línea se respetan al pintar.
  texto?: string;
}

export interface SeccionHR {
  titulo?: string;
  parrafos: Parrafo[];
  // Sin `soloEn`, la sección sale en las dos versiones.
  soloEn?: VarianteHR;
  // Botón de reserva al final de la sección.
  cta?: { micro?: PorVariante<string | null> };
}

export const HOJA_RUTA_BOTON = "Reservar mi Hoja de Ruta";

const BULLET_ENTREGA = "La recibes por escrito en 24-48 h, garantizado.";
const BULLET_PROPIEDAD = "Es tuya: la ejecutas solo, conmigo o con otro entrenador.";

export const HOJA_RUTA_HERO = {
  titulo: "El dolor de espalda se cura solo. Que no vuelva, no.",
  // Unificado: la versión de la ventana decía "7 de cada 10 recaen antes de
  // un año" y la evergreen esto. Se queda esta, que es la misma frase que
  // abre /espalda.
  subtitulo: "Siete de cada diez espaldas vuelven a fallar en menos de un año.",
  entradilla:
    "Una hora por videollamada conmigo y te llevas por escrito tu Hoja de Ruta: en qué estado están de verdad tu fuerza y tu movilidad, qué tienes que trabajar primero, y qué hacer el día que el dolor vuelva. Sin gimnasio, sin estar en forma, sin compromiso de seguir conmigo.",
  boton: HOJA_RUTA_BOTON,
  bulletPrecio: {
    ventana: "Vale 90 €. Gratis durante tus 8 primeros días conmigo.",
    evergreen: "90 €, deducibles del primer trimestre si decides seguir.",
  } satisfies PorVariante<string>,
  bullets: [BULLET_ENTREGA, BULLET_PROPIEDAD],
};

export const HOJA_RUTA_SECCIONES: SeccionHR[] = [
  {
    titulo: "Esto ya lo has vivido.",
    parrafos: [
      {
        texto:
          "Te agachas a coger algo del suelo. Un gesto que has hecho mil veces.\nPero esta vez te quedas ahí, doblado, sin poder incorporarte.",
      },
      { texto: "Antiinflamatorios.\nReposo.\nFisio, si tienes suerte y no hay lista de espera." },
      { texto: "Y a las pocas semanas, el dolor desaparece y vuelves a tu vida." },
      { destacado: "Hasta que vuelve." },
      {
        texto:
          "Pero, mientras tanto, casi sin darte cuenta, algo cambia en ti.\nLas salidas en bici cada vez son menos habituales.\nLevantas a tu nieto «con cuidado».\nPiensas dos veces antes de agacharte.",
      },
      { texto: "Ya nunca te fías del todo.\nY esa es la parte que no arregla ningún tratamiento." },
      {
        destacado: "El episodio agudo se cura solo.",
        texto:
          "En seis o doce semanas la mayoría está mejor, incluso sin tratamiento alguno.\nPor eso parece funcionar casi todo lo que pruebas.\nEn realidad, solo pasa el tiempo.",
      },
      {
        destacado: "Lo que no se cura esperando es la probabilidad de que vuelva.",
        texto:
          "Siete de cada diez lumbagos recaen en menos de un año.\nY cada recaída te hace «cuidarte» un poco más.",
      },
      {
        texto:
          "El fisio te baja el dolor, pero no trabaja eso.\nEl reposo y los medicamentos tampoco: solo te hacen olvidarlo.\nY tú evitas empeorarlo, que no es lo mismo que resolverlo.",
      },
      { texto: "De esa parte me ocupo yo." },
    ],
  },

  {
    titulo: "Antes de seguir, lo que no te voy a prometer.",
    parrafos: [
      {
        texto:
          "No te voy a decir que el dolor va a desaparecer.\nNi que no vas a recaer nunca más.\nNadie serio puede decirte eso, y quien te lo diga te está engañando para sacarte dinero.",
      },
      { texto: "No soy médico ni fisioterapeuta. No diagnostico, no receto y no interpreto resonancias." },
      {
        texto:
          "Entreno a gente con hernias, con ciática y con años de dolor a la espalda.\nEs decir, trabajo con la lesión, no la trato.",
      },
      { texto: "Lo que sí hago es esto:" },
      {
        destacado: "Te digo en qué estado está tu cuerpo hoy.",
        texto: "No lo que crees que puedes hacer: lo que puedes hacer de verdad, medido.",
      },
      {
        destacado: "Te digo qué trabajar primero y por qué.",
        texto: "Tus prioridades, no una lista de ejercicios sacada de internet.",
      },
      {
        destacado: "Te digo qué puedes hacer sin miedo y qué conviene esperar.",
        texto:
          "Perder el miedo del todo lleva meses o años de entrenamiento progresivo.\nPero salir de la llamada sabiendo qué es seguro para ti y qué molestias son motivo de parar ya te quita muchas decisiones de encima.",
      },
      {
        destacado: "Te doy un protocolo por si el dolor vuelve.",
        texto: "Qué hacer las primeras 48 horas, qué no, y cómo volver a entrenar sin repetir el error de siempre.",
      },
      {
        texto:
          "Eso es lo que compras aquí. Proceso, criterio y capacidad.\nNo una promesa de que no te va a doler nunca más.",
      },
    ],
  },

  {
    titulo: "Lo que te llevas: tu Hoja de Ruta.",
    parrafos: [
      {
        texto:
          "No es un PDF genérico con ejercicios para la espalda.\nEs un documento escrito para ti, después de haberte visto moverte.",
      },
      { texto: "Incluye:" },
      {
        destacado: "Tu punto de partida, medido.",
        texto:
          "Fuerza, movilidad y calidad de movimiento.\nQué está por debajo de lo que debería y qué está mejor de lo que crees.",
      },
      {
        destacado: "Tus prioridades, en orden.",
        texto: "Qué trabajar primero, qué después, y por qué en ese orden y no en otro.",
      },
      {
        destacado: "Metas realistas para los próximos tres meses.",
        texto: "Alcanzables. No «estar como a los treinta» ni «tener abdominales de Instagram».",
      },
      {
        destacado: "El protocolo por si el dolor vuelve.",
        nota: "(Ficha extra)",
        texto: "Qué hacer las primeras 48 horas, qué no, y cómo volver a entrenar.",
      },
      { texto: "Recibes todo por escrito en 24 o 48 horas después de la llamada." },
      {
        destacado: "Y es tuya.",
        texto:
          "Puedes ejecutarla por tu cuenta. Puedes llevártela a tu gimnasio y dársela a tu entrenador. O puedes pedirme que te acompañe yo.",
      },
      {
        texto:
          "Si eso último te interesa, dentro va también lo que cuesta trabajar conmigo, sin que tengas que preguntarlo ni escuchar ninguna presentación de ventas. Lo lees en casa y decides. Si no vuelves a saber de mí, la Hoja de Ruta sigue siendo tuya y sigue sirviéndote igual.",
      },
    ],
    cta: {
      micro: {
        ventana: "Gratis durante tus primeros 8 días.",
        evergreen: "90 €, deducibles del primer trimestre si decides seguir.",
      },
    },
  },

  {
    // Esta sección no existe en la versión evergreen.
    soloEn: "ventana",
    titulo: "Por qué te la regalo.",
    parrafos: [
      { texto: "Esta valoración vale 90 €.\nEs lo que cobro por ella al resto de la gente." },
      {
        texto:
          "A ti no te la cobro, y prefiero explicarte por qué antes de que te lo preguntes.\nHago cinco valoraciones a la semana.\nUna al día, no más, porque cada una me lleva una hora de llamada y un par de horas de trabajo escribiendo tu Hoja de Ruta.",
      },
      { texto: "Esas cinco plazas las reservo para gente que acaba de llegar." },
      {
        texto:
          "Porque es así como consigo clientes.\nAlgunos, después de leer su Hoja de Ruta, me piden que les acompañe.\nMuchos no. Y me sale a cuenta igual.",
      },
      {
        texto:
          "Es una apuesta mía, no tuya.\nSi no quieres seguir, te has llevado gratis un trabajo por el que otros pagan.\nEse es el trato.",
      },
      {
        destacado: "Pasados esos ocho días, vuelve a costar 90 €.",
        texto:
          "Lo que cuenta es cuándo reservas, no cuándo hacemos la llamada.\nNo es un truco para meterte prisa.\nEs que solo son cinco a la semana. Si la dejara abierta para todo el mundo, no llegaría.",
      },
    ],
    cta: {
      micro: {
        ventana: "Gratis durante tus primeros 8 días conmigo. Después 90 €.",
        evergreen: null,
      },
    },
  },

  {
    titulo: "Tres pasos. Nada más.",
    parrafos: [
      {
        destacado: "1. Reservas tu hora.",
        texto: "Eliges día y hora.\nTe escribo por WhatsApp para confirmar y te mando el enlace.",
      },
      {
        destacado: "2. Hablamos y te veo moverte. Una hora.",
        texto:
          "Empezamos por un cuestionario de seguridad.\nEs el estándar que usamos los entrenadores para saber si alguien puede entrenar sin riesgo.\nSi algo indica que necesitas ver a un médico antes que a mí, te lo digo y no seguimos.",
      },
      { texto: "Después, tu historia: cuántos episodios, qué te dijeron, qué has probado, cómo es tu día a día." },
      {
        texto:
          "Y por último te pido unos movimientos delante de la cámara. Ahí veo cómo te mueves y mido tu fuerza y tu movilidad.",
      },
      {
        texto:
          "No necesitas gimnasio, ni material, ni estar en forma.\nCuanto menos en forma estés, más claro se ve por dónde empezar.",
      },
      { destacado: "3. Recibes tu Hoja de Ruta.", texto: "En 24 o 48 horas, por escrito." },
    ],
  },

  {
    titulo: "Por qué me dedico a esto.",
    parrafos: [
      {
        texto:
          "Me llamo Alain Zulaika.\nSoy entrenador titulado y llevo años entrenando a gente, primero en sala y luego online.",
      },
      { texto: "Mi madre fue el motivo por el que empecé a hacer esto de otra manera." },
      {
        texto:
          "Había pasado su segundo cáncer y varios lumbagos agudos.\nLa típica situación en la que todo el mundo te dice que tengas cuidado.\nHoy va sola al gimnasio varias veces por semana y sigue progresando.\nEmpezó en casa, por pánico a entrar en un gimnasio.",
      },
      {
        texto:
          "A mi padre le acaban de operar de la cadera.\nY mi abuela de 80 años está encamada y necesita ayuda hasta para ducharse.",
      },
      {
        texto:
          "Ninguno de los tres llegó ahí de golpe.\nFue una vida que se fue haciendo un poco más pequeña cada año.\nSin ruido. Sin un día concreto en el que pasara.",
      },
      {
        texto:
          "Por eso hago esto y por eso trabajo con gente de tu edad.\nPorque sé que lo que hagas hoy decide qué podrás hacer a los 80.\nLas operaciones y los sustos de salud, a cierta edad, son casi inevitables.\nLo que decide cómo sales de ellos es la fuerza con la que llegas.",
      },
      { texto: "Mi abuela llegó con poca.\nMi padre está a tiempo, y tú también." },
      {
        texto:
          "No trabajo para que te veas bien en la playa.\nTrabajo para que a los 75 puedas subir a tu casa cargado con la compra y bajar a tu nieto del columpio.",
      },
    ],
  },

  {
    titulo: "De no atreverse a coger peso del suelo a levantar 140 kg.",
    parrafos: [
      {
        texto:
          "Cuando empezamos, Jorge A. no se atrevía a coger nada del suelo.\nLlevaba años evitándolo.\nLas molestias y dolores en la espalda eran constantes.",
      },
      {
        texto:
          "No le quité el miedo hablando.\nSe lo quitó él, confiando en mi palabra, pero sobre todo levantando cada semana un poco más de lo que levantaba la semana anterior, con criterio detrás.",
      },
      {
        texto:
          "Terminó haciendo 140 kilos desde el suelo.\n«Nunca me habría imaginado poder levantar esto, y encima sin dolor.»\nY sin miedo: le tuve que frenar las ganas de intentar 145.",
      },
      { texto: "Hoy tiene un cuerpo que aguanta un tropiezo, un mal gesto o un empujón sin que le pase factura." },
      {
        texto:
          "No te enseño esto para decirte que vas a levantar 140 kilos.\nA lo mejor no te hace falta, ni te interesa.",
      },
      {
        texto:
          "Te lo enseño porque el punto de partida probablemente te suene: una espalda en la que no confías y un cuerpo que has ido metiendo en una caja cada vez más pequeña.",
      },
      { texto: "De ahí se sale. Pero no evitando cosas." },
    ],
    cta: {},
  },
];

export const HOJA_RUTA_CIERRE = {
  titulo: "Tu espalda va a seguir haciendo lo mismo hasta que hagas algo distinto.",
  parrafos: [
    {
      texto:
        "Una hora por videollamada.\nTu Hoja de Ruta por escrito en 24 o 48 horas.\nEl protocolo por si el dolor vuelve.",
    },
  ] satisfies Parrafo[],
  precio: {
    ventana:
      "Vale 90 €. Si reservas en tus primeros 8 días conmigo, no lo pagas.\nAunque la llamada la hagamos el mes que viene.",
    evergreen:
      "90 €. Si después decides que te acompañe, se descuentan del primer trimestre.\nNo hay descuentos ni ofertas: cuesta lo mismo todo el año.",
  } satisfies PorVariante<string>,
  formularioTitulo: "Elige tu hueco",
  telefonoPista: "Para confirmarte y mandarte el enlace de la llamada.",
  privacidad: "Política de privacidad",
  boton: HOJA_RUTA_BOTON,
  enviando: "Guardando…",
  cierre: {
    ventana: "Te confirmo por WhatsApp en cuanto reserves.\nNada más. No hay pagos ni permanencia.",
    evergreen: "Te confirmo por WhatsApp en cuanto reserves.\nNada más. No hay permanencia.",
  } satisfies PorVariante<string>,
};

export const HOJA_RUTA_HUECOS = {
  titulo: "Elige tu hueco",
  intro: "Estos son los huecos que quedan libres. Elige el que mejor te venga.",
  cargando: "Cargando huecos…",
  vacio: "Ahora mismo no quedan huecos abiertos. Escríbeme a contacto@alainzulaika.com y lo cuadramos.",
  boton: "Confirmar el hueco",
  hechoTitulo: "Hueco reservado.",
  hechoTexto: "Te confirmo por WhatsApp en cuanto lo vea, y te mando el enlace de la llamada.",
};

// El visual del entregable ya no es una imagen suelta: vive en el componente
// PreviewHojaDeRuta (app/entrenatzaile/PreviewHojaDeRuta.tsx), que se usa
// tanto en el hero de esta landing como en la página de gracias de /espalda.
