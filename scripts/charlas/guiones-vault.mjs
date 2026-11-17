#!/usr/bin/env node
// Guiones de llamada de Charlas: vault → Supabase (charlas_guiones).
//
// Sube entero cada .md de Vías/Charlas/Guiones que el panel usa para llamar.
// El vault manda: si Alain cambia un guion en Obsidian, sale en el panel en
// la siguiente pasada horaria del espejo (espejo-vault.mjs llama aquí). Solo
// sube los que han cambiado. El panel trocea el texto (lib/charlas-guiones.ts).
//
// Uso suelto:
//   node scripts/charlas/guiones-vault.mjs --comprobar   # dice qué subiría
//   node scripts/charlas/guiones-vault.mjs               # sube

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Clave → fichero. La clave es la que usa el panel (GUIONES en lib/charlas-guiones.ts).
export const FICHEROS_GUIONES = {
  conserjeria: "Llamada conserjería.md",
  reenvio: "Llamada tras reenvío a orientación.md",
  "seguimiento-dossier": "Llamada seguimiento tras dossier.md",
  "cerrar-fecha": "Llamada para cerrar fecha.md",
  objeciones: "Objeciones.md",
};

export async function subirGuiones({ url, key, vaultCharlas, comprobar = false }) {
  const dir = join(vaultCharlas, "Guiones");
  const cab = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const r = await fetch(`${url}/rest/v1/charlas_guiones?select=clave,contenido_md`, { headers: cab });
  if (!r.ok) throw new Error(`charlas_guiones: ${r.status} ${(await r.text()).slice(0, 200)}${r.status === 404 ? " (¿falta aplicar sql/charlas_guiones.sql?)" : ""}`);
  const enBase = new Map((await r.json()).map((f) => [f.clave, f.contenido_md]));

  const informe = { subidos: [], iguales: 0, faltan: [] };
  const filas = [];
  for (const [clave, fichero] of Object.entries(FICHEROS_GUIONES)) {
    const ruta = join(dir, fichero);
    if (!existsSync(ruta)) { informe.faltan.push(fichero); continue; }
    const contenido = readFileSync(ruta, "utf8");
    if (enBase.get(clave) === contenido) { informe.iguales++; continue; }
    filas.push({ clave, fichero, contenido_md: contenido, actualizado_en: new Date().toISOString() });
    informe.subidos.push(fichero);
  }
  if (filas.length && !comprobar) {
    const w = await fetch(`${url}/rest/v1/charlas_guiones?on_conflict=clave`, {
      method: "POST",
      headers: { ...cab, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(filas),
    });
    if (!w.ok) throw new Error(`charlas_guiones (escribir): ${w.status} ${(await w.text()).slice(0, 200)}`);
  }
  return informe;
}

export function resumenGuiones(inf, comprobar) {
  const verbo = comprobar ? "subiría" : "subidos";
  const partes = [`${inf.subidos.length} ${verbo}${inf.subidos.length ? ` (${inf.subidos.join(", ")})` : ""}`, `${inf.iguales} sin cambios`];
  if (inf.faltan.length) partes.push(`faltan en el vault: ${inf.faltan.join(", ")}`);
  return `Guiones vault → Supabase: ${partes.join(" · ")}`;
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
  subirGuiones({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY, vaultCharlas: process.env.VAULT_CHARLAS_DIR, comprobar })
    .then((inf) => console.log(resumenGuiones(inf, comprobar)))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
