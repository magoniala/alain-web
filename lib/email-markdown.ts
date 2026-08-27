// Conversor de texto a HTML para los correos automáticos.
//
// Existe para que los mails se escriban desde el panel como texto, sin picar
// HTML a mano. No es markdown de verdad: solo cubre lo que los correos de
// este sitio usan realmente, que es poco y muy concreto.
//
// SINTAXIS
//
//   **negrita**            _cursiva_            [texto](https://…)
//
//   - punto de lista       (varias líneas seguidas forman una sola lista)
//
//   [[Descargar](https://…)]   botón con recuadro, en su propia línea
//
//   Un salto de línea  -> hueco PEQUEÑO (misma idea, otra frase)
//   Una línea en blanco -> hueco GRANDE (párrafo nuevo)
//
// Ese doble espaciado no es un capricho: es la convención de los correos de
// Alain (frases sueltas muy separadas, estilo carta). Un conversor de
// markdown normal lo aplastaría todo a un único espaciado y cambiaría el
// aspecto de todos los mails.

const MARGEN_FRASE = "1.4rem";
const MARGEN_PARRAFO = "3.4rem";
const COLOR_ENLACE = "#2a9d8f";

function escaparHtml(texto: string) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Formato dentro de una línea. Se escapa primero y se aplican los marcadores
// después, para que nadie pueda colar etiquetas escribiendo en el panel.
export function formatoEnLinea(texto: string): string {
  return escaparHtml(texto)
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:bold;">$1</strong>')
    .replace(/_(.+?)_/g, '<em style="font-style:italic;">$1</em>')
    .replace(
      /\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)]+)\)/g,
      `<a href="$2" style="color:${COLOR_ENLACE};">$1</a>`
    );
}

const RE_BOTON = /^\[\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)]+)\)\]$/;

function boton(etiqueta: string, url: string, ultimoDelBloque: boolean) {
  const margen = ultimoDelBloque ? MARGEN_PARRAFO : MARGEN_FRASE;
  return (
    `<p style="margin:0 0 ${margen} 0;">` +
    `<a href="${url}" style="display:inline-block;border:1px solid ${COLOR_ENLACE};color:${COLOR_ENLACE};` +
    `padding:0.5rem 1rem;text-decoration:none;">${formatoEnLinea(etiqueta)}</a></p>`
  );
}

function lista(puntos: string[], ultimoDelBloque: boolean) {
  const margen = ultimoDelBloque ? MARGEN_PARRAFO : MARGEN_FRASE;
  const items = puntos.map((p) => `<li style="margin:0 0 0.4rem 0;">${formatoEnLinea(p)}</li>`).join("");
  return `<ul style="margin:0 0 ${margen} 0;padding-left:1.2rem;">${items}</ul>`;
}

type Trozo = { tipo: "lista"; puntos: string[] } | { tipo: "linea"; texto: string };

// Convierte un bloque (las líneas que hay entre dos líneas en blanco).
function convertirBloque(lineas: string[]): string {
  const trozos: Trozo[] = [];
  let i = 0;

  while (i < lineas.length) {
    // Varias líneas de lista seguidas se agrupan en un solo <ul>.
    if (lineas[i].startsWith("- ")) {
      const puntos: string[] = [];
      while (i < lineas.length && lineas[i].startsWith("- ")) {
        puntos.push(lineas[i].slice(2).trim());
        i++;
      }
      trozos.push({ tipo: "lista", puntos });
      continue;
    }

    trozos.push({ tipo: "linea", texto: lineas[i] });
    i++;
  }

  // El último elemento del bloque cierra párrafo: lleva el hueco grande.
  return trozos
    .map((t, idx) => {
      const ultimo = idx === trozos.length - 1;
      if (t.tipo === "lista") return lista(t.puntos, ultimo);

      const esBoton = t.texto.match(RE_BOTON);
      if (esBoton) return boton(esBoton[1], esBoton[2], ultimo);

      const margen = ultimo ? MARGEN_PARRAFO : MARGEN_FRASE;
      return `<p style="margin:0 0 ${margen} 0;">${formatoEnLinea(t.texto)}</p>`;
    })
    .join("\n");
}

/**
 * Texto del panel -> HTML del cuerpo del correo (sin la plantilla exterior,
 * que la pone quien envía: wrapNurture y compañía).
 */
export function textoAHtml(cuerpo: string): string {
  const bloques = cuerpo
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((b) => b.length > 0);

  return bloques.map(convertirBloque).join("\n");
}

/** Preheader: el texto que asoma en la bandeja de entrada, oculto en el cuerpo. */
export function preheaderHtml(texto: string | null | undefined): string {
  if (!texto?.trim()) return "";
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escaparHtml(texto.trim())}</div>`;
}

/**
 * Sustituye los marcadores {{clave}} por su valor.
 *
 * Va DESPUÉS de convertir el texto, no antes: si se hiciera antes, el
 * escapado convertiría los `&` de las URLs en `&amp;` y cambiaría enlaces que
 * hoy funcionan. Los valores los pone siempre el servidor (URLs que construye
 * él), nunca el visitante, así que no hay nada que escapar.
 *
 * Un marcador que no exista se deja tal cual, a la vista: es preferible ver
 * un {{loquesea}} en el correo y darse cuenta, a que desaparezca en silencio
 * y nadie note que faltaba un enlace.
 */
export function sustituirMarcadores(html: string, valores: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (original, clave) =>
    clave in valores ? valores[clave] : original
  );
}

/**
 * Cuerpo listo para enviar, según cómo esté guardado el mail.
 *
 * 'html' es el formato antiguo: el contenido se guarda ya como HTML y se usa
 * tal cual. Los mails que ya existían siguen así, intactos.
 * 'texto' es el nuevo: se escribe en el panel con la sintaxis de arriba.
 */
export function cuerpoDelMail(
  contenido: string | null | undefined,
  formato: string | null | undefined,
  preheader?: string | null,
  valores?: Record<string, string>
): string {
  const cuerpo = contenido ?? "";
  const html = formato === "texto" ? preheaderHtml(preheader) + textoAHtml(cuerpo) : cuerpo;
  return valores ? sustituirMarcadores(html, valores) : html;
}
