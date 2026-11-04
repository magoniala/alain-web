#!/usr/bin/env node
// Importa las fichas de Prospectos/ (CRM de magia del vault) en Supabase
// (tabla crm_fichas, carril "magia"), con su Registro en crm_interacciones.
//
//   node scripts/crm/importar-prospectos.mjs [ruta a Prospectos/]
//
// Sin ruta, la deduce de VAULT_CHARLAS_DIR (…/Vías/Charlas → ../../Prospectos).
// Idempotente: las fichas se actualizan por nombre y el Registro que viene del
// vault se reemplaza; lo que haya apuntado el sistema o el panel no se toca.
// Igual que importar-directo.mjs para charlas.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { filaDesdeFicha } from "./prospectos-lib.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const envPath = join(RAIZ, ".env.local");
if (existsSync(envPath)) {
  for (const l of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const DIR = process.argv[2] ?? (process.env.VAULT_CHARLAS_DIR ? join(process.env.VAULT_CHARLAS_DIR, "..", "..", "Prospectos") : null);
if (!URL || !KEY || !DIR || !existsSync(DIR)) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY o la carpeta Prospectos/ (pásala como argumento o define VAULT_CHARLAS_DIR).");
  process.exit(1);
}

async function rest(ruta, opciones = {}) {
  const r = await fetch(`${URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: opciones.prefer ?? "return=representation", ...(opciones.headers ?? {}) },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${texto}`);
  return texto.trim() ? JSON.parse(texto) : null;
}

const ficheros = readdirSync(DIR).filter((f) => f.endsWith(".md"));
const filas = [];
const registros = new Map();
for (const f of ficheros) {
  let leido;
  try {
    leido = filaDesdeFicha(f.slice(0, -3), readFileSync(join(DIR, f), "utf8"));
  } catch (e) {
    console.error(`  ${f}: ${e.message}`);
    continue;
  }
  filas.push(leido.fila);
  registros.set(leido.fila.nombre, leido.registro);
}

let nuevas = 0;
let actualizadas = 0;
const existentes = new Map(((await rest("crm_fichas?select=id,nombre&carril=eq.magia")) ?? []).map((c) => [c.nombre, c.id]));
const idPorNombre = new Map(existentes);
// PostgREST exige las mismas claves en todo el lote: con ?columns= las que
// falten en una ficha toman el valor por defecto de la columna.
const columnas = [...new Set(filas.flatMap((f) => Object.keys(f)))].join(",");
for (let i = 0; i < filas.length; i += 50) {
  const lote = filas.slice(i, i + 50);
  const data = await rest(`crm_fichas?on_conflict=carril,nombre&columns=${columnas}`, { method: "POST", prefer: "resolution=merge-duplicates,return=representation", body: JSON.stringify(lote) });
  for (const d of data ?? []) {
    existentes.has(d.nombre) ? actualizadas++ : nuevas++;
    idPorNombre.set(d.nombre, d.id);
  }
}

const ids = [...idPorNombre.values()];
for (let i = 0; i < ids.length; i += 100) {
  await rest(`crm_interacciones?origen=eq.vault&ficha_id=in.(${ids.slice(i, i + 100).join(",")})`, { method: "DELETE", prefer: "return=minimal" });
}
const inter = [];
for (const [nombre, reg] of registros) {
  const id = idPorNombre.get(nombre);
  if (!id) continue;
  for (const r of reg) inter.push({ ficha_id: id, fecha: r.fecha, canal: r.canal, texto: r.texto, raw: r.raw, orden: r.orden, origen: "vault" });
}
for (let i = 0; i < inter.length; i += 300) await rest("crm_interacciones", { method: "POST", prefer: "return=minimal", body: JSON.stringify(inter.slice(i, i + 300)) });

console.log(`${filas.length} fichas leídas · ${nuevas} nuevas · ${actualizadas} actualizadas · ${inter.length} líneas de registro`);
