// Textos literales de las preguntas y de las casillas de consentimiento de
// las landings de Tirada 02.
//
// Viven aquí, en el servidor, y no en el navegador: la página los renderiza
// desde este módulo y el endpoint los graba desde este mismo módulo. Así, lo
// que queda escrito en Supabase es exactamente lo que la persona leyó, sin
// fiarse de lo que mande el cliente (que podría enviar cualquier cosa). El
// navegador solo manda los booleanos.
//
// Al cambiar cualquiera de estos textos, sube CONSENT_VERSION: las filas
// antiguas conservan su texto y su versión, que es justo lo que hace falta
// para poder demostrar qué aceptó cada persona y cuándo.

export const CONSENT_VERSION = "2026-08-24";

// Título de la ficha que se entrega en /espalda.
//
// Vive aquí, en un único sitio, porque se usa en tres: el hero de la landing,
// la frase de antes del formulario y el nombre del archivo que se descarga.
// Si cambia el documento, se cambia esta línea y ya.
export const FICHA_ESPALDA_TITULO = "Por qué tu espalda siempre vuelve a fallar";

export const PREGUNTAS_ESPALDA = [
  "¿Cuántas veces has tenido un lumbago o un tirón en la espalda?",
  "¿Qué has probado ya y por qué crees que no ha terminado de funcionar?",
  "¿Qué es lo que más te preocupa que llegue a pasarte con la espalda?",
] as const;

// Aclaración bajo cada pregunta. Es copy de la landing, pero vive junto a
// las preguntas para que no se separen por accidente.
export const PISTAS_ESPALDA = [
  "Un número aproximado vale. «Cuatro o cinco» es una respuesta.",
  "Tratamientos, ejercicios, reposo, aparatos, lo que sea. Si nunca has tenido un episodio y entras por alguien cercano, escríbelo aquí y ya está.",
  "No hay respuesta correcta. Lo primero que se te venga a la cabeza.",
] as const;

export const GENEROS = ["Hombre", "Mujer", "Prefiero no decirlo"] as const;

export const CONSENT_ESPALDA = {
  datos: "Acepto que Alain Zulaika trate mis respuestas sobre mi historial de espalda para conocer mi caso y adaptar el contenido que me envía.",
  whatsapp: "Y también puede escribirme si tiene algo que crea que me sirve.",
} as const;

// El alta en la newsletter no tiene casilla propia en esta landing: va
// declarada en el cuerpo de la página, como contraprestación por la ficha.
// Guardamos esa frase literal en la fila del lead igual que si fuera una
// casilla, porque es el texto que se le mostró y con el que aceptó.
export const DECLARACION_NEWSLETTER_ESPALDA =
  "Declarado en la página, sin casilla: «La ha escrito Alain Zulaika, entrenador titulado especializado en personas de 45 a 65 años. Te llega por correo, y a partir de ahí llega también un correo diario sobre esto mismo. Te puedes dar de baja con un clic cuando quieras.»";

export const CONSENT_HOJA_RUTA = {
  // Una sola casilla, como pide el formulario de reserva. Cubre tres cosas y
  // las tres se nombran de forma expresa: el tratamiento de los datos de
  // salud de la llamada (art. 9.2.a), la gestión de la reserva y el alta en
  // la newsletter. Esa última línea es la que sostiene que la reserva también
  // sea puerta de entrada a la secuencia de mails: sin nombrarla, meter a
  // alguien en la newsletter desde aquí sería un consentimiento que nadie ha
  // dado.
  datos:
    "He leído y acepto la política de privacidad, y doy mi consentimiento explícito para que Alain Zulaika trate mis datos —incluida la información sobre mi estado físico y de salud que comparta en la llamada— con el fin de gestionar esta reserva y prestarme el servicio (art. 9.2.a RGPD). Acepto también darme de alta en su newsletter diaria, de la que puedo darme de baja en un clic desde cualquier email.",
} as const;

// Días que dura la ventana de acceso gratuito desde el alta del contacto.
export const VENTANA_DIAS = 8;

export type Elegibilidad = "elegible" | "fuera_ventana" | "no_en_lista";

// Cómo se nombra cada estado en el aviso que le llega a Alain. Está escrito
// en dinero y no en jerga ("GRATIS" en vez de "ELEGIBLE") porque lo que hay
// que decidir al leer el asunto es si esa persona paga o no.
//
// Ojo: esto dice lo que le CORRESPONDE según la lista, no lo que se le
// prometió en la página. El ?ventana=1 es un parámetro de URL, así que
// alguien puede haber visto la versión gratuita y salir aquí como NO GRATIS.
// Por eso el cuerpo del aviso lleva además la fila "Vio la versión".
export const ELEGIBILIDAD_ETIQUETA: Record<Elegibilidad, string> = {
  elegible: "GRATIS",
  fuera_ventana: "NO GRATIS (fuera de secuencia)",
  no_en_lista: "NO EN LA LISTA",
};

// Parámetros de origen que sí pueden viajar por la URL. Las respuestas del
// formulario nunca: ni en query string, ni en el hash, ni en parámetros de
// eventos de tracking.
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>> & { referrer?: string };

// Mensaje de error para el lead. Si el servidor ha explicado el motivo (un
// campo mal, un hueco ocupado…), se muestra tal cual. Si no lo ha explicado
// —un 500, una caída, una respuesta que ni siquiera es JSON—, no se le
// suelta un "algo ha ido mal" a secas: se le dice que el fallo es nuestro,
// se le da el código para que pueda decírnoslo, y una salida por email.
export function mensajeErrorFormulario(status: number, error?: unknown): string {
  if (typeof error === "string" && error.trim()) return error;
  if (status === 0) {
    return "No he podido conectar. Comprueba tu conexión y vuelve a intentarlo; si sigue igual, escríbeme a contacto@alainzulaika.com.";
  }
  return `Ha fallado algo de mi lado (error ${status}), no tienes tú la culpa. Inténtalo otra vez en un momento y, si sigue igual, escríbeme a contacto@alainzulaika.com y lo resuelvo yo.`;
}

export function limpiarUtm(raw: unknown): Utm {
  const out: Utm = {};
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  for (const k of UTM_KEYS) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 200);
  }
  if (typeof obj.referrer === "string" && obj.referrer.trim()) out.referrer = obj.referrer.trim().slice(0, 500);
  return out;
}
