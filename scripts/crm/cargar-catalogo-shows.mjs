#!/usr/bin/env node
// Da de alta en crm_conocimiento (carril magia, tipo "catalogo") el catálogo de
// shows que leen la IA de Prospectos de magia y la de Charlas.
//
//   node scripts/crm/cargar-catalogo-shows.mjs            → solo altas (lo que ya existe no se toca)
//   node scripts/crm/cargar-catalogo-shows.mjs --simular  → enseña qué daría de alta, sin escribir
//
// Solo ALTAS: una vez creado, cada documento se edita en /admin › Magia ›
// Catálogo de shows (o desde la caja «Me falta información» de una tarjeta).
// Volver a ejecutar el script no pisa esas ediciones.
//
// Contenido de partida (11-11-2026, en lib/catalogo-inicial.json): sacado del vault (notas de 🎭 SHOWS,
// fichas de 📅 EVENTOS y presupuestos reales). Cada cifra lleva su fuente; lo
// que no está en el vault va como «SIN DATO» para que la IA no lo invente.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
const SIMULAR = process.argv.includes("--simular");
if (!URL || !KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY.");
  process.exit(1);
}

// El contenido inicial está en lib/catalogo-inicial.json (lo usa también el
// botón «Dar de alta el catálogo inicial» del panel).
const docs = JSON.parse(readFileSync(join(RAIZ, "lib", "catalogo-inicial.json"), "utf8")).map((d) => ({ ...d, carril: "magia", tipo: "catalogo", activo: true, actualizado_en: new Date().toISOString() }));

async function rest(ruta, opciones = {}) {
  const r = await fetch(`${URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: opciones.prefer ?? "return=minimal", ...(opciones.headers ?? {}) },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${texto}`);
  return texto.trim() ? JSON.parse(texto) : null;
}

const existentes = new Set(((await rest("crm_conocimiento?select=clave&carril=eq.magia", { prefer: "return=representation" })) ?? []).map((d) => d.clave));
const nuevos = docs.filter((d) => !existentes.has(d.clave));
const ya = docs.filter((d) => existentes.has(d.clave)).map((d) => d.clave);
if (SIMULAR) {
  console.log(`SIMULACIÓN · daría de alta ${nuevos.length}: ${nuevos.map((d) => d.clave).join(", ") || "(ninguno)"}${ya.length ? ` · ya existen (no se tocan): ${ya.join(", ")}` : ""}`);
  process.exit(0);
}
if (nuevos.length) await rest("crm_conocimiento", { method: "POST", body: JSON.stringify(nuevos) });
console.log(`Catálogo: ${nuevos.length} documentos dados de alta${nuevos.length ? ` (${nuevos.map((d) => d.clave).join(", ")})` : ""}${ya.length ? ` · ya existían y no se han tocado: ${ya.join(", ")}` : ""}`);
