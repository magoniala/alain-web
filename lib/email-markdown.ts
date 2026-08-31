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
/**
 * Trozos de correo que solo salen si se cumple una condición.
 *
 *   {{#si_ventana}}  …esto solo lo lee quien aún la tiene gratis…  {{/si_ventana}}
 *   {{#si_no_ventana}}  …y esto, quien ya no.  {{/si_no_ventana}}
 *
 * Hace falta porque un mismo correo le llega a gente en situaciones
 * distintas. El M0 es el caso claro: lleva la ficha que la persona acaba de
 * pedir, así que tiene que salir siempre, pero su párrafo de "la tienes
 * gratis 8 días" es falso para quien se dio de baja hace meses y vuelve a
 * apuntarse. Sin esto habría que elegir entre no mandarle la ficha o
 * prometerle algo que la landing le va a cobrar.
 *
 * Se resuelve sobre el texto ORIGINAL, antes de convertirlo a HTML, para que
 * al quitar un bloque no queden líneas en blanco de más.
 *
 * Una condición que nadie ha definido se trata como falsa y el bloque
 * desaparece: al revés —dejarlo visible, como se hace con los {{marcadores}}
 * sueltos— acabaría enseñando una promesa a quien no le corresponde, que es
 * justo lo que esto viene a evitar.
 */
// Dos formas, y se resuelven por separado a propósito.
//
// La de líneas enteras (las marcas solas en su línea) se lleva también los
// saltos, para que al quitar el bloque no quede un hueco donde estaba. La de
// dentro de una frase respeta los espacios de alrededor tal cual. Con una
// sola regex para las dos, quitar un trozo en mitad de una frase pegaba las
// palabras de los lados.
const RE_BLOQUE_LINEAS = /^[ \t]*\{\{#(\w+)\}\}[ \t]*\n([\s\S]*?)\n[ \t]*\{\{\/\1\}\}[ \t]*\n?/gm;
const RE_BLOQUE_EN_LINEA = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

export function resolverBloques(texto: string, condiciones: Record<string, boolean>): string {
  return texto
    .replace(RE_BLOQUE_LINEAS, (_, clave: string, dentro: string) =>
      condiciones[clave] ? `${dentro}\n` : ""
    )
    .replace(RE_BLOQUE_EN_LINEA, (_, clave: string, dentro: string) =>
      condiciones[clave] ? dentro : ""
    );
}

export function cuerpoDelMail(
  contenido: string | null | undefined,
  formato: string | null | undefined,
  preheader?: string | null,
  valores?: Record<string, string>,
  condiciones?: Record<string, boolean>
): string {
  let cuerpo = contenido ?? "";
  if (condiciones) cuerpo = resolverBloques(cuerpo, condiciones);
  const html = formato === "texto" ? preheaderHtml(preheader) + textoAHtml(cuerpo) : cuerpo;
  return valores ? sustituirMarcadores(html, valores) : html;
}

// ============================================================
// Marcadores de fecha
// ============================================================
//
// Las fechas se calculan SIEMPRE en el momento del envío, no al escribir el
// mail: así un correo de la secuencia que sale hoy dice una fecha y el que
// sale mañana dice otra, sin tocar nada en el panel.
//
//   {{fecha_7}}        -> "domingo 6 de septiembre"  (hoy + 7 días)
//   {{fecha_corta_7}}  -> "6 de septiembre"
//   {{fecha_0}}        -> hoy
//
// Hay claves de 0 a 30 días. Se generan todas de golpe (son 62 cadenas, no
// cuesta nada) en vez de resolverlas al vuelo, para que sustituirMarcadores
// siga siendo lo que es: un reemplazo tonto de {{clave}} por su valor.

/** Zona en la que se leen los correos: las fechas se cuentan en Madrid. */
const ZONA_CORREOS = "Europe/Madrid";
const DIAS_MARCADOR_FECHA = 30;

function etiquetaFecha(fecha: Date, conDiaDeLaSemana: boolean): string {
  // timeZone UTC porque la fecha se construye ya como mediodía UTC del día
  // natural que toca: sin esto, el formateo podría correrla un día.
  const dia = fecha.toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "UTC" });
  if (!conDiaDeLaSemana) return dia;
  const semana = fecha.toLocaleDateString("es-ES", { weekday: "long", timeZone: "UTC" });
  return `${semana} ${dia}`;
}

export function marcadoresDeFecha(ahora: Date = new Date()): Record<string, string> {
  const hoyMadrid = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_CORREOS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
  const [anio, mes, dia] = hoyMadrid.split("-").map(Number);

  const valores: Record<string, string> = {};
  for (let n = 0; n <= DIAS_MARCADOR_FECHA; n++) {
    // Date.UTC normaliza solo el desbordamiento de mes y de año.
    const fecha = new Date(Date.UTC(anio, mes - 1, dia + n, 12));
    valores[`fecha_${n}`] = etiquetaFecha(fecha, true);
    valores[`fecha_corta_${n}`] = etiquetaFecha(fecha, false);
  }
  return valores;
}

/** Nombre de pila y saludo, a partir del nombre que haya dado el contacto. */
export function marcadoresDeNombre(nombre: string | null | undefined): Record<string, string> {
  const primero = (nombre ?? "").trim().split(" ")[0] ?? "";
  return {
    nombre: primero,
    // Muchos contactos entran sin nombre: {{saludo}} existe para que la
    // primera línea aguante igual ("Hola" a secas) en vez de quedar "Hola, .".
    saludo: primero ? `Hola, ${primero}` : "Hola",
  };
}

/**
 * Valores con los que se resuelven los marcadores cuando NO hay un contacto
 * detrás: el preview del panel y el "Enviar prueba". Nombre de muestra y
 * fechas de hoy, para ver la frase acabada en vez de un {{fecha_7}} suelto.
 *
 * Vive aquí, y no en cada sitio que la necesita, para que la prueba que le
 * llega al buzón diga exactamente lo mismo que el preview de al lado.
 */
export const NOMBRE_DE_MUESTRA = "Ane";

export function marcadoresDeMuestra(): Record<string, string> {
  return { ...marcadoresDeNombre(NOMBRE_DE_MUESTRA), ...marcadoresDeFecha() };
}
