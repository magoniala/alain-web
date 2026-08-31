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
};

/** Secuencias con contenido en los dos idiomas. Nurture solo va en castellano. */
export const SECUENCIAS_BILINGUES: Secuencia[] = [
  "comodin",
  "mision",
  "contacto",
  "belaustegi",
  "valoracion",
  "entrenatzaile_valoracion",
];

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
};
