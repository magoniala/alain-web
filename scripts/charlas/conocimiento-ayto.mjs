#!/usr/bin/env node
// Protocolo de la vía Ayuntamientos: vault → Supabase (charlas_conocimiento).
//
// Sube el flujo y los mails de Vías/Ayuntamientos al conocimiento con el que
// redacta la IA del carril charlas. El vault manda: si Alain cambia un texto
// en Obsidian, la IA lo usa desde la siguiente pasada horaria del espejo
// (espejo-vault.mjs llama aquí). Solo sube lo que ha cambiado.
//
// Uso suelto:
//   node scripts/charlas/conocimiento-ayto.mjs --comprobar   # dice qué subiría
//   node scripts/charlas/conocimiento-ayto.mjs               # sube

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Fichero → (clave, tipo, orden). Mismas claves que lee la IA (lib/charlas-ia.ts).
export const FICHEROS_AYTO = {
  "00 Flujo ayuntamientos.md": ["ayto_flujo", "guion", 60],
  "Ayuntamientos · Mails.md": ["ayto_mails", "guion", 61],
};

// Igual que cargar-conocimiento.mjs: fuera el frontmatter y los enlaces de Obsidian.
function limpiar(t) {
  return t
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/!\[\[[^\]]+\]\]/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .trim();
}

export async function subirConocimientoAyto({ url, key, vaultCharlas, comprobar = false }) {
  const dir = join(vaultCharlas, "..", "Ayuntamientos");
  const cab = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const claves = Object.values(FICHEROS_AYTO).map(([c]) => c);
  const r = await fetch(`${url}/rest/v1/charlas_conocimiento?select=clave,texto&clave=in.(${claves.join(",")})`, { headers: cab });
  if (!r.ok) throw new Error(`charlas_conocimiento: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const enBase = new Map((await r.json()).map((f) => [f.clave, f.texto]));

  const informe = { subidos: [], iguales: 0, faltan: [] };
  const filas = [];
  for (const [fichero, [clave, tipo, orden]] of Object.entries(FICHEROS_AYTO)) {
    const ruta = join(dir, fichero);
    if (!existsSync(ruta)) { informe.faltan.push(fichero); continue; }
    const texto = limpiar(readFileSync(ruta, "utf8"));
    if (enBase.get(clave) === texto) { informe.iguales++; continue; }
    filas.push({ clave, titulo: fichero.replace(/\.md$/, ""), tipo, orden, texto, activo: true, actualizado_en: new Date().toISOString() });
    informe.subidos.push(fichero);
  }
  if (filas.length && !comprobar) {
    const w = await fetch(`${url}/rest/v1/charlas_conocimiento?on_conflict=clave`, {
      method: "POST",
      headers: { ...cab, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(filas),
    });
    if (!w.ok) throw new Error(`charlas_conocimiento (escribir): ${w.status} ${(await w.text()).slice(0, 200)}`);
  }
  return informe;
}

export function resumenConocimientoAyto(inf, comprobar) {
  const verbo = comprobar ? "subiría" : "subidos";
  const partes = [`${inf.subidos.length} ${verbo}${inf.subidos.length ? ` (${inf.subidos.join(", ")})` : ""}`, `${inf.iguales} sin cambios`];
  if (inf.faltan.length) partes.push(`faltan en el vault: ${inf.faltan.join(", ")}`);
  return `Protocolo ayuntamientos vault → Supabase: ${partes.join(" · ")}`;
}

// --- uso suelto ---------------------------------------------------------------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const env = join(raiz, ".env.local");
  if (existsSync(env)) {
    for (const l of readFileSync(env, "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  const comprobar = process.argv.includes("--comprobar");
  subirConocimientoAyto({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY, vaultCharlas: process.env.VAULT_CHARLAS_DIR, comprobar })
    .then((inf) => console.log(resumenConocimientoAyto(inf, comprobar)))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
