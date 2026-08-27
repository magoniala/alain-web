// Copy de la landing /espalda. Todo el texto de la página vive aquí.
//
// Las preguntas del formulario y los textos de las casillas NO están aquí:
// viven en lib/entrenatzaile-formularios.ts porque el endpoint también los
// graba, y tienen que ser literalmente los mismos que ve el lead.

export interface Bloque {
  // El bloque 2 va sin titular, a propósito.
  titulo?: string;
  parrafos: string[];
}

export const ESPALDA_HERO = {
  titulo: "El problema no es el tirón. Es que vuelve.",
  subtitulo: "Siete de cada diez espaldas vuelven a fallar en menos de un año.",
  cta: "Recibir la ficha",
  // Debajo del botón, no dentro: el botón tiene que seguir siendo un verbo
  // corto. Aquí es donde el ojo va a buscar "¿y qué es exactamente lo que me
  // llevo?". El título sale de FICHA_ESPALDA_TITULO.
  ctaNota: "Cuatro páginas en PDF. Se lee en cinco minutos.",
};

export const ESPALDA_BLOQUES: Bloque[] = [
  {
    parrafos: [
      "El episodio agudo se cura casi solo. En seis o doce semanas la mayoría de la gente ya casi no tiene dolores, haga lo que haga.",
      "Por eso parece funcionar casi todo lo que se prueba. Cuando en realidad, solo pasa el tiempo.",
      "Lo que no se cura esperando es la probabilidad de que vuelva.",
      "Y esa parte no la trabaja casi nadie.",
      "Esta es una ficha sobre por qué las espaldas vuelven a fallar y qué es lo que rompe el ciclo. También qué no lo rompe: el reposo, las fajas y el paracetamol salen mal parados.",
      "Cuatro páginas. Se lee en cinco minutos. Sin dramas y sin milagros.",
      // Esta frase es la que declara el alta en la newsletter: si se toca,
      // hay que tocar también DECLARACION_NEWSLETTER_ESPALDA.
      "La ha escrito Alain Zulaika, entrenador titulado especializado en personas de 45 a 65 años. Te llega por correo, y a partir de ahí llega también un correo diario sobre esto mismo. Te puedes dar de baja con un clic cuando quieras.",
    ],
  },
  {
    titulo: "Antes de recibirla, tres preguntas.",
    parrafos: [
      "Hay que responderlas escribiendo.",
      "No son para clasificar a nadie. Los correos que mando después salen de lo que la gente responde aquí, así que cuanto más concreto, más útil te va a resultar lo que recibas.",
      "Se tarda dos o tres minutos. Quien no los tenga ahora, mejor en otro momento.",
    ],
  },
];

export const ESPALDA_FORMULARIO = {
  // Justo encima de la primera pregunta: es el momento en que decide si le
  // compensa ponerse a escribir, así que aquí se le recuerda qué recibe.
  // No repite "tres preguntas" porque el bloque de arriba ya lo dice y
  // quedaría dicho dos veces seguidas.
  antesDelFormulario: "Al terminar te llega, en PDF:",
  // Botón que abre el formulario. NO dice "recibir la ficha" a propósito: ese
  // es el texto del botón final, el que envía. Si los dos dijeran lo mismo,
  // este prometería algo que no pasa al pulsarlo.
  empezar: "Responder las tres preguntas",
  nombrePista: "Para saber cómo llamarte.",
  emailPista: "Aquí te llega la ficha.",
  telefonoPista:
    "Para confirmar cosas puntuales por WhatsApp. Escribe Alain en persona, uno a uno. No hay envíos masivos.",
  whatsappPista: "Opcional. La ficha llega igual sin marcarla.",
  privacidad: "Política de privacidad",
  boton: "Recibir la ficha",
  enviando: "Enviando…",
};

export const ESPALDA_GRACIAS = {
  titulo: "Hecho. La ficha va de camino.",
  parrafos: [
    "Debería llegar en menos de cinco minutos. Si no aparece, mira en spam o en promociones — a veces cae ahí.",
  ],
  descargaBoton: "También puedes descargarla aquí",
  ctaTitulo: "Una cosa más, ya que estás aquí.",
  // Los saltos de línea de dentro de un párrafo se respetan al pintar.
  ctaParrafos: [
    "La ficha explica por qué vuelve el dolor de espalda y qué rompe el ciclo. Lo que no puede hacer es decirte por dónde empezar en tu caso concreto.",
    "Para eso está la Hoja de Ruta: te dirá en qué estado están de verdad tu fuerza y tu movilidad, qué trabajar primero, y qué hacer si el dolor vuelve.\nTuya, por escrito.",
    "Vale 90 €. Si reservas en menos de 8 días, no la pagas.",
  ],
  ctaBoton: "Ver en qué consiste",
};
