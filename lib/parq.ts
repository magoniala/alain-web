// Textos del cuestionario PAR-Q+ de /parq (entrenatzaile.alainzulaika.com/parq).
//
// Es la versión 2023 del PAR-Q+ (PAR-Q+ Collaboration), traducida al
// castellano sin cambiar el contenido: las mismas preguntas, en el mismo
// orden, con las mismas aclaraciones y los mismos tres resultados posibles.
// El PAR-Q+ se puede usar libremente siempre que no se modifique, así que
// aquí no se resume ni se reescribe nada por estilo.
//
// Como en /audio, los textos viven aquí: la página los pinta desde este
// módulo y el endpoint graba desde este mismo módulo, así que lo que queda en
// parq_respuestas es lo que se mostró. El resultado se calcula con la misma
// función en los dos lados; lo que vale es el del servidor.
//
// Al cambiar el texto de la casilla, sube CONSENT_PARQ_VERSION.

export const CONSENT_PARQ_VERSION = "2026-10-20";

export const PARQ_TEXTOS = {
  titulo: "Cuestionario de aptitud para la actividad física (PAR-Q+)",
  intro: [
    "Hacer actividad física con regularidad es bueno para la salud, y cada vez más gente se mueve a diario. Para casi todo el mundo es muy seguro. Este cuestionario te dice si conviene que consultes antes a un médico o a un profesional del ejercicio cualificado.",
    "Son siete preguntas generales. Si respondes «sí» a alguna, vienen unas pocas más sobre esa condición. Lee cada una con calma y responde con sinceridad.",
    "Al terminar ves tu resultado en pantalla, y a mí me llegan tus respuestas para preparar tu entrenamiento con eso en cuenta.",
  ],
  privacidad: "Política de privacidad",
  enviando: "Enviando…",
  si: "Sí",
  no: "No",
  siguiente: "Siguiente",
  verResultado: "Ver resultado",
  volver: "← Volver",
  imprimir: "Imprimir o guardar en PDF",
  faltaRespuesta: "Responde «sí» o «no» para seguir.",
  faltaPermiso: "Necesito tu permiso para tratar las respuestas antes de enviarlas.",
  faltanSubpreguntas: "Responde todas las preguntas de esta pantalla para seguir.",
  fuente:
    "Basado en el PAR-Q+ 2023 de la PAR-Q+ Collaboration (Warburton, Jamnik, Bredin y Gledhill). Traducción al castellano de Entrenatzaile. Este cuestionario no sustituye a una consulta médica.",
} as const;

export const PREGUNTAS_CONTACTO = {
  nombre: "Nombre",
  email: "Correo electrónico",
  telefono: "WhatsApp",
} as const;

export const CONSENT_PARQ = {
  datos:
    "Acepto que Alain Zulaika trate mis respuestas a este cuestionario —que incluyen información sobre mi salud— con la única finalidad de valorar si puedo empezar a entrenar con él y de qué manera, y que me escriba por WhatsApp o por correo sobre ello. Sé que puedo retirar este consentimiento escribiendo a contacto@alainzulaika.com.",
} as const;

export type PreguntaParq = { id: string; texto: string; pista?: string };

// Página 1 del PAR-Q+: preguntas generales de salud.
export const PREGUNTAS_GENERALES: PreguntaParq[] = [
  {
    id: "g1",
    texto: "¿Alguna vez un médico te ha dicho que tienes un problema de corazón o la tensión alta?",
  },
  {
    id: "g2",
    texto:
      "¿Sientes dolor en el pecho en reposo, durante tus actividades del día a día o cuando haces actividad física?",
  },
  {
    id: "g3",
    texto:
      "¿Pierdes el equilibrio por mareos o has perdido el conocimiento en los últimos 12 meses?",
    pista:
      "Responde «no» si el mareo fue por respirar demasiado rápido, también durante un ejercicio intenso.",
  },
  {
    id: "g4",
    texto:
      "¿Te han diagnosticado alguna otra enfermedad crónica, aparte de enfermedad del corazón o tensión alta?",
  },
  {
    id: "g5",
    texto: "¿Tomas ahora medicación recetada para alguna enfermedad crónica?",
  },
  {
    id: "g6",
    texto:
      "¿Tienes ahora, o has tenido en los últimos 12 meses, algún problema de huesos, articulaciones o tejidos blandos (músculos, ligamentos o tendones) que podría empeorar si te vuelves más activo?",
    pista:
      "Responde «no» si tuviste un problema en el pasado pero hoy no te limita para hacer actividad física.",
  },
  {
    id: "g7",
    texto: "¿Alguna vez un médico te ha dicho que solo debes hacer actividad física bajo supervisión médica?",
  },
];

export type CondicionParq = {
  id: string;
  texto: string;
  pista?: string;
  subpreguntas: PreguntaParq[];
};

// Páginas 2 y 3 del PAR-Q+: preguntas de seguimiento por condición. Si la
// pregunta principal es «no», sus subpreguntas no se hacen.
export const CONDICIONES: CondicionParq[] = [
  {
    id: "c1",
    texto: "¿Tienes artritis, osteoporosis o problemas de espalda?",
    subpreguntas: [
      {
        id: "c1a",
        texto:
          "¿Te cuesta controlar tu condición con medicación u otros tratamientos indicados por tu médico?",
        pista: "Responde «no» si ahora no tomas medicación ni sigues ningún otro tratamiento.",
      },
      {
        id: "c1b",
        texto:
          "¿Tienes problemas articulares que te causan dolor, una fractura reciente o una fractura causada por osteoporosis o cáncer, una vértebra desplazada (por ejemplo, espondilolistesis) o espondilólisis (una fisura en el anillo óseo de la parte de atrás de la columna)?",
      },
      {
        id: "c1c",
        texto: "¿Te han puesto inyecciones de corticoides o has tomado corticoides en pastillas de forma regular durante más de 3 meses?",
      },
    ],
  },
  {
    id: "c2",
    texto: "¿Tienes ahora algún tipo de cáncer?",
    subpreguntas: [
      {
        id: "c2a",
        texto:
          "¿Tu diagnóstico incluye alguno de estos tipos: pulmón o broncogénico, mieloma múltiple (cáncer de las células plasmáticas), cabeza o cuello?",
      },
      {
        id: "c2b",
        texto: "¿Estás recibiendo ahora tratamiento contra el cáncer (como quimioterapia o radioterapia)?",
      },
    ],
  },
  {
    id: "c3",
    texto: "¿Tienes alguna enfermedad del corazón o cardiovascular?",
    pista: "Incluye enfermedad de las arterias coronarias, insuficiencia cardiaca y alteraciones del ritmo cardiaco diagnosticadas.",
    subpreguntas: [
      {
        id: "c3a",
        texto:
          "¿Te cuesta controlar tu condición con medicación u otros tratamientos indicados por tu médico?",
        pista: "Responde «no» si ahora no tomas medicación ni sigues ningún otro tratamiento.",
      },
      {
        id: "c3b",
        texto:
          "¿Tienes un latido irregular que necesita control médico (por ejemplo, fibrilación auricular o extrasístoles ventriculares)?",
      },
      { id: "c3c", texto: "¿Tienes insuficiencia cardiaca crónica?" },
      {
        id: "c3d",
        texto:
          "¿Tienes una enfermedad coronaria (cardiovascular) diagnosticada y no has hecho actividad física regular en los últimos 2 meses?",
      },
    ],
  },
  {
    id: "c4",
    texto: "¿Tienes ahora la tensión alta?",
    subpreguntas: [
      {
        id: "c4a",
        texto:
          "¿Te cuesta controlar tu condición con medicación u otros tratamientos indicados por tu médico?",
        pista: "Responde «no» si ahora no tomas medicación ni sigues ningún otro tratamiento.",
      },
      {
        id: "c4b",
        texto: "¿Tienes una tensión en reposo igual o superior a 160/90 mmHg, con o sin medicación?",
        pista: "Responde «sí» si no sabes cuál es tu tensión en reposo.",
      },
    ],
  },
  {
    id: "c5",
    texto: "¿Tienes alguna enfermedad metabólica?",
    pista: "Incluye diabetes tipo 1, diabetes tipo 2 y prediabetes.",
    subpreguntas: [
      {
        id: "c5a",
        texto:
          "¿Te cuesta a menudo controlar el azúcar en sangre con la alimentación, la medicación u otros tratamientos indicados por tu médico?",
      },
      {
        id: "c5b",
        texto:
          "¿Sueles tener signos o síntomas de bajada de azúcar (hipoglucemia) después del ejercicio o durante tus actividades diarias?",
        pista:
          "Pueden ser temblores, nerviosismo, irritabilidad poco habitual, sudor anormal, mareo o sensación de cabeza ligera, confusión, dificultad para hablar, debilidad o somnolencia.",
      },
      {
        id: "c5c",
        texto:
          "¿Tienes signos o síntomas de complicaciones de la diabetes, como enfermedad del corazón o de los vasos sanguíneos, o complicaciones que afectan a los ojos, los riñones o la sensibilidad de los dedos y los pies?",
      },
      {
        id: "c5d",
        texto:
          "¿Tienes otras enfermedades metabólicas (como diabetes del embarazo en este momento, enfermedad renal crónica o problemas de hígado)?",
      },
      {
        id: "c5e",
        texto: "¿Tienes pensado hacer pronto un ejercicio de una intensidad alta (o vigorosa) poco habitual para ti?",
      },
    ],
  },
  {
    id: "c6",
    texto: "¿Tienes algún problema de salud mental o alguna dificultad de aprendizaje?",
    pista:
      "Incluye alzhéimer, demencia, depresión, trastorno de ansiedad, trastorno de la conducta alimentaria, trastorno psicótico, discapacidad intelectual y síndrome de Down.",
    subpreguntas: [
      {
        id: "c6a",
        texto:
          "¿Te cuesta controlar tu condición con medicación u otros tratamientos indicados por tu médico?",
        pista: "Responde «no» si ahora no tomas medicación ni sigues ningún otro tratamiento.",
      },
      {
        id: "c6b",
        texto: "¿Tienes síndrome de Down y además problemas de espalda que afectan a nervios o músculos?",
      },
    ],
  },
  {
    id: "c7",
    texto: "¿Tienes alguna enfermedad respiratoria?",
    pista: "Incluye enfermedad pulmonar obstructiva crónica (EPOC), asma e hipertensión pulmonar.",
    subpreguntas: [
      {
        id: "c7a",
        texto:
          "¿Te cuesta controlar tu condición con medicación u otros tratamientos indicados por tu médico?",
        pista: "Responde «no» si ahora no tomas medicación ni sigues ningún otro tratamiento.",
      },
      {
        id: "c7b",
        texto:
          "¿Alguna vez un médico te ha dicho que tu nivel de oxígeno en sangre es bajo en reposo o durante el ejercicio, o que necesitas oxígeno?",
      },
      {
        id: "c7c",
        texto:
          "Si tienes asma: ¿tienes ahora síntomas de opresión en el pecho, pitidos al respirar, dificultad para respirar, tos persistente (más de 2 días a la semana), o has usado tu medicación de rescate más de dos veces la última semana?",
        pista: "Si no tienes asma, responde «no».",
      },
      {
        id: "c7d",
        texto: "¿Alguna vez un médico te ha dicho que tienes la tensión alta en los vasos sanguíneos de los pulmones?",
      },
    ],
  },
  {
    id: "c8",
    texto: "¿Tienes una lesión de médula espinal?",
    pista: "Incluye tetraplejia y paraplejia.",
    subpreguntas: [
      {
        id: "c8a",
        texto:
          "¿Te cuesta controlar tu condición con medicación u otros tratamientos indicados por tu médico?",
        pista: "Responde «no» si ahora no tomas medicación ni sigues ningún otro tratamiento.",
      },
      {
        id: "c8b",
        texto:
          "¿Sueles tener la tensión en reposo tan baja que te produce mareos, sensación de cabeza ligera o desmayos?",
      },
      {
        id: "c8c",
        texto:
          "¿Tu médico te ha dicho que tienes subidas bruscas de tensión (lo que se llama disreflexia autonómica)?",
      },
    ],
  },
  {
    id: "c9",
    texto: "¿Has tenido un ictus?",
    pista: "Incluye accidente isquémico transitorio (AIT) o accidente cerebrovascular.",
    subpreguntas: [
      {
        id: "c9a",
        texto:
          "¿Te cuesta controlar tu condición con medicación u otros tratamientos indicados por tu médico?",
        pista: "Responde «no» si ahora no tomas medicación ni sigues ningún otro tratamiento.",
      },
      { id: "c9b", texto: "¿Tienes alguna dificultad para caminar o para moverte?" },
      {
        id: "c9c",
        texto: "¿Has tenido un ictus o una alteración de nervios o músculos en los últimos 6 meses?",
      },
    ],
  },
  {
    id: "c10",
    texto:
      "¿Tienes alguna otra enfermedad que no aparezca arriba, o tienes dos o más enfermedades?",
    subpreguntas: [
      {
        id: "c10a",
        texto:
          "¿Has tenido un desmayo o has perdido el conocimiento por un golpe en la cabeza en los últimos 12 meses, o te han diagnosticado una conmoción cerebral en los últimos 12 meses?",
      },
      {
        id: "c10b",
        texto:
          "¿Tienes una enfermedad que no aparece en la lista (como epilepsia, enfermedades neurológicas o problemas de riñón)?",
      },
      { id: "c10c", texto: "¿Vives ahora con dos o más enfermedades?" },
    ],
  },
];

// Lo que el PAR-Q+ dice en los tres casos posibles, y el aviso de «espera
// antes de ponerte más activo», que acompaña a los tres.
export const RESULTADOS = {
  // Todo «no» en la página 1.
  apto: {
    titulo: "Puedes hacer actividad física",
    parrafos: [
      "Empieza a ser mucho más activo: arranca despacio y ve subiendo poco a poco.",
      "Sigue las recomendaciones internacionales de actividad física para tu edad.",
      "Alain Zulaika puede hacerte una valoración de salud y condición física.",
      "Si tienes más de 45 años y no estás acostumbrado a hacer ejercicio vigoroso o de esfuerzo máximo con regularidad, consúltalo con Alain antes de hacer ejercicio a esa intensidad.",
      "Si tienes cualquier otra duda, pregúntale a Alain.",
    ],
  },
  // Algún «sí» en la página 1, pero todo «no» en el seguimiento.
  aptoTrasSeguimiento: {
    titulo: "Estás listo para ser más activo",
    parrafos: [
      "Alain Zulaika puede hacerte una valoración y preparar contigo un plan de actividad física seguro y eficaz, adaptado a tu salud.",
      "Empieza despacio y ve subiendo poco a poco: de 20 a 60 minutos de ejercicio de intensidad baja a moderada, de 3 a 5 días por semana, con ejercicio aeróbico y de fuerza.",
      "A medida que avances, el objetivo es sumar 150 minutos o más de actividad física de intensidad moderada a la semana.",
      "Si tienes más de 45 años y no estás acostumbrado a hacer ejercicio vigoroso o de esfuerzo máximo con regularidad, consúltalo con Alain antes de hacer ejercicio a esa intensidad.",
    ],
  },
  // Algún «sí» en el seguimiento.
  consultar: {
    titulo: "Busca más información antes de ser más activo",
    parrafos: [
      "Antes de aumentar tu actividad física, conviene que busques más información.",
    ],
  },
  esperaTitulo: "Espera antes de ponerte más activo si…",
  espera: [
    "Tienes una enfermedad pasajera, como un resfriado o fiebre: espera a encontrarte mejor.",
    "Estás embarazada: habla con tu médico o tu matrona antes de ser más activa.",
    "Tu salud cambia: vuelve a hacer este cuestionario y/o habla con tu médico o con Alain antes de seguir con cualquier programa de actividad física.",
  ],
} as const;

export type ResultadoParq = "apto" | "aptoTrasSeguimiento" | "consultar";

// Cómo se nombra cada resultado en el aviso y en la fila de Supabase.
export const RESULTADO_ETIQUETA: Record<ResultadoParq, string> = {
  apto: "APTO (todo «no»)",
  aptoTrasSeguimiento: "APTO TRAS SEGUIMIENTO",
  consultar: "CONSULTAR ANTES",
};

export type Respuesta = "si" | "no";

// La regla del PAR-Q+: todo «no» en la página 1 → apto. Algún «sí» → se
// pasa al seguimiento, y ahí solo cuentan las subpreguntas: tener la
// condición con todas sus subpreguntas en «no» no cambia el resultado.
export function calcularResultado(r: Record<string, Respuesta | undefined>): ResultadoParq {
  if (!PREGUNTAS_GENERALES.some((p) => r[p.id] === "si")) return "apto";
  const algunSi = CONDICIONES.some(
    (c) => r[c.id] === "si" && c.subpreguntas.some((s) => r[s.id] === "si")
  );
  return algunSi ? "consultar" : "aptoTrasSeguimiento";
}

// Los ids que se le preguntaron de verdad, en orden: las generales siempre;
// el seguimiento solo con algún «sí» en ellas; las subpreguntas solo de las
// condiciones a las que dijo «sí». El endpoint lo usa para exigir que estén
// todas respondidas y para descartar cualquier otra cosa que llegue.
export function preguntasAplicables(r: Record<string, Respuesta | undefined>): PreguntaParq[] {
  const lista: PreguntaParq[] = [...PREGUNTAS_GENERALES];
  if (!PREGUNTAS_GENERALES.some((p) => r[p.id] === "si")) return lista;
  for (const c of CONDICIONES) {
    lista.push(c);
    if (r[c.id] === "si") lista.push(...c.subpreguntas);
  }
  return lista;
}
