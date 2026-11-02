// Lectura y escritura de las fichas de Prospectos/ (CRM de magia) del vault.
//
// Una ficha es: frontmatter YAML sencillo (una clave por línea) + cuerpo con
// un "## Registro" en medio. Para que el espejo pueda regenerar la nota
// idéntica, se guardan tal cual las líneas originales del frontmatter, lo que
// va antes del Registro (título, bloque mensaje-listo, guiones…) y lo que va
// después (Eventos, Notas, Tarifas…). Solo se reescribe lo que cambia.

export const CLAVES = [
  "negocio", "segmento", "tipo_entidad", "territorio", "localidad", "telefono", "email", "web", "prioridad", "estado", "origen",
  "responsable", "responsable_cargo", "responsable_email", "responsable_tel", "ultimo_evento", "fecha_ultimo_evento",
  "intentos_llamada", "mails_enviados", "fecha_ultimo_contacto", "proxima_accion", "bloqueado_por", "fecha_proxima_accion", "fecha_creacion",
  "canal", "idioma", "enviado", "mes_temporada", "ficha_charlas",
];
const ENTEROS = new Set(["intentos_llamada", "mails_enviados", "mes_temporada"]);
const FECHAS = new Set(["fecha_ultimo_evento", "fecha_ultimo_contacto", "fecha_proxima_accion", "fecha_creacion"]);

/** Valor YAML escalar → JS: quita comillas, convierte números y booleanos. */
export function valorYaml(s) {
  const t = (s ?? "").trim();
  if (t === "") return null;
  if (/^".*"$/.test(t)) return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  if (/^'.*'$/.test(t)) return t.slice(1, -1);
  if (t === "true") return true;
  if (t === "false") return false;
  return t;
}

export function parseFicha(texto) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(texto);
  if (!m) throw new Error("Sin frontmatter");
  const rawLines = m[1].split("\n");
  const fm = {};
  for (const l of rawLines) {
    const k = /^([a-z_]+):\s*(.*)$/.exec(l);
    if (!k) continue;
    if (k[1] === "tags") continue;
    let v = valorYaml(k[2]);
    if (v !== null && ENTEROS.has(k[1])) v = Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null;
    if (v !== null && FECHAS.has(k[1])) v = /^(\d{4}-\d{2}-\d{2})/.exec(String(v))?.[1] ?? null;
    fm[k[1]] = v;
  }
  const cuerpo = texto.slice(m[0].length);
  const iReg = cuerpo.search(/^## Registro[ \t]*$/m);
  let antes = cuerpo;
  let registro = [];
  let despues = null; // null = la nota no tenía sección Registro
  if (iReg >= 0) {
    antes = cuerpo.slice(0, iReg);
    const resto = cuerpo.slice(iReg).replace(/^## Registro[ \t]*\n/, "");
    const iSig = resto.search(/^## /m);
    const seccion = iSig >= 0 ? resto.slice(0, iSig) : resto;
    despues = iSig >= 0 ? resto.slice(iSig) : "";
    registro = parseRegistro(seccion);
  }
  return { frontmatter: fm, frontmatter_raw: m[1], cuerpo_antes: antes, registro, cuerpo_despues: despues };
}

/** Líneas "- AAAA-MM-DD · Canal · texto" (o sin canal), con continuaciones indentadas. */
export function parseRegistro(seccion) {
  const entradas = [];
  for (const l of seccion.replace(/\n+$/, "").split("\n")) {
    if (/^- /.test(l)) {
      // Una línea en blanco entre dos entradas se conserva como parte de la anterior.
      if (entradas.length && entradas[entradas.length - 1].blanco) entradas[entradas.length - 1].raw += "\n";
      entradas.push({ raw: l });
    } else if (entradas.length && l.trim() !== "" && /^\s/.test(l)) entradas[entradas.length - 1].raw += "\n" + l;
    else if (entradas.length && l.trim() === "") entradas[entradas.length - 1].blanco = true;
  }
  return entradas.map((e, orden) => {
    const primera = e.raw.split("\n")[0].slice(2);
    const partes = primera.split(" · ");
    const fecha = /^(\d{4}-\d{2}-\d{2})/.exec(partes[0])?.[1] ?? null;
    let canal = null;
    let texto;
    if (fecha && partes.length >= 3) {
      canal = partes[1].trim();
      texto = partes.slice(2).join(" · ");
    } else if (fecha && partes.length === 2) texto = partes[1];
    else texto = primera;
    const cont = e.raw.replace(/\n+$/, "").split("\n").slice(1).join("\n");
    return { fecha, canal, texto: (texto + (cont ? "\n" + cont : "")).trim(), raw: e.raw, orden };
  });
}

/** Línea de Registro para una interacción nueva (sin raw). */
export function lineaRegistro(i) {
  if (i.raw) return i.raw;
  const cab = [i.fecha, i.canal].filter(Boolean).join(" · ");
  return `- ${cab ? cab + " · " : ""}${i.texto}`;
}

function citar(v, clave) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  const s = String(v);
  const necesita = /[:#\[\]{}&*!|>'"%@`,]|^\s|\s$/.test(s) || /^(true|false|null|yes|no|on|off|~)$/i.test(s) || (/^[\d.+-]+$/.test(s) && !FECHAS.has(clave));
  return necesita ? `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : s;
}

/**
 * Frontmatter: línea original si el valor no ha cambiado; si cambió, se
 * reescribe esa clave. Claves nuevas van al final.
 */
export function renderFrontmatter(ficha) {
  const originales = (ficha.frontmatter_raw ?? "").split("\n");
  const vistas = new Set();
  const salida = [];
  const original = parseFrontmatterValores(ficha.frontmatter_raw ?? "");
  for (const l of originales) {
    const k = /^([a-z_]+):/.exec(l);
    if (!k || k[1] === "tags") {
      salida.push(l);
      continue;
    }
    const clave = k[1];
    vistas.add(clave);
    const actual = ficha[clave] ?? ficha.datos?.[clave] ?? null;
    if (igual(original[clave], actual, clave)) salida.push(l);
    else salida.push(`${clave}: ${citar(actual, clave)}`);
  }
  for (const clave of CLAVES) {
    if (vistas.has(clave)) continue;
    const v = ficha[clave];
    if (v === null || v === undefined || v === "") continue;
    salida.push(`${clave}: ${citar(v, clave)}`);
  }
  if (!salida.some((l) => /^tags:/.test(l))) salida.unshift("tags: [prospecto]");
  return salida.join("\n");
}

function parseFrontmatterValores(raw) {
  const out = {};
  for (const l of raw.split("\n")) {
    const k = /^([a-z_]+):\s*(.*)$/.exec(l);
    if (k && k[1] !== "tags") {
      let v = valorYaml(k[2]);
      if (v !== null && ENTEROS.has(k[1])) v = Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null;
      if (v !== null && FECHAS.has(k[1])) v = /^(\d{4}-\d{2}-\d{2})/.exec(String(v))?.[1] ?? null;
      out[k[1]] = v;
    }
  }
  return out;
}

export function igual(a, b, clave) {
  const n = (v) => (v === null || v === undefined || v === "" ? null : ENTEROS.has(clave) ? Number(v) : typeof v === "boolean" ? v : String(v));
  return n(a) === n(b);
}

export function renderFicha(ficha, interacciones) {
  const reg = [...interacciones].sort((a, b) => (a.origen === "vault" && b.origen === "vault" ? a.orden - b.orden : a.origen === "vault" ? -1 : b.origen === "vault" ? 1 : (a.fecha ?? "").localeCompare(b.fecha ?? "") || (a.creado_en ?? "").localeCompare(b.creado_en ?? "")));
  const lineas = reg.map(lineaRegistro).join("\n");
  const antes = ficha.cuerpo_antes ?? `\n# ${ficha.nombre}\n\n`;
  const sinSeccion = ficha.cuerpo_despues === null || ficha.cuerpo_despues === undefined;
  if (sinSeccion && reg.length === 0) return `---\n${renderFrontmatter(ficha)}\n---\n${antes}`;
  if (sinSeccion) {
    // La nota no tenía Registro y el sistema ha apuntado algo: se añade al final.
    return `---\n${renderFrontmatter(ficha)}\n---\n${antes.replace(/\n*$/, "\n\n")}## Registro\n\n${lineas}\n`;
  }
  const despues = ficha.cuerpo_despues;
  const bloqueRegistro = reg.length ? `\n${lineas}\n` : "\n";
  const sep = despues ? "\n" : "";
  return `---\n${renderFrontmatter(ficha)}\n---\n${antes}## Registro\n${bloqueRegistro}${sep}${despues}`;
}
