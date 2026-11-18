// Guiones de llamada del panel de Charlas.
//
// El texto vive en el vault (Vías/Charlas/Guiones/*.md) y la pasada horaria
// del espejo lo sube entero a charlas_guiones (scripts/charlas/guiones-vault.mjs).
// Aquí se trocea, se elige cuál toca a cada centro y se define qué escribe en
// la ficha cada resultado de llamada. Sin dependencias de servidor: lo usan
// la API y el panel.

export type ClaveGuion = "conserjeria" | "reenvio" | "seguimiento-dossier" | "cerrar-fecha" | "objeciones";

export const TITULOS_GUION: Record<ClaveGuion, string> = {
  conserjeria: "Llamada a conserjería",
  reenvio: "Llamada tras reenvío a orientación",
  "seguimiento-dossier": "Seguimiento tras el dossier",
  "cerrar-fecha": "Llamada para cerrar fecha",
  objeciones: "Objeciones",
};

export interface Bloque {
  titulo: string;
  lineas: string[];
}
export interface Guion {
  clave: ClaveGuion;
  notas: Bloque[]; // Cuándo / Objetivo… (lo que va antes de "## Castellano")
  es: Bloque[];
  eu: Bloque[];
}

// ---------------------------------------------------------------------------
// Troceado del .md: "## Castellano" / "## Euskaraz…" y dentro bloques que
// empiezan por una línea "**Título** resto". El primer bloque de cada idioma
// es lo que se dice al empezar. Las demás secciones (casos de correo, reglas)
// no son de teléfono y se ignoran.
// ---------------------------------------------------------------------------
export function trocearGuion(clave: ClaveGuion, md: string): Guion {
  const g: Guion = { clave, notas: [], es: [], eu: [] };
  // En Objeciones, lo de antes del primer "##" ya son respuestas en castellano.
  let destino: Bloque[] | null = clave === "objeciones" ? g.es : g.notas;
  let actual: Bloque | null = null;
  for (const bruta of md.replace(/\r/g, "").split("\n")) {
    const linea = bruta.trim();
    const h2 = /^##\s+(.+)$/.exec(linea);
    if (h2) {
      actual = null;
      destino = /^castellano/i.test(h2[1]) ? g.es : /^euskar/i.test(h2[1]) ? g.eu : null;
      continue;
    }
    if (!destino || /^#\s/.test(linea) || linea === "---" || linea.startsWith(">")) continue;
    const negrita = /^\*\*(.+?)\*\*\s*(.*)$/.exec(linea);
    if (negrita) {
      actual = { titulo: limpiar(negrita[1]), lineas: negrita[2] ? [limpiar(negrita[2])] : [] };
      destino.push(actual);
      continue;
    }
    if (actual && linea) actual.lineas.push(limpiar(linea));
  }
  return g;
}

function limpiar(s: string) {
  return s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a).replace(/\*\*/g, "").replace(/`/g, "");
}

// ---------------------------------------------------------------------------
// Qué guion toca: por estado, y la próxima acción solo afina (los 0 Por llamar
// no tienen próxima acción escrita). `destacado` = la próxima acción es llamar:
// la tarjeta enseña el botón en primer plano.
// ---------------------------------------------------------------------------
const PIDE_LLAMADA = /llam|deitu|tel[eé]fon/i;

export function guionPara(c: { estado: string; proxima_accion: string | null }): { clave: ClaveGuion; destacado: boolean } | null {
  const e = c.estado ?? "";
  const p = c.proxima_accion ?? "";
  const llamar = PIDE_LLAMADA.test(p);
  if (/^[01]\s/.test(e)) return { clave: "conserjeria", destacado: true };
  if (e.startsWith("3.9")) {
    if (!llamar && /aparcar/i.test(p)) return null;
    return { clave: "reenvio", destacado: true };
  }
  if (/^5\s/.test(e)) return { clave: "seguimiento-dossier", destacado: llamar };
  if (/^[46]\s/.test(e)) return { clave: "cerrar-fecha", destacado: llamar };
  if (llamar && !/^[78]\s/.test(e)) return { clave: "objeciones", destacado: true };
  return null;
}

/**
 * Guion de una tarjeta de la Bandeja cuya acción ya ES una llamada (tipo llamada_alain).
 * Aquí manda el estado de la ficha, no el texto de su próxima acción: una ficha en
 * «3.9 reenviado - pendiente» cuya próxima acción dice «si no hay noticias, aparcar»
 * sigue teniendo la llamada pendiente. (La vista Llamadas del CRM no cambia: usa guionPara.)
 */
export function guionParaTarjetaLlamada(c: { estado: string; proxima_accion: string | null }): { clave: ClaveGuion; destacado: boolean } | null {
  const g = guionPara(c);
  if (g?.destacado) return g;
  const e = c.estado ?? "";
  if (/^[01]\s/.test(e)) return { clave: "conserjeria", destacado: true };
  if (e.startsWith("3.9")) return { clave: "reenvio", destacado: true };
  if (/^5\s/.test(e)) return { clave: "seguimiento-dossier", destacado: true };
  return null;
}

/** Idioma de la llamada: euskera si la ficha dice sí o parcial (en parcial, el panel deja cambiar). */
export function idiomaLlamada(euskera: string | null | undefined): { idioma: "es" | "eu"; puedeCambiar: boolean } {
  if (euskera === "sí" || euskera === "si") return { idioma: "eu", puedeCambiar: true };
  if (euskera === "parcial") return { idioma: "eu", puedeCambiar: true };
  return { idioma: "es", puedeCambiar: true };
}

// ---------------------------------------------------------------------------
// Resultados de llamada: un botón por desenlace del guion. Cada uno dice qué
// datos pide y qué escribe en la ficha (estado, próxima acción con fecha y una
// línea en el Registro con canal "Llamada"). Sigue el 00 Flujo charlas.
// ---------------------------------------------------------------------------
export type CampoResultado = "contacto" | "fecha" | "nota";

export interface Resultado {
  id: string;
  etiqueta: string;
  campos: CampoResultado[];
  notaObligatoria?: string; // texto del placeholder si la nota es obligatoria
  fechaEtiqueta?: string;
  fechaPorDefecto?: (hoy: string) => string;
}

export interface DatosResultado {
  nombre?: string;
  cargo?: string;
  email?: string;
  ampa_email?: string;
  fecha?: string;
  nota?: string;
}

export interface CentroParaResultado {
  estado: string;
  intentos_llamada: number | null;
  responsable: string | null;
  responsable_cargo?: string | null;
}

export const ESTADO_APARCADO = "9 Aparcado (con fecha de reactivación)";

export function sumarLaborables(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  let quedan = n;
  while (quedan > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) quedan--;
  }
  return d.toISOString().slice(0, 10);
}

/** Fecha de reactivación por defecto: de septiembre a diciembre, el 11 de enero (como el resto de fichas aparcadas); luego, +60 días; en verano, mediados de septiembre. */
export function reactivacionPorDefecto(hoy: string) {
  const [a, m] = hoy.split("-").map(Number);
  if (m >= 9) return `${a + 1}-01-11`;
  if (m >= 5) return `${a}-09-15`;
  const d = new Date(hoy + "T12:00:00");
  d.setDate(d.getDate() + 60);
  return d.toISOString().slice(0, 10);
}

const NO_ESTA: Resultado = { id: "no-esta", etiqueta: "No contesta / no está", campos: ["nota"] };
const en7 = (h: string) => sumarLaborables(h, 5);

export const RESULTADOS: Record<ClaveGuion, Resultado[]> = {
  conserjeria: [
    NO_ESTA,
    { id: "contacto", etiqueta: "Dan nombre y correo", campos: ["contacto", "nota"] },
    { id: "solo-cargo", etiqueta: "Solo cargo · al buzón del centro", campos: ["contacto", "nota"] },
  ],
  reenvio: [
    NO_ESTA,
    { id: "recado", etiqueta: "Le pasan el recado", campos: ["nota"] },
    { id: "abierto", etiqueta: "Hablo con ella · calendario abierto", campos: ["contacto", "nota"] },
    { id: "cerrado", etiqueta: "Hablo con ella · calendario cerrado", campos: ["contacto", "fecha", "nota"], fechaEtiqueta: "Reactivar el", fechaPorDefecto: reactivacionPorDefecto },
    { id: "no-pasan", etiqueta: "No me pasan → aparcar", campos: ["fecha", "nota"], fechaEtiqueta: "Reactivar el", fechaPorDefecto: reactivacionPorDefecto },
  ],
  "seguimiento-dossier": [
    NO_ESTA,
    { id: "interesa", etiqueta: "Les interesa → hablar de fechas", campos: ["nota"] },
    { id: "pendiente", etiqueta: "Aún no lo han mirado / lo decide otro", campos: ["fecha", "nota"], fechaEtiqueta: "Volver a llamar el", fechaPorDefecto: en7 },
    { id: "este-curso-no", etiqueta: "Este curso no / precio / fechas → aparcar", campos: ["fecha", "nota"], fechaEtiqueta: "Reactivar el", fechaPorDefecto: reactivacionPorDefecto },
    { id: "no-encaja", etiqueta: "No encaja (otro motivo) → perdido", campos: ["nota"], notaObligatoria: "Motivo, con sus palabras" },
  ],
  "cerrar-fecha": [
    NO_ESTA,
    { id: "datos", etiqueta: "Datos cerrados → mail de resumen", campos: ["nota"], notaObligatoria: "Curso y grupos · formato · fecha · idioma · quién paga" },
    { id: "consultar", etiqueta: "Lo tiene que consultar", campos: ["fecha", "nota"], fechaEtiqueta: "Volver a llamar el", fechaPorDefecto: (h) => sumarLaborables(h, 3) },
    { id: "mas-adelante", etiqueta: "Le interesa, pero más adelante", campos: ["fecha", "nota"], fechaEtiqueta: "Proponer fechas el", fechaPorDefecto: reactivacionPorDefecto },
  ],
  objeciones: [
    NO_ESTA,
    { id: "hablado", etiqueta: "Hablado", campos: ["fecha", "nota"], notaObligatoria: "Qué ha dicho y qué toca ahora", fechaEtiqueta: "Próxima acción el", fechaPorDefecto: en7 },
  ],
};

export interface Aplicacion {
  cambios: Record<string, string | number | null>;
  registro: string;
  resumen: string; // lo que se enseña antes de guardar
}

/** Qué escribe en la ficha un resultado de llamada. Devuelve un error si falta un dato obligatorio. */
export function aplicarResultado(clave: ClaveGuion, id: string, c: CentroParaResultado, d: DatosResultado, hoy: string): Aplicacion | { error: string } {
  const r = RESULTADOS[clave].find((x) => x.id === id);
  if (!r) return { error: "Resultado desconocido." };
  const nota = (d.nota ?? "").trim();
  if (r.notaObligatoria && !nota) return { error: `Falta: ${r.notaObligatoria.toLowerCase()}.` };
  const fecha = d.fecha || r.fechaPorDefecto?.(hoy) || hoy;
  const nombre = (d.nombre ?? "").trim();
  const cargo = (d.cargo ?? "").trim();
  const email = (d.email ?? "").trim();
  const intentos = (c.intentos_llamada ?? 0) + 1;
  const cambios: Record<string, string | number | null> = {};
  const contacto = () => {
    if (nombre) cambios.responsable = nombre;
    if (cargo) cambios.responsable_cargo = cargo;
    if (email) cambios.responsable_email = email;
    if (d.ampa_email?.trim()) cambios.ampa_email = d.ampa_email.trim();
  };
  const hablado = () => (cambios.fecha_ultimo_contacto = hoy);
  let que = r.etiqueta;

  switch (`${clave}/${id}`) {
    case "conserjeria/no-esta":
      cambios.intentos_llamada = intentos;
      cambios.estado = "1 Llamando";
      if (intentos >= 3) {
        cambios.via = "generico";
        cambios.proxima_accion = "Mail 1 genérico al buzón del centro (3 llamadas sin contacto)";
        cambios.fecha_proxima_accion = hoy;
      } else {
        cambios.proxima_accion = `Llamada conserjería (intento ${intentos + 1}/3, otra franja)`;
        cambios.fecha_proxima_accion = sumarLaborables(hoy, 2);
      }
      que = `no contesta / no está (intento ${intentos}/3)`;
      break;
    case "conserjeria/contacto":
      if (!nombre || !email) return { error: "Falta el nombre o el correo." };
      contacto();
      hablado();
      cambios.intentos_llamada = intentos;
      cambios.estado = "2 Contacto conseguido";
      cambios.via = "contacto";
      cambios.proxima_accion = `Mail 1 Calendario a ${nombre}`;
      cambios.fecha_proxima_accion = hoy;
      que = `contacto conseguido: ${[nombre, cargo, email].filter(Boolean).join(" · ")}${d.ampa_email ? ` · AMPA ${d.ampa_email}` : ""}`;
      break;
    case "conserjeria/solo-cargo":
      if (!cargo && !nombre) return { error: "Falta el cargo (o el nombre)." };
      contacto();
      hablado();
      cambios.intentos_llamada = intentos;
      cambios.estado = "1 Llamando";
      cambios.via = "generico";
      cambios.proxima_accion = `Mail 1 genérico al buzón del centro, a la atención de ${nombre || cargo}`;
      cambios.fecha_proxima_accion = hoy;
      que = `sin correo personal; mandar al buzón a la atención de ${[nombre, cargo].filter(Boolean).join(", ")}`;
      break;

    case "reenvio/no-esta":
      cambios.intentos_llamada = intentos;
      cambios.proxima_accion = "Llamada tras reenvío a orientación (otra franja)";
      cambios.fecha_proxima_accion = sumarLaborables(hoy, 2);
      que = "no está / no contesta";
      break;
    case "reenvio/recado":
      hablado();
      cambios.proxima_accion = "Esperar su llamada; si no llama, aparcar";
      cambios.fecha_proxima_accion = sumarLaborables(hoy, 5);
      que = "le pasan el recado (mi teléfono para que llame)";
      break;
    case "reenvio/abierto":
      contacto();
      hablado();
      cambios.estado = "4 Ha respondido";
      cambios.calendario_abierto = "true";
      cambios.proxima_accion = "Mail 2 Dossier A (calendario abierto)";
      cambios.fecha_proxima_accion = hoy;
      que = `hablo con ${nombre || "la persona"}: calendario abierto`;
      break;
    case "reenvio/cerrado":
      contacto();
      hablado();
      cambios.estado = "4 Ha respondido";
      cambios.calendario_abierto = "no";
      cambios.proxima_accion = `Mail 2 Dossier B hoy y aparcar con reactivación el ${fecha}`;
      cambios.fecha_proxima_accion = hoy;
      que = `hablo con ${nombre || "la persona"}: calendario cerrado, reactivar el ${fecha}`;
      break;
    case "reenvio/no-pasan":
      cambios.estado = ESTADO_APARCADO;
      cambios.proxima_accion = "Reactivar: Mail 1 Calendario C";
      cambios.fecha_proxima_accion = fecha;
      que = "no me pasan con la persona → aparcado";
      break;

    case "seguimiento-dossier/no-esta":
    case "cerrar-fecha/no-esta":
    case "objeciones/no-esta":
      cambios.proxima_accion = `${TITULOS_GUION[clave]} (otra franja)`;
      cambios.fecha_proxima_accion = sumarLaborables(hoy, 2);
      que = "no está / no contesta";
      break;
    case "seguimiento-dossier/interesa":
      hablado();
      cambios.estado = "6 en conversación";
      cambios.proxima_accion = "Llamada para cerrar fecha";
      cambios.fecha_proxima_accion = hoy;
      que = "tras el dossier: les interesa, hablar de fechas";
      break;
    case "seguimiento-dossier/pendiente":
      hablado();
      cambios.proxima_accion = "Llamada de seguimiento tras dossier (lo estaban mirando)";
      cambios.fecha_proxima_accion = fecha;
      que = `aún sin decidir, volver a llamar el ${fecha}`;
      break;
    case "seguimiento-dossier/este-curso-no":
      hablado();
      cambios.estado = ESTADO_APARCADO;
      cambios.proxima_accion = "Reactivar: Mail 1 Calendario C";
      cambios.fecha_proxima_accion = fecha;
      que = `este curso no → aparcado hasta el ${fecha}`;
      break;
    case "seguimiento-dossier/no-encaja":
      hablado();
      cambios.estado = "8 Perdido";
      cambios.proxima_accion = null;
      cambios.fecha_proxima_accion = null;
      que = "no encaja → perdido";
      break;

    case "cerrar-fecha/datos":
      hablado();
      cambios.estado = "6 en conversación";
      cambios.proxima_accion = "Mail de resumen (fecha, formato, sesiones, idioma y precio) y esperar confirmación por escrito";
      cambios.fecha_proxima_accion = hoy;
      que = "datos cerrados por teléfono";
      break;
    case "cerrar-fecha/consultar":
      hablado();
      cambios.estado = "6 en conversación";
      cambios.proxima_accion = "Llamada para cerrar fecha (lo estaba consultando); mandar antes el resumen por escrito";
      cambios.fecha_proxima_accion = fecha;
      que = `lo tiene que consultar, volver a llamar el ${fecha}`;
      break;
    case "cerrar-fecha/mas-adelante":
      hablado();
      cambios.estado = "6 en conversación";
      cambios.proxima_accion = "Proponer dos fechas del mes que dijo";
      cambios.fecha_proxima_accion = fecha;
      que = "le interesa más adelante";
      break;

    case "objeciones/hablado":
      hablado();
      cambios.proxima_accion = nota.slice(0, 140);
      cambios.fecha_proxima_accion = fecha;
      que = "hablado";
      break;
    default:
      return { error: "Resultado sin definir." };
  }

  const registro = `${TITULOS_GUION[clave]}: ${que}${nota ? ` — ${nota}` : ""}`;
  const partes: string[] = [];
  if (cambios.estado && cambios.estado !== c.estado) partes.push(`estado → ${cambios.estado}`);
  if (cambios.proxima_accion !== undefined) partes.push(cambios.proxima_accion ? `próxima: ${cambios.proxima_accion}${cambios.fecha_proxima_accion ? ` (${cambios.fecha_proxima_accion})` : ""}` : "sin próxima acción");
  return { cambios, registro, resumen: partes.join(" · ") };
}
