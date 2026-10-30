#!/usr/bin/env node
// Importa un directorio oficial de centros (Navarra, Cantabria, Registro
// Estatal del Ministerio…) al CRM de charlas, con el mismo formato de ficha
// que las 348 de Euskadi.
//
// Uso:
//   node scripts/charlas/importar-directorio.mjs inspeccionar <fichero.csv|.xlsx>
//       → enseña las columnas y tres filas de muestra, para ajustar el mapeo.
//   node scripts/charlas/importar-directorio.mjs previsualizar <fichero> --territorio Navarra [--mapeo navarra]
//       → aplica el mapeo y enseña cuántos centros quedan tras filtrar (ESO/Bach) y una muestra. No toca Supabase.
//   node scripts/charlas/importar-directorio.mjs importar <fichero> --territorio Navarra [--mapeo navarra] [--prioridad-publicos]
//       → crea las fichas en Supabase (estado "0 Por llamar"). Idempotente por nombre: lo que ya existe no se duplica.
//
// Los mapeos están abajo (MAPEOS). Cada uno dice qué columna del fichero
// alimenta cada campo de la ficha; admite varias candidatas por campo, y se
// usa la primera que exista. Si un fichero trae columnas distintas, se añade
// un mapeo nuevo o se ajusta: "inspeccionar" enseña los nombres exactos.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const XLSX = createRequire(import.meta.url)("xlsx");
import { createClient } from "@supabase/supabase-js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const envPath = join(RAIZ, ".env.local");
if (existsSync(envPath)) {
  for (const l of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const norm = (s) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Campos de la ficha → columnas candidatas (normalizadas) en los ficheros.
const MAPEOS = {
  // Open Data Navarra · "Centros educativos" (CSV/XLSX de datos.gob.es)
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
  // ICANE Cantabria / Registro Estatal de Centros Docentes (Ministerio)
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

// Qué filas interesan: imparten ESO o Bachillerato. Si el fichero dice qué
// enseñanzas da el centro, manda eso; si no lo dice, se mira el tipo y el nombre.
const SECUNDARIA = /\b(eso|e s o|secundaria|bachiller|bachillerato|dbh|batxilergo)\b/;
const TIENE_SECUNDARIA = (fila) => {
  const ens = norm(fila.ensenanza);
  if (ens) return SECUNDARIA.test(ens);
  const t = norm(`${fila.tipo_centro} ${fila.nombre}`);
  return /\b(ies|instituto|secundaria|bhi|ikastetxea|cpeips|cpi|colegio)\b/.test(t) && !/\b(infantil|primaria|eei|cra|escuela)\b/.test(t);
};

function leerFichero(ruta) {
  // CSV con ; (lo habitual en los portales españoles) o , ; XLS/XLSX tal cual.
  const wb = ruta.toLowerCase().endsWith(".csv")
    ? XLSX.read(readFileSync(ruta, "utf8"), { type: "string", FS: readFileSync(ruta, "utf8").split("\n")[0].includes(";") ? ";" : "," })
    : XLSX.readFile(ruta, { raw: false });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });
  return filas;
}

function aplicarMapeo(filas, mapeo) {
  if (!filas.length) return [];
  const columnas = Object.keys(filas[0]);
  const colNorm = new Map(columnas.map((c) => [norm(c), c]));
  const elegir = (candidatas) => {
    for (const cand of candidatas) {
      const exacta = colNorm.get(cand);
      if (exacta) return exacta;
    }
    for (const cand of candidatas) {
      const parcial = [...colNorm.entries()].find(([n]) => n.includes(cand));
      if (parcial) return parcial[1];
    }
    return null;
  };
  const col = Object.fromEntries(Object.entries(mapeo).map(([campo, cands]) => [campo, elegir(cands)]));
  return { col, filas: filas.map((f) => Object.fromEntries(Object.entries(col).map(([campo, c]) => [campo, c ? String(f[c] ?? "").trim() : ""]))) };
}

function tipoDesde(titularidad, tipo_centro, nombre) {
  const t = norm(`${titularidad} ${tipo_centro} ${nombre}`);
  if (/\b(ikastola)\b/.test(t)) return "ikastola";
  if (/\b(publico|publica|ies|iesó|instituto|cpi|ceip|cp)\b/.test(t)) return "público";
  if (/\b(religios|salesian|jesuit|maristas|carmelit|escolap|dominic|claretian|sagrad|san |santa |la salle|corazon|compania de maria|teresian|ursulin|hijas|colegio diocesan|obispado|parroqui)\b/.test(t)) return "religioso";
  if (/\b(privado|privada|concertado|concertada|cooperativa)\b/.test(t)) return "privado";
  return "otro";
}

function euskeraDesde(modalidad, ensenanza, territorio) {
  const t = norm(`${modalidad} ${ensenanza}`);
  if (territorio === "Navarra") {
    if (/\bmodelo d\b|\bd\b.*euskera|euskera/.test(t)) return "sí";
    if (/\bmodelo a\b|\bmodelo b\b/.test(t)) return "parcial";
    return "no";
  }
  return "no";
}

function aFichas(filas, territorio) {
  const vistos = new Set();
  const fichas = [];
  for (const f of filas) {
    if (!f.nombre) continue;
    if (!TIENE_SECUNDARIA(f)) continue;
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
        fecha_creacion: new Date().toISOString().slice(0, 10),
      },
      registro: [{ fecha: new Date().toISOString().slice(0, 10), canal: "Sistema", texto: `Ficha generada desde el directorio oficial de ${territorio}${f.codigo ? ` (código ${f.codigo})` : ""}; etapas según el directorio.`, raw: null }],
      notas: "",
      secciones_extra: {},
    });
  }
  return fichas;
}

// Prioridad que pide el plan de noviembre: públicos y modelo D primero,
// religiosos al final. Se expresa en `prioridad` (A/B/C) y en el orden.
function priorizar(fichas) {
  const peso = (f) => (f.frontmatter.tipo === "público" ? 0 : f.frontmatter.tipo === "ikastola" ? 1 : f.frontmatter.tipo === "privado" ? 2 : f.frontmatter.tipo === "otro" ? 3 : 4) - (f.frontmatter.euskera === "sí" ? 0.5 : 0);
  for (const f of fichas) {
    const p = peso(f);
    f.frontmatter.prioridad = p <= 0.5 ? "A" : p <= 2 ? "B" : "C";
  }
  return fichas.sort((a, b) => peso(a) - peso(b) || a.nombre.localeCompare(b.nombre));
}

async function main() {
  const [orden, ruta, ...resto] = process.argv.slice(2);
  const arg = (k, d = null) => {
    const i = resto.indexOf(k);
    return i >= 0 ? resto[i + 1] : d;
  };
  if (!orden || !ruta) {
    console.log("Uso: inspeccionar <fichero> | previsualizar <fichero> --territorio X [--mapeo navarra|cantabria|recd] | importar <fichero> --territorio X [--mapeo …]");
    process.exit(1);
  }
  const filas = leerFichero(ruta);
  if (orden === "inspeccionar") {
    console.log(`${filas.length} filas. Columnas:`);
    for (const c of Object.keys(filas[0] ?? {})) console.log(`  - ${c}`);
    console.log("\nMuestra:");
    for (const f of filas.slice(0, 3)) console.log(JSON.stringify(f, null, 1));
    return;
  }
  const territorio = arg("--territorio");
  if (!territorio) throw new Error("Falta --territorio");
  const mapeoNombre = arg("--mapeo", territorio.toLowerCase() === "navarra" ? "navarra" : "cantabria");
  const mapeo = MAPEOS[mapeoNombre];
  if (!mapeo) throw new Error(`Mapeo desconocido: ${mapeoNombre}`);

  const { col, filas: mapeadas } = aplicarMapeo(filas, mapeo);
  console.log("Columnas usadas:", JSON.stringify(col));
  const fichas = priorizar(aFichas(mapeadas, territorio));
  const resumen = {};
  for (const f of fichas) resumen[f.frontmatter.tipo] = (resumen[f.frontmatter.tipo] ?? 0) + 1;
  console.log(`${filas.length} filas en el fichero → ${fichas.length} centros con secundaria · por tipo: ${JSON.stringify(resumen)} · con email: ${fichas.filter((f) => f.frontmatter.email_centro).length} · con teléfono: ${fichas.filter((f) => f.frontmatter.telefono).length}`);

  if (orden === "previsualizar") {
    for (const f of fichas.slice(0, 5)) console.log(JSON.stringify({ nombre: f.nombre, ...f.frontmatter }, null, 1));
    return;
  }
  if (orden !== "importar") throw new Error(`Orden desconocida: ${orden}`);

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { data: existentes } = await sb.from("charlas_centros").select("nombre");
  const ya = new Set((existentes ?? []).map((c) => c.nombre));
  const nuevas = fichas.filter((f) => !ya.has(f.nombre));
  console.log(`${nuevas.length} nuevas (${fichas.length - nuevas.length} ya existían).`);

  const filasDb = nuevas.map((f) => ({ nombre: f.nombre, ...f.frontmatter, notas: null, secciones_extra: {}, actualizado_por: "sistema" }));
  let insertados = 0;
  for (let i = 0; i < filasDb.length; i += 100) {
    const lote = filasDb.slice(i, i + 100);
    const { data, error } = await sb.from("charlas_centros").insert(lote).select("id, nombre");
    if (error) {
      console.error("Error en el lote", i, error.message);
      continue;
    }
    insertados += data.length;
    const idPorNombre = new Map(data.map((d) => [d.nombre, d.id]));
    const inter = nuevas
      .filter((f) => idPorNombre.has(f.nombre))
      .map((f) => ({ centro_id: idPorNombre.get(f.nombre), fecha: f.registro[0].fecha, canal: "Sistema", texto: f.registro[0].texto, orden: 0, origen: "sistema" }));
    if (inter.length) await sb.from("charlas_interacciones").insert(inter);
  }
  console.log(`${insertados} centros importados en Supabase (territorio ${territorio}). El espejo los escribirá en el vault en su próxima pasada.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
