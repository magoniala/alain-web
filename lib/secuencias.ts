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
