// Preguntas, opciones, casillas y contador de plazas del formulario de
// solicitud de acompañamiento (entrenatzaile.alainzulaika.com/acompanamiento).
//
// Mismo criterio que /audio: la página renderiza desde este módulo y el
// endpoint graba desde este mismo módulo, así que lo que queda escrito es
// exactamente lo que se mostró. El navegador solo manda la opción elegida.
//
// Al cambiar el texto de una pregunta o de una casilla, sube
// CONSENT_ACOMPANAMIENTO_VERSION: las filas antiguas conservan su texto y su
// versión, que es lo que hace falta para poder demostrar qué aceptó cada
// persona y cuándo.
//
// Aquí no hay precio ni duración a propósito: los dos van en el presupuesto
// que le mando por WhatsApp, y el formulario solo sirve para que pueda
// escribirle.

export const CONSENT_ACOMPANAMIENTO_VERSION = "2026-10-20";

export const RANGOS_EDAD = ["Menos de 45", "45-54", "55-64", "65 o más"] as const;

// "Otro" abre un campo de texto. Se pueden marcar varias.
export const FRENO_OTRO = "Otro";

export const FRENOS = [
  "No sé por dónde empezar",
  "No consigo ser constante",
  "Miedo a hacerme daño",
  "Falta de tiempo",
  FRENO_OTRO,
] as const;

export const ACTIVIDAD_ACTUAL = ["Nada", "Camino", "Gimnasio o fuerza", "Otro deporte"] as const;

// Quien no hace nada no tiene días que contar: en esa opción no se le
// pregunta, y la columna se queda vacía.
export const ACTIVIDAD_SIN_DIAS = "Nada";

export const DIAS_SEMANA = ["1", "2", "3", "4 o más"] as const;

export const LUGARES = ["En casa", "En el gimnasio", "Aún no lo sé"] as const;

// Los enunciados, tal y como se ven en la página. El aviso que me llega los
// usa como etiqueta de cada fila, y la columna preguntas_mostradas los
// congela en la fila de la solicitud.
export const PREGUNTAS_ACOMPANAMIENTO = {
  nombre: "Nombre",
  email: "Email",
  telefono: "Teléfono (WhatsApp)",
  edad: "Edad",
  objetivo: "¿Qué te gustaría volver a poder hacer, o conseguir, en los próximos meses?",
  frenos: "¿Qué te ha frenado hasta ahora?",
  actividad: "¿Qué haces ahora mismo?",
  dias: "¿Cuántos días por semana?",
  salud: "¿Tienes alguna lesión, dolor o diagnóstico que deba conocer?",
  lugar: "¿Dónde entrenarías?",
} as const;

export const PISTAS_ACOMPANAMIENTO = {
  frenos: "Marca todas las que te pasen.",
  salud: "Opcional.",
} as const;

// Las dos casillas son obligatorias y van sin premarcar. La primera es la
// base del art. 9 para tratar lo que cuente de su salud; la segunda, la del
// canal por el que le voy a escribir.
export const CONSENT_ACOMPANAMIENTO = {
  datos:
    "Acepto que Alain Zulaika (Entrenatzaile) use estos datos, incluidos los de salud, solo para valorar mi caso y contactarme.",
  whatsapp: "Acepto que me escriba por WhatsApp al teléfono indicado.",
} as const;

// Lista de espera, cuando no quedan plazas. Una sola casilla, también
// obligatoria: el email es para eso y para nada más.
export const CONSENT_AVISO_PLAZAS =
  "Acepto que Alain Zulaika (Entrenatzaile) me escriba a este correo solo para avisarme cuando abra nuevas plazas.";

export const ACOMPANAMIENTO_TEXTOS = {
  titulo: "Dos plazas para empezar en noviembre",
  intro: [
    "Cuéntame dónde estás y qué te gustaría conseguir. Son unos tres minutos.",
  ],
  comoFuncionaTitulo: "Cómo funciona",
  comoFunciona: [
    "Rellenas el formulario (unos tres minutos).",
    "Te escribo por WhatsApp en menos de 48 horas.",
    "Si puedo ayudarte, te mando un presupuesto por escrito con todo explicado. Si no, te lo digo y, si puedo, te digo a quién acudir.",
  ],
  privacidad: "Política de privacidad",
  boton: "Quiero una de las plazas",
  enviando: "Enviando…",
  graciasTitulo: "Recibido.",
  graciasParrafos: [
    "Te escribo por WhatsApp en menos de 48 horas. Si con lo que me has contado tengo suficiente, te mando el presupuesto. Si necesito saber algo más, te lo pregunto por ahí.",
    "Si no ves mi mensaje, mira también el correo.",
  ],
  // Con el contador a 0.
  cubiertasTitulo: "Plazas de noviembre cubiertas",
  cubiertasIntro: [
    "Las plazas de noviembre ya tienen dueño.",
    "Déjame tu email y te aviso en cuanto abra las siguientes.",
  ],
  avisoBoton: "Avisarme",
  avisoGraciasTitulo: "Apuntado.",
  avisoGraciasParrafo: "Te escribo a ese correo en cuanto haya plazas nuevas. Solo para eso.",
} as const;
