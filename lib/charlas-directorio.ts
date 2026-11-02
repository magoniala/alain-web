// Importación de directorios oficiales de centros (Navarra, Cantabria,
// Registro Estatal…) al CRM de charlas, con el mismo formato de ficha que las
// de Euskadi. Es la versión TypeScript de scripts/charlas/importar-directorio.mjs
// para poder ejecutarla desde el panel (ruta /api/admin/charlas/directorio):
// Vercel sí llega a datos.gob.es y a los portales autonómicos, así que el
// fichero se descarga y se importa allí sin pasar por el Mac ni la Terminal.
//
// Pasos: leer (CSV/TSV/XLSX) → mapear columnas → filtrar centros con ESO o
// Bachillerato → normalizar a ficha → priorizar (públicos y modelo D primero)
// → insertar los que no existan (idempotente por nombre).

import { readSheet } from "read-excel-file/node";
import { supabaseCharlas } from "./charlas";

// Los XLSX se leen con read-excel-file (sin vulnerabilidades conocidas; el
// paquete xlsx de npm tiene dos sin arreglo). CSV/TSV con un lector propio.

export const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type Mapeo = Record<string, string[]>;

// Campos de la ficha → columnas candidatas (normalizadas) en los ficheros.
export const MAPEOS: Record<string, Mapeo> = {
  // Open Data Navarra · "Centros educativos" (datos.gob.es a15002917-centros-educativos1)
  navarra: {
    codigo: ["codigo", "codigo centro", "cod centro", "id"],
    nombre: ["nombre", "nombre del centro", "centro", "denominacion"],
    tipo_centro: ["tipo de centro", "tipo centro", "tipo"],
    titularidad: ["titularidad", "naturaleza", "regimen"],
    localidad: ["localidad", "municipio", "poblacion"],
    direccion: ["direccion", "domicilio"],
    cp: ["codigo postal", "cp"],
    telefono: ["telefono", "tfno", "tel"],
    email: ["email", "e mail", "correo", "correo electronico"],
    web: ["web", "pagina web", "url"],
    ensenanza: ["tipo de ensenanza", "ensenanza", "ensenanzas", "etapa", "nivel"],
    modalidad: ["modalidad", "modelo", "modelo linguistico"],
  },
  // Cantabria (Educantabria / ICANE) y Registro Estatal de Centros Docentes
  cantabria: {
    codigo: ["codigo", "codigo centro", "cod centro", "codigo del centro"],
    nombre: ["nombre", "denominacion", "denominacion generica", "centro", "nombre del centro"],
    tipo_centro: ["tipo de centro", "tipo centro", "denominacion generica", "naturaleza"],
    titularidad: ["titularidad", "naturaleza", "dependencia"],
    localidad: ["localidad", "municipio"],
    direccion: ["direccion", "domicilio"],
    cp: ["codigo postal", "cp", "c postal"],
    telefono: ["telefono", "tfno"],
    email: ["email", "e mail", "correo", "correo electronico"],
    web: ["web", "pagina web", "url"],
    ensenanza: ["ensenanzas", "ensenanza", "etapas", "etapa", "niveles", "nivel educativo"],
    modalidad: [],
  },
};
MAPEOS.recd = MAPEOS.cantabria;

type FilaMapeada = Record<string, string>;

const SECUNDARIA = /\b(eso|e s o|secundaria|bachiller|bachillerato|dbh|batxilergo)\b/;
function tieneSecundaria(f: FilaMapeada): boolean {
  const ens = norm(f.ensenanza);
  if (ens) return SECUNDARIA.test(ens);
  const t = norm(`${f.tipo_centro} ${f.nombre}`);
  return /\b(ies|instituto|secundaria|bhi|ikastetxea|cpeips|cpi|colegio)\b/.test(t) && !/\b(infantil|primaria|eei|cra|escuela)\b/.test(t);
}

/** CSV/TSV con comillas ("a;b" y "" dentro de comillas). */
export function parsearCSV(txt: string, sep: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (comillas) {
      if (ch === '"') {
        if (txt[i + 1] === '"') {
          campo += '"';
          i++;
        } else comillas = false;
      } else campo += ch;
      continue;
    }
    if (ch === '"' && campo === "") comillas = true;
    else if (ch === sep) {
      fila.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && txt[i + 1] === "\n") i++;
      fila.push(campo);
      campo = "";
      if (fila.some((c) => c.trim() !== "")) filas.push(fila);
      fila = [];
    } else campo += ch;
  }
  fila.push(campo);
  if (fila.some((c) => c.trim() !== "")) filas.push(fila);
  return filas;
}

function aObjetos(matriz: unknown[][]): Record<string, unknown>[] {
  if (!matriz.length) return [];
  const cab = matriz[0].map((c, i) => String(c ?? "").trim() || `col${i + 1}`);
  return matriz.slice(1).map((f) => Object.fromEntries(cab.map((c, i) => [c, f[i] ?? ""])));
}

/** Lee un CSV/TSV/JSON (texto) o un XLSX (binario) y devuelve filas como objetos. */
export async function leerTabla(contenido: Buffer, nombreFichero: string, tipoMime = ""): Promise<Record<string, unknown>[]> {
  const n = nombreFichero.toLowerCase();
  if (n.endsWith(".json") || /application\/json/.test(tipoMime)) {
    const j = JSON.parse(contenido.toString("utf8").replace(/^\uFEFF/, "")) as unknown;
    const arr = Array.isArray(j) ? j : (Object.values(j as Record<string, unknown>).find((v) => Array.isArray(v)) as unknown[] | undefined) ?? [];
    return arr.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
  }
  const esZip = contenido.length > 4 && contenido[0] === 0x50 && contenido[1] === 0x4b; // "PK": xlsx/ods
  if (esZip || /\.xlsx$/.test(n) || /sheet/.test(tipoMime)) {
    const datos = await readSheet(contenido);
    return aObjetos(datos as unknown[][]);
  }
  if (/\.(xls|ods)$/.test(n)) throw new Error("Formato .xls/.ods antiguo: ábrelo y guárdalo como .xlsx o .csv.");
  let txt = contenido.toString("utf8").replace(/^\uFEFF/, "");
  // Portales que aún sirven Latin-1: si hay caracteres de reemplazo, se relee.
  if (txt.includes("\uFFFD")) txt = contenido.toString("latin1");
  const primera = txt.split(/\r?\n/)[0] ?? "";
  const sep = primera.includes("\t") ? "\t" : primera.includes(";") ? ";" : ",";
  return aObjetos(parsearCSV(txt, sep));
}

export function aplicarMapeo(filas: Record<string, unknown>[], mapeo: Mapeo): { col: Record<string, string | null>; filas: FilaMapeada[] } {
  if (!filas.length) return { col: {}, filas: [] };
  const columnas = Object.keys(filas[0]);
  const colNorm = new Map(columnas.map((c) => [norm(c), c]));
  const elegir = (candidatas: string[]) => {
    for (const cand of candidatas) {
      const exacta = colNorm.get(cand);
      if (exacta) return exacta;
    }
    for (const cand of candidatas) {
      const parcial = [...colNorm.entries()].find(([k]) => k.includes(cand));
      if (parcial) return parcial[1];
    }
    return null;
  };
  const col = Object.fromEntries(Object.entries(mapeo).map(([campo, cands]) => [campo, elegir(cands)]));
  return { col, filas: filas.map((f) => Object.fromEntries(Object.entries(col).map(([campo, c]) => [campo, c ? String(f[c] ?? "").trim() : ""]))) };
}

function tipoDesde(titularidad: string, tipo_centro: string, nombre: string) {
  const t = norm(`${titularidad} ${tipo_centro} ${nombre}`);
  if (/\b(ikastola)\b/.test(t)) return "ikastola";
  if (/\b(publico|publica|ies|instituto|cpi|ceip|cp)\b/.test(t)) return "público";
  if (/\b(religios|salesian|jesuit|maristas|carmelit|escolap|dominic|claretian|sagrad|san |santa |la salle|corazon|compania de maria|teresian|ursulin|hijas|colegio diocesan|obispado|parroqui)\b/.test(t)) return "religioso";
  if (/\b(privado|privada|concertado|concertada|cooperativa)\b/.test(t)) return "privado";
  return "otro";
}

function euskeraDesde(modalidad: string, ensenanza: string, territorio: string) {
  const t = norm(`${modalidad} ${ensenanza}`);
  if (territorio === "Navarra") {
    if (/\bmodelo d\b|\bd\b.*euskera|euskera/.test(t)) return "sí";
    if (/\bmodelo a\b|\bmodelo b\b/.test(t)) return "parcial";
    return "no";
  }
  return "no";
}

export interface FichaDirectorio {
  nombre: string;
  frontmatter: Record<string, unknown>;
  registro: { fecha: string; canal: string; texto: string };
}

export function aFichas(filas: FilaMapeada[], territorio: string): FichaDirectorio[] {
  const hoy = new Date().toISOString().slice(0, 10);
  const vistos = new Set<string>();
  const fichas: FichaDirectorio[] = [];
  for (const f of filas) {
    if (!f.nombre) continue;
    if (!tieneSecundaria(f)) continue;
    const nombre = f.nombre.replace(/\s+/g, " ").trim();
    const clave = norm(nombre + " " + f.localidad);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const email = (f.email.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/) ?? [""])[0].toLowerCase();
    fichas.push({
      nombre,
      frontmatter: {
        codigo: f.codigo || null,
        territorio,
        localidad: f.localidad || null,
        tipo: tipoDesde(f.titularidad, f.tipo_centro, nombre),
        tipo_centro: f.tipo_centro || null,
        modelo_linguistico: f.modalidad || null,
        euskera: euskeraDesde(f.modalidad, f.ensenanza, territorio),
        etapas: /bachiller|batxilergo/.test(norm(f.ensenanza)) ? ["ESO", "Bachillerato"] : ["ESO"],
        etapas_confirmadas: f.ensenanza ? "sí" : "no",
        direccion: [f.direccion, f.cp, f.localidad].filter(Boolean).join(", ") || null,
        telefono: f.telefono.replace(/\D/g, "") || null,
        email_centro: email || null,
        web: f.web || null,
        estado: "0 Por llamar",
        origen: `directorio oficial ${territorio}`,
        intentos_llamada: 0,
        mails_enviados: 0,
        fecha_creacion: hoy,
      },
      registro: { fecha: hoy, canal: "Sistema", texto: `Ficha generada desde el directorio oficial de ${territorio}${f.codigo ? ` (código ${f.codigo})` : ""}; etapas según el directorio.` },
    });
  }
  return priorizar(fichas);
}

// Prioridad del plan de noviembre: públicos y modelo D primero, religiosos al final.
function priorizar(fichas: FichaDirectorio[]) {
  const peso = (f: FichaDirectorio) => {
    const tipo = f.frontmatter.tipo as string;
    return (tipo === "público" ? 0 : tipo === "ikastola" ? 1 : tipo === "privado" ? 2 : tipo === "otro" ? 3 : 4) - (f.frontmatter.euskera === "sí" ? 0.5 : 0);
  };
  for (const f of fichas) {
    const p = peso(f);
    f.frontmatter.prioridad = p <= 0.5 ? "A" : p <= 2 ? "B" : "C";
  }
  return fichas.sort((a, b) => peso(a) - peso(b) || a.nombre.localeCompare(b.nombre));
}

export function resumir(fichas: FichaDirectorio[]) {
  const porTipo: Record<string, number> = {};
  for (const f of fichas) porTipo[f.frontmatter.tipo as string] = (porTipo[f.frontmatter.tipo as string] ?? 0) + 1;
  return {
    centros: fichas.length,
    por_tipo: porTipo,
    con_email: fichas.filter((f) => f.frontmatter.email_centro).length,
    con_telefono: fichas.filter((f) => f.frontmatter.telefono).length,
    con_web: fichas.filter((f) => f.frontmatter.web).length,
    euskera: fichas.filter((f) => f.frontmatter.euskera === "sí").length,
  };
}

/** Inserta en Supabase las fichas que no existan (por nombre). */
export async function importarFichas(fichas: FichaDirectorio[]) {
  const sb = supabaseCharlas();
  const { data: existentes } = await sb.from("charlas_centros").select("nombre");
  const ya = new Set((existentes ?? []).map((c) => c.nombre as string));
  const nuevas = fichas.filter((f) => !ya.has(f.nombre));
  let insertados = 0;
  const errores: string[] = [];
  for (let i = 0; i < nuevas.length; i += 100) {
    const lote = nuevas.slice(i, i + 100);
    const { data, error } = await sb
      .from("charlas_centros")
      .insert(lote.map((f) => ({ nombre: f.nombre, ...f.frontmatter, notas: null, secciones_extra: {}, actualizado_por: "sistema" })))
      .select("id, nombre");
    if (error) {
      errores.push(`lote ${i}: ${error.message}`);
      continue;
    }
    insertados += data.length;
    const idPorNombre = new Map(data.map((d) => [d.nombre as string, d.id as string]));
    const inter = lote
      .filter((f) => idPorNombre.has(f.nombre))
      .map((f) => ({ centro_id: idPorNombre.get(f.nombre), fecha: f.registro.fecha, canal: "Sistema", texto: f.registro.texto, orden: 0, origen: "sistema" }));
    if (inter.length) await sb.from("charlas_interacciones").insert(inter);
  }
  return { nuevas: nuevas.length, ya_existian: fichas.length - nuevas.length, insertados, errores };
}

/**
 * Resuelve la URL de descarga de un dataset de datos.gob.es (p. ej.
 * "a15002917-centros-educativos1"): busca una distribución CSV, y si no, XLSX.
 */
export async function urlDeDataset(idDataset: string): Promise<{ url: string; formato: string } | null> {
  const r = await fetch(`https://datos.gob.es/apidata/catalog/dataset/${encodeURIComponent(idDataset)}.json`, { headers: { accept: "application/json" } });
  if (!r.ok) return null;
  const j = (await r.json()) as { result?: { items?: { distribution?: unknown }[] } };
  const item = j.result?.items?.[0];
  const dists = ([] as Record<string, unknown>[]).concat((item?.distribution as Record<string, unknown>[]) ?? []);
  const leer = (d: Record<string, unknown>) => {
    const fmt = d.format as { value?: string } | string | undefined;
    const formato = String(typeof fmt === "object" && fmt ? fmt.value ?? "" : fmt ?? "").toLowerCase();
    const url = String(d.accessURL ?? d.downloadURL ?? "");
    return { formato, url };
  };
  const todas = dists.map(leer).filter((d) => d.url);
  const pref = ["csv", "xlsx", "tsv", "xls", "ods"];
  for (const p of pref) {
    const d = todas.find((x) => x.formato.includes(p) || x.url.toLowerCase().endsWith(`.${p}`));
    if (d) return { url: d.url, formato: p };
  }
  return todas[0] ? { url: todas[0].url, formato: todas[0].formato || "?" } : null;
}

export async function descargarTabla(url: string): Promise<{ contenido: Buffer; nombre: string; tipo: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; AlainZulaikaBot/1.0; +https://alainzulaika.com)" } });
  clearTimeout(t);
  if (!r.ok) throw new Error(`Descarga fallida (${r.status}) de ${url}`);
  const tipo = r.headers.get("content-type") ?? "";
  const contenido = Buffer.from(await r.arrayBuffer());
  if (contenido.length > 25_000_000) throw new Error("Fichero demasiado grande (>25 MB).");
  let nombre = url.split("?")[0].split("/").pop() || "directorio";
  if (!/\.[a-z0-9]{2,5}$/i.test(nombre)) nombre += /json/.test(tipo) ? ".json" : /sheet|excel/.test(tipo) ? ".xlsx" : /tab/.test(tipo) ? ".tsv" : ".csv";
  return { contenido, nombre, tipo };
}
