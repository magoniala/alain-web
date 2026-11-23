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
//   Castilla y León (mapeo propio, con filtro propio):
//       … previsualizar|importar _directorios/directorio-cyl-2026.csv --territorio "Castilla y León" --provincia Burgos,Palencia,Soria
//       --provincia (lista separada por comas) filtra por la columna PROVINCIA; solo vale con mapeos que la tengan.
//       → crea las fichas en Supabase (estado "0 Por llamar"). Idempotente por nombre: lo que ya existe no se duplica.
//
// Los mapeos están abajo (MAPEOS). Cada uno dice qué columna del fichero
// alimenta cada campo de la ficha; admite varias candidatas por campo, y se
// usa la primera que exista. Si un fichero trae columnas distintas, se añade
// un mapeo nuevo o se ajusta: "inspeccionar" enseña los nombres exactos.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readSheet } from "read-excel-file/node";
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
// Junta de Castilla y León · directorio de centros docentes (CSV Latin-1, ";").
// Sin columna de enseñanzas: el filtro y las etapas salen del tipo de centro (ver PERFILES).
MAPEOS["castilla-leon"] = {
  codigo: ["codigo"],
  nombre: ["denominacion especifica"],
  tipo_centro: ["denominacion generica breve"],
  titularidad: ["naturaleza"],
  provincia: ["provincia"],
  localidad: ["localidad"],
  via: ["via"],
  nombre_via: ["nombre de la via"],
  numero: ["numero"],
  cp: ["c postal"],
  telefono: ["telefono"],
  email: ["correo electronico"],
  web: ["web"],
  concierto: ["concierto"],
  ensenanza: [],
  modalidad: [],
};

// Cómo se ponen en minúsculas los nombres en MAYÚSCULAS del directorio de CyL.
const PEQUENAS = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "o", "u", "en", "a", "al", "con", "por", "para"]);
const aTitulo = (s) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .map((w, i) => {
      if (i > 0 && PEQUENAS.has(w)) return w;
      if (/^(i{1,3}|iv|vi{1,3}|ix)$/.test(w)) return w.toUpperCase();
      return w.replace(/(^|[-'’(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
    })
    .join(" ");
// «VIRGEN DEL CAMINO (LA)» → «La Virgen del Camino»
const localidadCyL = (s) => {
  const m = /^(.*?)\s*\((LA|EL|LOS|LAS)\)$/i.exec(String(s ?? "").trim());
  return aTitulo(m ? `${m[2]} ${m[1]}` : s);
};

// Perfiles propios por mapeo: sustituyen al filtro genérico y fijan nombre, dirección y etapas.
const PERFILES = {
  "castilla-leon": {
    // IES, IESO y CEO (públicos, llevan ESO) y «Colegio» privado concertado (CONCIERTO = S).
    // Fuera: CEIP, EEI, EM, CEE, CEPA, EOI, CIFP, CPrFP, CPrEI, conservatorios, escuelas de arte, deportivos…
    filtro: (f) => {
      const t = f.tipo_centro.trim().toUpperCase();
      if (["IES", "IESO", "CEO"].includes(t)) return true;
      return t === "COLEGIO" && norm(f.titularidad) === "privado" && f.concierto.trim().toUpperCase() === "S";
    },
    esConcertado: (f) => f.tipo_centro.trim().toUpperCase() === "COLEGIO",
    // Convención de La Rioja: «<tipo> <nombre> (<localidad>)», p. ej. «IES Tomás Mingot (Logroño)».
    nombre: (f) => {
      const esp = aTitulo(f.nombre);
      const tipo = f.tipo_centro.trim();
      const base = new RegExp(`^${tipo}\\b`, "i").test(esp) ? esp : `${tipo} ${esp}`;
      return `${base} (${localidadCyL(f.localidad)})`;
    },
    localidad: (f) => localidadCyL(f.localidad),
    direccion: (f) => {
      const via = /^(calle|c\/?)$/i.test(f.via.trim()) ? "" : f.via.trim();
      const calle = aTitulo([via, f.nombre_via].filter(Boolean).join(" "));
      const cp = f.cp.trim() ? f.cp.trim().padStart(5, "0") : ""; // el CSV pierde el cero de Burgos, Soria…
      return [[calle, f.numero.trim()].filter(Boolean).join(", "), cp, localidadCyL(f.localidad)].filter(Boolean).join(", ");
    },
    // IES: ESO + Bachillerato; IESO y CEO: ESO. Públicos: confirmadas por la propia denominación.
    // Colegios concertados: el directorio no dice si llevan ESO → etapas_confirmadas = "no".
    etapas: (f) => (f.tipo_centro.trim().toUpperCase() === "IES" ? ["ESO", "Bachillerato"] : ["ESO"]),
  },
};

// Qué filas interesan: imparten ESO o Bachillerato. Si el fichero dice qué
// enseñanzas da el centro, manda eso; si no lo dice, se mira el tipo y el nombre.
const SECUNDARIA = /\b(eso|e s o|secundaria|bachiller|bachillerato|dbh|batxilergo)\b/;
const TIENE_SECUNDARIA = (fila) => {
  const ens = norm(fila.ensenanza);
  if (ens) return SECUNDARIA.test(ens);
  const t = norm(`${fila.tipo_centro} ${fila.nombre}`);
  return /\b(ies|instituto|secundaria|bhi|ikastetxea|cpeips|cpi|colegio)\b/.test(t) && !/\b(infantil|primaria|eei|cra|escuela)\b/.test(t);
};

// Mismo lector que lib/charlas-directorio.ts (el panel): CSV/TSV propio y XLSX con read-excel-file.
function parsearCSV(txt, sep) {
  const filas = [];
  let fila = [], campo = "", comillas = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (comillas) {
      if (ch === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else comillas = false; } else campo += ch;
      continue;
    }
    if (ch === '"' && campo === "") comillas = true;
    else if (ch === sep) { fila.push(campo); campo = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && txt[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((c) => c.trim() !== "")) filas.push(fila);
      fila = [];
    } else campo += ch;
  }
  fila.push(campo);
  if (fila.some((c) => c.trim() !== "")) filas.push(fila);
  return filas;
}
const aObjetos = (m) => {
  if (!m.length) return [];
  const cab = m[0].map((c, i) => String(c ?? "").trim() || `col${i + 1}`);
  return m.slice(1).map((f) => Object.fromEntries(cab.map((c, i) => [c, f[i] ?? ""])));
};
async function leerFichero(ruta) {
  const buf = readFileSync(ruta);
  if (buf[0] === 0x50 && buf[1] === 0x4b) return aObjetos(await readSheet(buf));
  let txt = buf.toString("utf8").replace(/^\uFEFF/, "");
  if (txt.includes("\uFFFD")) txt = buf.toString("latin1");
  const primera = txt.split(/\r?\n/)[0] ?? "";
  return aObjetos(parsearCSV(txt, primera.includes("\t") ? "\t" : primera.includes(";") ? ";" : ","));
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

function aFichas(filas, territorio, perfil = null) {
  const vistos = new Set();
  const fichas = [];
  for (const f of filas) {
    if (!f.nombre) continue;
    if (!(perfil ? perfil.filtro(f) : TIENE_SECUNDARIA(f))) continue;
    const nombre = perfil ? perfil.nombre(f) : f.nombre.replace(/\s+/g, " ").trim();
    const concertado = perfil?.esConcertado?.(f) ?? false;
    const clave = norm(nombre + " " + f.localidad);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const email = (f.email.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/) ?? [""])[0].toLowerCase();
    fichas.push({
      nombre,
      provincia: f.provincia ?? "",
      frontmatter: {
        codigo: f.codigo || null,
        territorio,
        localidad: (perfil ? perfil.localidad(f) : f.localidad) || null,
        tipo: tipoDesde(f.titularidad, f.tipo_centro, nombre),
        tipo_centro: f.tipo_centro || null,
        modelo_linguistico: f.modalidad || null,
        euskera: euskeraDesde(f.modalidad, f.ensenanza, territorio),
        etapas: perfil ? perfil.etapas(f) : /bachiller|batxilergo/.test(norm(f.ensenanza)) ? ["ESO", "Bachillerato"] : ["ESO"],
        etapas_confirmadas: perfil ? (concertado ? "no" : "sí") : f.ensenanza ? "sí" : "no",
        direccion: (perfil ? perfil.direccion(f) : [f.direccion, f.cp, f.localidad].filter(Boolean).join(", ")) || null,
        telefono: f.telefono.replace(/\D/g, "") || null,
        email_centro: email || null,
        web: f.web || null,
        estado: "0 Por llamar",
        origen: `directorio oficial ${territorio}`,
        intentos_llamada: 0,
        mails_enviados: 0,
        fecha_creacion: new Date().toISOString().slice(0, 10),
      },
      registro: [{ fecha: new Date().toISOString().slice(0, 10), canal: "Sistema", texto: `Ficha generada desde el directorio oficial de ${territorio}${f.codigo ? ` (código ${f.codigo})` : ""}; ${concertado ? "colegio concertado: el directorio no dice si imparte ESO, etapas por confirmar" : "etapas según el directorio"}.`, raw: null }],
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
    console.log("Uso: inspeccionar <fichero> | previsualizar <fichero> --territorio X [--mapeo navarra|cantabria|recd|castilla-leon] [--provincia A,B] | importar <fichero> --territorio X [--mapeo …]");
    process.exit(1);
  }
  const filas = await leerFichero(ruta);
  if (orden === "inspeccionar") {
    console.log(`${filas.length} filas. Columnas:`);
    for (const c of Object.keys(filas[0] ?? {})) console.log(`  - ${c}`);
    console.log("\nMuestra:");
    for (const f of filas.slice(0, 3)) console.log(JSON.stringify(f, null, 1));
    return;
  }
  const territorio = arg("--territorio");
  if (!territorio) throw new Error("Falta --territorio");
  const tNorm = norm(territorio);
  const mapeoNombre = arg("--mapeo", tNorm === "navarra" ? "navarra" : tNorm === "castilla y leon" ? "castilla-leon" : "cantabria");
  const mapeo = MAPEOS[mapeoNombre];
  if (!mapeo) throw new Error(`Mapeo desconocido: ${mapeoNombre}`);

  const { col, filas: mapeadasTodas } = aplicarMapeo(filas, mapeo);
  console.log("Columnas usadas:", JSON.stringify(col));
  let mapeadas = mapeadasTodas;
  const provincias = (arg("--provincia") ?? "").split(",").map((p) => norm(p)).filter(Boolean);
  if (provincias.length) {
    if (!col.provincia) throw new Error(`El mapeo ${mapeoNombre} no tiene columna de provincia: --provincia no vale`);
    mapeadas = mapeadasTodas.filter((f) => provincias.includes(norm(f.provincia)));
    console.log(`--provincia ${provincias.join(", ")}: ${mapeadas.length} de ${mapeadasTodas.length} filas.`);
  }
  const perfil = PERFILES[mapeoNombre] ?? null;
  const fichas = priorizar(aFichas(mapeadas, territorio, perfil));
  if (provincias.length) {
    const porProv = {};
    for (const f of fichas) porProv[f.provincia] = (porProv[f.provincia] ?? 0) + 1;
    console.log(`Por provincia: ${JSON.stringify(porProv)} · descartadas por el filtro: ${mapeadas.length - fichas.length}`);
  }
  const resumen = {};
  for (const f of fichas) resumen[f.frontmatter.tipo] = (resumen[f.frontmatter.tipo] ?? 0) + 1;
  console.log(`${filas.length} filas en el fichero → ${fichas.length} centros con secundaria · por tipo: ${JSON.stringify(resumen)} · con email: ${fichas.filter((f) => f.frontmatter.email_centro).length} · con teléfono: ${fichas.filter((f) => f.frontmatter.telefono).length}`);

  if (orden === "previsualizar") {
    for (const f of fichas.slice(0, 5)) console.log(JSON.stringify({ nombre: f.nombre, ...f.frontmatter }, null, 1));
    if (provincias.length) console.log("\nTodos los nombres:\n" + fichas.map((f) => `  ${f.provincia} · ${f.frontmatter.tipo} · ${f.nombre}${f.frontmatter.email_centro ? "" : "  [SIN CORREO]"}`).join("\n"));
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
