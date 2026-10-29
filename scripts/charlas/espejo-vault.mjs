#!/usr/bin/env node
// Espejo Supabase → vault del CRM de charlas.
//
// Reescribe las fichas de Centros/ a partir de charlas_centros y
// charlas_interacciones, con el mismo frontmatter y el mismo Registro que
// tenían. Dirección única: lo que está en Supabase manda. Si en el vault hay
// una línea de Registro que no está en Supabase (Alain la apuntó a mano), no
// se pisa: se sube como interacción de origen 'manual' y luego se escribe.
//
// Uso:
//   node scripts/charlas/espejo-vault.mjs --comprobar   # solo compara, no escribe
//   node scripts/charlas/espejo-vault.mjs               # escribe las fichas
//
// Variables (de .env.local del proyecto, o del entorno):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   VAULT_CHARLAS_DIR  → ruta a ".../🗂️ COMERCIAL/Vías/Charlas"
//
// Sin dependencias: usa fetch contra la API REST de Supabase y escribe el
// YAML a mano (el esquema del frontmatter es plano y fijo).

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");

// --- entorno ---------------------------------------------------------------
function cargarEnv() {
  const ruta = join(RAIZ, ".env.local");
  if (!existsSync(ruta)) return;
  for (const linea of readFileSync(ruta, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
cargarEnv();

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const VAULT = process.env.VAULT_CHARLAS_DIR;
const COMPROBAR = process.argv.includes("--comprobar");

function comprobarEntorno() {
  if (!URL || !KEY) {
    console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY.");
    process.exit(1);
  }
  if (!VAULT || !existsSync(join(VAULT, "Centros"))) {
    console.error("VAULT_CHARLAS_DIR no apunta a la carpeta Charlas del vault (debe contener Centros/).");
    process.exit(1);
  }
}

// --- Supabase REST -----------------------------------------------------------
async function rest(ruta, opciones = {}) {
  const r = await fetch(`${URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: opciones.method === "POST" ? "return=minimal" : "count=exact",
      ...(opciones.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

async function todas(tabla, select = "*", orden = "") {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const lote = await rest(`${tabla}?select=${encodeURIComponent(select)}${orden ? `&order=${orden}` : ""}`, {
      headers: { Range: `${desde}-${desde + 999}` },
    });
    filas.push(...lote);
    if (lote.length < 1000) break;
  }
  return filas;
}

// --- YAML a mano -----------------------------------------------------------------
const ORDEN = [
  "codigo", "territorio", "localidad", "tipo", "tipo_centro", "modelo_linguistico", "euskera", "etapas",
  "etapas_confirmadas", "direccion", "telefono", "email_centro", "web", "prioridad", "estado", "origen", "via",
  "responsable", "responsable_cargo", "responsable_email", "responsable_tel", "ampa", "ampa_contacto", "ampa_email",
  "calendario_abierto", "intentos_llamada", "mails_enviados", "fecha_ultimo_contacto", "proxima_accion",
  "bloqueado_por", "fecha_proxima_accion", "fecha_creacion", "ficha_cliente",
];
const OPCIONALES = new Set(["via", "bloqueado_por", "ficha_cliente"]);
const SIEMPRE_COMILLAS = new Set(["codigo", "telefono", "ficha_cliente"]);
const NUMERICOS = new Set(["intentos_llamada", "mails_enviados"]);

function escalar(clave, v) {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v);
  if (NUMERICOS.has(clave)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) && clave.startsWith("fecha")) return s;
  const necesita =
    SIEMPRE_COMILLAS.has(clave) ||
    /[:#\[\]{}&*!|>'"%@`,]/.test(s) ||
    /^[\s-?]/.test(s) ||
    /\s$/.test(s) ||
    /^(true|false|null|yes|no|on|off|~)$/i.test(s) ||
    /^[\d.+-]+$/.test(s);
  return necesita ? `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : s;
}

function frontmatter(c) {
  const lineas = ["---", "tags:", "  - centro"];
  for (const k of ORDEN) {
    const v = c[k];
    if (OPCIONALES.has(k) && (v === null || v === undefined || v === "")) continue;
    if (k === "etapas") {
      const et = Array.isArray(v) ? v : [];
      if (et.length === 0) lineas.push("etapas: []");
      else {
        lineas.push("etapas:");
        for (const e of et) lineas.push(`  - ${e}`);
      }
      continue;
    }
    const s = escalar(k, v);
    lineas.push(s === "" ? `${k}:` : `${k}: ${s}`);
  }
  lineas.push("---");
  return lineas.join("\n");
}

function lineaRegistro(r) {
  if (r.raw && r.origen === "vault") return r.raw;
  const fecha = r.fecha ?? "";
  const canal = r.canal ? ` · ${r.canal}` : "";
  const texto = (r.texto ?? "").replace(/\n/g, "\n    ");
  return `- ${fecha}${canal} · ${texto}`;
}

function ficha(c, registro) {
  const vault = registro.filter((r) => r.origen === "vault").sort((a, b) => a.orden - b.orden);
  const resto = registro
    .filter((r) => r.origen !== "vault")
    .sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? "") || a.creado_en.localeCompare(b.creado_en));
  const lineas = [...vault, ...resto].map(lineaRegistro);

  let cuerpo = `${frontmatter(c)}\n\n## Registro\n\n${lineas.join("\n")}\n\n## Notas\n\n${c.notas ?? ""}`;
  for (const [titulo, texto] of Object.entries(c.secciones_extra ?? {})) {
    cuerpo += `\n\n${titulo}\n\n${texto}`;
  }
  return cuerpo.replace(/\s+$/, "") + "\n";
}

// --- lectura de la ficha actual (para comparar y para rescatar apuntes a mano) ---
function partir(texto) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(texto);
  if (!m) return { fm: {}, cuerpo: texto };
  const fm = {};
  let lista = null;
  for (const l of m[1].split("\n")) {
    const li = /^\s+-\s*(.*)$/.exec(l);
    if (li && lista) {
      fm[lista].push(li[1].trim());
      continue;
    }
    const kv = /^([a-zA-Z_]+):\s*(.*)$/.exec(l);
    if (!kv) continue;
    const [, k, v] = kv;
    if (v === "" && (k === "etapas" || k === "tags")) {
      fm[k] = [];
      lista = k;
      continue;
    }
    lista = null;
    fm[k] = v === "[]" ? [] : v.replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"');
  }
  return { fm, cuerpo: m[2] };
}

function registroDe(cuerpo) {
  const m = /## Registro\n([\s\S]*?)(?=\n## |$)/.exec(cuerpo);
  if (!m) return [];
  return m[1]
    .split("\n")
    .filter((l) => l.trim().startsWith("-"))
    .map((l) => l.trimEnd());
}

function normal(v, clave) {
  if (v === null || v === undefined) return clave && NUMERICOS.has(clave) ? "0" : "";
  if (Array.isArray(v)) return v.join("|");
  const s = String(v).trim();
  return clave && NUMERICOS.has(clave) && s === "" ? "0" : s;
}

// --- principal -------------------------------------------------------------------
async function main() {
  comprobarEntorno();
  const [centros, interacciones] = await Promise.all([
    todas("charlas_centros", "*", "nombre"),
    todas("charlas_interacciones", "*", "centro_id,fecha,orden"),
  ]);
  const porCentro = new Map();
  for (const i of interacciones) {
    if (!porCentro.has(i.centro_id)) porCentro.set(i.centro_id, []);
    porCentro.get(i.centro_id).push(i);
  }

  const dir = join(VAULT, "Centros");
  const enVault = new Set(readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)));

  let iguales = 0;
  let distintas = 0;
  let nuevas = 0;
  const apuntesManuales = [];
  const diferencias = [];

  for (const c of centros) {
    const ruta = join(dir, `${c.nombre}.md`);
    const registro = porCentro.get(c.id) ?? [];
    enVault.delete(c.nombre);

    if (!existsSync(ruta)) {
      nuevas++;
      if (!COMPROBAR) writeFileSync(ruta, ficha(c, registro), "utf8");
      continue;
    }

    const actual = readFileSync(ruta, "utf8");
    const { fm, cuerpo } = partir(actual);

    // Líneas del Registro escritas a mano desde la última importación: no
    // están en Supabase. Se suben como 'manual' antes de reescribir.
    const conocidas = new Set(registro.map((r) => (r.raw ?? "").trimEnd()).filter(Boolean));
    const conocidasTexto = new Set(registro.map((r) => lineaRegistro(r).trimEnd()));
    for (const l of registroDe(cuerpo)) {
      if (conocidas.has(l) || conocidasTexto.has(l)) continue;
      const m = /^-\s*(\d{4}-\d{2}-\d{2})?\s*(?:[·\-]\s*)?(.*)$/.exec(l.trim());
      const nueva = {
        centro_id: c.id,
        fecha: m?.[1] ?? null,
        canal: "Manual",
        texto: (m?.[2] ?? l).trim(),
        raw: l,
        orden: 900 + apuntesManuales.length,
        origen: "manual",
      };
      apuntesManuales.push(nueva);
      registro.push({ ...nueva, creado_en: new Date().toISOString() });
    }

    // Comparación semántica: mismo frontmatter (normalizado) y mismas líneas.
    const difs = [];
    for (const k of ORDEN) {
      const esperado = normal(c[k], k);
      const real = normal(fm[k], k);
      if (esperado !== real) difs.push(`${k}: vault="${real}" · db="${esperado}"`);
    }
    const nuevo = ficha(c, registro);
    const regVault = registroDe(cuerpo).map((l) => l.trim());
    const regNuevo = registroDe(nuevo.split("\n---\n")[1] ?? nuevo).map((l) => l.trim());
    if (regVault.join("\n") !== regNuevo.join("\n")) {
      difs.push(`registro: ${regVault.length} líneas en vault, ${regNuevo.length} generadas`);
    }

    if (difs.length === 0) iguales++;
    else {
      distintas++;
      diferencias.push({ nombre: c.nombre, difs });
    }

    if (!COMPROBAR && nuevo !== actual) writeFileSync(ruta, nuevo, "utf8");
  }

  if (!COMPROBAR && apuntesManuales.length) {
    await rest("charlas_interacciones", { method: "POST", body: JSON.stringify(apuntesManuales) });
  }

  console.log(
    `${centros.length} centros en Supabase · ${iguales} fichas iguales · ${distintas} con diferencias · ${nuevas} nuevas` +
      ` · ${apuntesManuales.length} apuntes a mano ${COMPROBAR ? "detectados" : "subidos"}` +
      (enVault.size ? ` · ${enVault.size} fichas en el vault que no están en Supabase: ${[...enVault].slice(0, 5).join(", ")}` : "")
  );
  for (const d of diferencias.slice(0, 15)) {
    console.log(`\n· ${d.nombre}`);
    for (const x of d.difs) console.log(`    ${x}`);
  }
  if (diferencias.length > 15) console.log(`\n… y ${diferencias.length - 15} más.`);
  if (COMPROBAR) console.log("\n(modo --comprobar: no se ha escrito nada)");
}

export { ficha, frontmatter, partir, registroDe, lineaRegistro, normal, ORDEN };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
