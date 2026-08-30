// Formato en línea de la newsletter: **negrita**, _cursiva_ y [texto](url).
//
// Vive aquí, y no copiado en cada sitio, porque son TRES los que lo usan: el
// envío manual (/api/newsletter/send), el cron de la cola (/api/newsletter/
// cron) y el preview del panel. Cuando estaba duplicado, tocar el estilo del
// enlace en uno dejaba a los otros dos pintando otra cosa — y el preview
// enseñaba una cosa mientras al buzón llegaba otra.
//
// No confundir con lib/email-markdown.ts: eso es el conversor de los correos
// automáticos (secuencias), que tiene su propia sintaxis y su propio
// espaciado. Aquí solo hay formato de una línea; los párrafos y las imágenes
// los arma cada llamante.

/** Estilo de los enlaces de la newsletter. */
export const ESTILO_ENLACE = "color:#D4860A;text-decoration:underline;font-weight:bold;";

export function processText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:bold;">$1</strong>')
    .replace(/_(.+?)_/g, '<em style="font-style:italic;">$1</em>')
    .replace(
      /\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)]+)\)/g,
      `<a href="$2" style="${ESTILO_ENLACE}">$1</a>`
    );
}
