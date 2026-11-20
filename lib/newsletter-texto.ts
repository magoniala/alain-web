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

// Los enlaces se analizan ANTES que las cursivas. Si no, el "_" de una URL
// como ...?utm_source=diario&utm_content=hr5 se leía como apertura y cierre de
// cursiva y rompía el enlace (visto el 20-11-2026). Cada enlace se aparta tras
// un marcador (caracteres de uso privado, que no salen en un texto normal),
// se aplican negrita y cursiva al resto y al final se devuelven los enlaces,
// con el href tal cual lo escribió quien redactó el mail (con "_" o con %5F).
const RE_ENLACE = /\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)]+)\)/g;
const RE_MARCADOR = /\uE000(\d+)\uE001/g;

function negritaYCursiva(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:bold;">$1</strong>')
    .replace(/_(.+?)_/g, '<em style="font-style:italic;">$1</em>');
}

export function processText(text: string): string {
  const enlaces: { etiqueta: string; url: string }[] = [];
  const apartado = text
    .replace(/[\uE000\uE001]/g, "")
    .replace(RE_ENLACE, (_, etiqueta: string, url: string) => {
      enlaces.push({ etiqueta, url });
      return `\uE000${enlaces.length - 1}\uE001`;
    });

  return negritaYCursiva(apartado).replace(RE_MARCADOR, (_, i: string) => {
    const { etiqueta, url } = enlaces[Number(i)];
    return `<a href="${url}" style="${ESTILO_ENLACE}">${negritaYCursiva(etiqueta)}</a>`;
  });
}
