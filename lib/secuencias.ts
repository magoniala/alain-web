// Catálogo de las secuencias y correos automáticos: nombres, etiquetas,
// idiomas y marcadores disponibles.
//
// Vive SEPARADO de lib/secuencia-mails.ts a propósito. Ese otro módulo crea
// un cliente de Supabase con la clave de servicio nada más cargarse, así que
// no se puede importar desde un componente de cliente: en el navegador la
// clave no existe, createClient revienta y tumba la página entera. Aquí solo
// hay constantes, así que lo puede usar tanto el servidor como el panel.

/** Secuencias que viven en la tabla secuencia_mails. */
export const SECUENCIAS = [
  "nurture",
  "comodin",
  "mision",
  "contacto",
  "belaustegi",
  "valoracion",
  "arrogante",
  "comodin_show",
  "guias",
  "entrenatzaile_valoracion",
  "hoja_ruta_abandono",
  "tumision",
] as const;
export type Secuencia = (typeof SECUENCIAS)[number];

export const SECUENCIA_ETIQUETA: Record<Secuencia, string> = {
  nurture: "Nurture (leads de ads)",
  comodin: "Comodín",
  mision: "Tu misión",
  contacto: "Contacto",
  belaustegi: "Belaustegi",
  valoracion: "Valoración de evento",
  arrogante: "Arrogante",
  comodin_show: "Comodín · enlace al show",
  guias: "Guías gratuitas",
  entrenatzaile_valoracion: "Entrenatzaile · valoración",
  hoja_ruta_abandono: "Hoja de Ruta · reserva a medias",
  tumision: "Tumisión · 9 días (nueva)",
};

/** Secuencias con contenido en los dos idiomas. Nurture solo va en castellano. */
export const SECUENCIAS_BILINGUES: Secuencia[] = [
  "comodin",
  "mision",
  "contacto",
  "belaustegi",
  "valoracion",
  "entrenatzaile_valoracion",
  "tumision",
];

/**
 * Secuencias en las que se pueden añadir mails al final desde el panel, y en
 * qué posición empieza cada una (nurture arranca en el M0; tumisión, como la
 * vieja de mision, en el mail 1).
 */
export const PRIMERA_POSICION: Partial<Record<Secuencia, number>> = {
  nurture: 0,
  tumision: 1,
};

/**
 * Cuándo sale un mail de cada secuencia, para la ficha del editor. Lo que no
 * esté aquí usa la descripción de nurture.
 */
export function cuandoSale(secuencia: Secuencia, posicion: number): string | null {
  if (secuencia === "tumision") {
    return posicion <= 1
      ? "Al instante, en cuanto se apunta desde la tarjeta."
      : "A las 21:00 (hora de Madrid), un día después del anterior.";
  }
  if (secuencia === "mision" || secuencia === "comodin") {
    if (posicion <= 1) return "Al instante, en cuanto se apunta desde la tarjeta.";
    if (posicion === 2) return "48 horas después del alta.";
    if (secuencia === "comodin" && posicion === 3) return "96 horas después del alta.";
    return "No se envía: la secuencia termina en el mail anterior.";
  }
  return null;
}

/**
 * Aviso bajo el título de cada secuencia en el editor: qué pasa si un mail
 * está inactivo o vacío. No es igual en todas, y conviene decirlo tal cual.
 */
export function avisoSecuencia(secuencia: Secuencia): string {
  if (secuencia === "tumision") {
    return "Esta secuencia todavía no se envía a nadie: se activará el 18 de noviembre. Puedes escribir los mails y mandarte pruebas. Durante los 9 días la familia no recibe la newsletter diaria; al terminar, pasa a recibirla.";
  }
  if (secuencia === "nurture") {
    return "Los cambios afectan solo a los mails que aún no se han enviado. Un mail inactivo o vacío detiene la secuencia: quien esté en esa posición se queda parado ahí hasta que lo actives.";
  }
  return "Los cambios afectan solo a los mails que aún no se han enviado. Ojo: si desactivas un mail aquí, sale igual la versión guardada en el código. Para que deje de enviarse hay que pedirlo (se arreglará en noviembre).";
}

// Valores de mentira para la previsualización y el "Enviar prueba".
//
// El nombre y las fechas los pone marcadoresDeMuestra(); aquí van los que son
// propios de cada secuencia. Sin esto, previsualizar un correo de Comodín
// enseñaba "{{tutorial}}" y la prueba llegaba al buzón con el marcador en
// crudo, que es justo lo que la prueba tenía que servir para detectar.
//
// Las URLs son reconocibles a simple vista (/ejemplo/…) para que nadie las
// confunda con las de verdad si le da por pinchar en la prueba.
export const VALORES_DE_MUESTRA: Partial<Record<Secuencia, Record<string, string>>> = {
  nurture: {},
  hoja_ruta_abandono: {
    hoja_ruta: "https://entrenatzaile.alainzulaika.com/hoja-de-ruta?ejemplo=1",
  },
  comodin: {
    tutorial: "https://alainzulaika.com/ejemplo/tutorial",
    cambiar_idioma: "https://alainzulaika.com/ejemplo/idioma",
    contacto: "https://alainzulaika.com/ejemplo/contacto",
    entrenamiento: "mailto:contacto@alainzulaika.com?subject=Entrenamiento",
  },
  // Los mismos cuatro que Comodín: las dos secuencias comparten marcadores.
  mision: {
    tutorial: "https://alainzulaika.com/ejemplo/tutorial",
    cambiar_idioma: "https://alainzulaika.com/ejemplo/idioma",
    contacto: "https://alainzulaika.com/ejemplo/contacto",
    entrenamiento: "mailto:contacto@alainzulaika.com?subject=Entrenamiento",
  },
  // La nueva de tumisión, de momento con los mismos marcadores que mision.
  tumision: {
    tutorial: "https://alainzulaika.com/ejemplo/tutorial",
    cambiar_idioma: "https://alainzulaika.com/ejemplo/idioma",
    contacto: "https://alainzulaika.com/ejemplo/contacto",
    entrenamiento: "mailto:contacto@alainzulaika.com?subject=Entrenamiento",
  },
  comodin_show: { show: "https://alainzulaika.com/ejemplo/show" },
  arrogante: { tiktok: "https://alainzulaika.com/ejemplo/tiktok" },
  guias: {
    guias: "la guía de la espalda y la de las rodillas",
    sorpresa: "Y te meto una tercera de regalo, que no esperabas.",
    extra_asunto: " (+1 de regalo)",
  },
  entrenatzaile_valoracion: {
    cambiar_idioma: "https://alainzulaika.com/ejemplo/idioma",
    contacto: "https://alainzulaika.com/ejemplo/contacto",
  },
};

// Los bloques {{#si_...}} se previsualizan por su rama "sí": es la que tiene
// contenido, y ver el correo sin ella no diría nada. La otra se comprueba
// cambiando esto a mano, pero lo importante es que la prueba NO llegue con
// los {{#si_ventana}} a la vista.
export const CONDICIONES_DE_MUESTRA: Record<string, boolean> = {
  si_ventana: true,
  si_no_ventana: false,
};

// Marcadores que puede usar cada secuencia en el cuerpo. Se le enseñan a
// Alain en el editor, para que sepa qué puede escribir sin adivinarlo.
export const MARCADORES: Partial<Record<Secuencia, Array<{ clave: string; descripcion: string }>>> = {
  nurture: [
    { clave: "nombre", descripcion: "Nombre de pila del lead (vacío si no lo dio)" },
    { clave: "saludo", descripcion: '"Hola, Ane" o "Hola" a secas si no dio nombre' },
    {
      clave: "#si_ventana}} … {{/si_ventana",
      descripcion:
        "Todo lo que pongas entre esas dos marcas SOLO lo lee quien aún tiene la Hoja de Ruta gratis. A quien ya se le pasó, desaparece. Úsalo para los párrafos que prometen el regalo. Existe también {{#si_no_ventana}} … {{/si_no_ventana}} para lo contrario.",
    },
    {
      clave: "fin_ventana",
      descripcion:
        'El último día que ESA persona tiene la Hoja de Ruta gratis: "domingo 6 de septiembre". Para hablar de la ventana, usa este y no fecha_7: sale de su fecha de alta, así que dice lo mismo que la landing aunque el correo salga con retraso.',
    },
    { clave: "fecha_7", descripcion: 'Hoy + 7 días: "domingo 6 de septiembre". Vale cualquier número de 0 a 30: fecha_3, fecha_14…' },
    { clave: "fecha_corta_7", descripcion: 'Lo mismo sin el día de la semana: "6 de septiembre"' },
  ],
  comodin: [
    { clave: "tutorial", descripcion: "Enlace al tutorial del truco" },
    { clave: "cambiar_idioma", descripcion: "Enlace para recibirlos en el otro idioma" },
    { clave: "contacto", descripcion: "Página de contacto" },
    { clave: "entrenamiento", descripcion: "Mailto preguntando por entrenamiento" },
  ],
  mision: [
    { clave: "tutorial", descripcion: "Enlace al tutorial del truco" },
    { clave: "cambiar_idioma", descripcion: "Enlace para recibirlos en el otro idioma" },
    { clave: "contacto", descripcion: "Página de contacto" },
    { clave: "entrenamiento", descripcion: "Mailto preguntando por entrenamiento" },
  ],
  tumision: [
    { clave: "tutorial", descripcion: "Enlace al tutorial del truco del vaso" },
    { clave: "cambiar_idioma", descripcion: "Enlace para recibirlos en el otro idioma" },
    { clave: "contacto", descripcion: "Página de contacto" },
    { clave: "entrenamiento", descripcion: "Mailto preguntando por entrenamiento" },
  ],
  contacto: [{ clave: "nombre", descripcion: "Nombre de quien escribe" }],
  belaustegi: [{ clave: "nombre", descripcion: "Nombre de quien escribe" }],
  valoracion: [{ clave: "nombre", descripcion: "Nombre de quien valora" }],
  arrogante: [{ clave: "tiktok", descripcion: "Enlace al TikTok" }],
  comodin_show: [{ clave: "show", descripcion: "Enlace al show completo" }],
  guias: [
    { clave: "nombre", descripcion: "Nombre de pila" },
    { clave: "guias", descripcion: "Lista de las guías que se adjuntan" },
    { clave: "sorpresa", descripcion: "Párrafo de la guía de regalo (vacío si no hay)" },
    { clave: "extra_asunto", descripcion: "Coletilla del asunto cuando hay guía de regalo" },
  ],
  entrenatzaile_valoracion: [
    { clave: "nombre", descripcion: "Nombre de quien reserva" },
    { clave: "cambiar_idioma", descripcion: "Enlace para recibirlos en el otro idioma" },
    { clave: "contacto", descripcion: "Página de contacto" },
  ],
  hoja_ruta_abandono: [
    { clave: "saludo", descripcion: '"Hola, Ane" o "Hola" a secas si no dio nombre' },
    { clave: "nombre", descripcion: "Nombre de pila (vacío si no lo dio)" },
    {
      clave: "#si_ventana}} … {{/si_ventana",
      descripcion:
        "Lo que pongas entre esas dos marcas SOLO lo lee quien aún tiene la Hoja de Ruta gratis. A quien ya se le pasó, desaparece. Existe también {{#si_no_ventana}} … {{/si_no_ventana}} para lo contrario.",
    },
    {
      clave: "fin_ventana",
      descripcion:
        'El último día que ESA persona la tiene gratis: "domingo 6 de septiembre". Solo tiene sentido dentro de un bloque {{#si_ventana}}.',
    },
    {
      clave: "hoja_ruta",
      descripcion:
        "Enlace para terminar la reserva. Lleva su token si sigue en ventana, y va a la versión de pago si no: no hace falta que decidas tú a cuál mandarle.",
    },
  ],
};
