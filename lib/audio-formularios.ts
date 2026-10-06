// Preguntas, opciones y casilla de consentimiento del formulario de
// /audio (entrenatzaile.alainzulaika.com/audio).
//
// Viven aquí, en el servidor, por el mismo motivo que las de /espalda: la
// página las renderiza desde este módulo y el endpoint las graba desde este
// mismo módulo, así que lo que queda escrito es exactamente lo que se mostró.
// El navegador solo manda la opción elegida, nunca el texto de la pregunta.
//
// Al cambiar cualquiera de estos textos, sube CONSENT_AUDIO_VERSION: las
// filas antiguas conservan su texto y su versión, que es lo que hace falta
// para poder demostrar qué aceptó cada persona y cuándo.

export const CONSENT_AUDIO_VERSION = "2026-10-06";

export const RANGOS_EDAD = ["Menos de 45", "45-54", "55-64", "65 o más"] as const;

export const FRECUENCIA_LUMBAGO = [
  "Es el primero",
  "Una o dos veces al año",
  "Tres o más al año",
  "Tengo molestia casi siempre",
] as const;

// Banderas rojas. El orden importa: "Ninguna" va última y es excluyente —
// marcarla desmarca el resto, y marcar cualquier otra la desmarca a ella.
export const BANDERA_NINGUNA = "Ninguna";

export const BANDERAS_ROJAS = [
  "Dolor que baja por debajo de la rodilla con hormigueo o pérdida de fuerza",
  "Dificultad para controlar la orina o las heces",
  "Fiebre o pérdida de peso sin explicación",
  "Dolor que no cede con ninguna postura o te despierta por la noche",
  BANDERA_NINGUNA,
] as const;

export const EJERCICIO_ACTUAL = ["Nada", "Camino", "Gimnasio o fuerza", "Otro deporte"] as const;

// Quien no hace nada no tiene días que contar: en esa opción no se le
// pregunta, y la columna se queda vacía.
export const EJERCICIO_SIN_DIAS = "Nada";
export const EJERCICIO_OTRO = "Otro deporte";

export const DIAS_SEMANA = ["1", "2", "3", "4", "5", "6", "7"] as const;

export const TIEMPO_SEMANAL = [
  "Menos de una hora",
  "1-2 horas",
  "2-4 horas",
  "Más de 4 horas",
] as const;

// Los enunciados, tal y como se ven en la página. El aviso que me llega los
// usa como etiqueta de cada fila, y la columna preguntas_mostradas los
// congela en la fila del formulario.
export const PREGUNTAS_AUDIO = {
  nombre: "Nombre",
  email: "Correo electrónico",
  telefono: "WhatsApp",
  edad: "Edad",
  frecuencia: "¿Cada cuánto te da el lumbago?",
  ultimo: "¿Cuándo fue el último y qué estabas haciendo?",
  banderas: "¿Tienes alguna de estas?",
  ejercicio: "¿Haces ejercicio ahora mismo?",
  dias: "¿Cuántos días a la semana?",
  tiempo: "¿Cuánto tiempo real tienes a la semana para esto?",
  deseo: "¿Qué te gustaría poder hacer sin miedo a que te vuelva a dar?",
  extra: "¿Algo más que deba saber?",
} as const;

// Aclaración pequeña bajo cada enunciado. Es copy de la página, pero vive
// junto a las preguntas para que no se separen por accidente.
export const PISTAS_AUDIO = {
  nombre: "Para saber cómo llamarte en el audio.",
  email: "Por si no consigo localizarte por WhatsApp.",
  telefono: "Aquí te mando el audio. Lo grabo yo, para ti, uno a uno.",
  ultimo: "Dos líneas valen. «Hace tres semanas, levantando una caja del maletero» ya me dice mucho.",
  banderas: "Marca todas las que te pasen. Si no te pasa ninguna, marca «Ninguna».",
  dias: "Días que de verdad lo haces en una semana normal, no los que te gustaría.",
  tiempo: "El tiempo que tienes, no el que te gustaría tener. Si me dices de más, te recomendaré algo que no te cabe en la vida.",
  deseo: "Lo primero que se te venga a la cabeza. Coger a un nieto, volver a correr, dormir del tirón, agacharte sin pensarlo.",
  extra: "Operaciones, diagnósticos, medicación, lo que sea. Opcional.",
} as const;

export const CONSENT_AUDIO = {
  datos:
    "Acepto que Alain Zulaika trate las respuestas de este formulario —incluida la información sobre mi espalda y mi salud— con la única finalidad de preparar el audio y enviármelo por WhatsApp o por correo. Sé que puedo retirar este consentimiento escribiendo a contacto@alainzulaika.com.",
} as const;

// Aviso en pantalla cuando alguien marca una bandera roja. No le cierra el
// formulario ni le impide enviarlo: le dice ya, antes de esperar el audio, lo
// que el audio le va a decir.
export const AVISO_BANDERA_ROJA =
  "Con eso marcado, lo primero no es entrenar: es que te vea un médico. Te mando el audio igual, pero te va a decir exactamente esto.";

export const AUDIO_TEXTOS = {
  titulo: "Cuéntame tu espalda y te mando el audio",
  intro: [
    "Son ocho preguntas y se tarda tres o cuatro minutos.",
    "Con lo que escribas aquí grabo un audio para ti —no una plantilla— y te lo mando por WhatsApp en un máximo de 72 horas.",
  ],
  privacidad: "Política de privacidad",
  boton: "Enviar y recibir el audio",
  enviando: "Enviando…",
  siguiente: "Siguiente →",
  volver: "← volver",
  graciasTitulo: "Recibido.",
  graciasParrafos: [
    "Ya lo tengo. Lo leo entero antes de grabar nada.",
    "El audio te llega por WhatsApp al número que me has dejado, en cuanto pueda y como máximo en 72 horas.",
    "Si mientras tanto te acuerdas de algo que se te ha quedado fuera, respóndeme al correo de confirmación que acabas de recibir.",
  ],
} as const;

// ¿Hay bandera roja? Cualquier casilla marcada que no sea "Ninguna". Vive
// aquí para que la página y el endpoint decidan con la misma regla.
export function tieneBanderaRoja(banderas: readonly string[]): boolean {
  return banderas.some((b) => b !== BANDERA_NINGUNA);
}
