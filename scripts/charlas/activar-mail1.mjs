#!/usr/bin/env node
// Comprueba un territorio del CRM de charlas y, si tiene al menos 30 centros con correo,
// lo añade a `mail1_automatico_territorios` (charlas_config), como se hizo con Cantabria y La Rioja.
//
//   node scripts/charlas/activar-mail1.mjs "Castilla y León"            → solo informa (no cambia nada)
//   node scripts/charlas/activar-mail1.mjs "Castilla y León" --aplicar  → activa si llega al umbral
//
// No envía ni aprueba ninguna tarjeta: solo deja el territorio en la lista; las tarjetas las aprueba Alain en el panel.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const envPath = join(RAIZ, ".env.local");
if (existsSync(envPath)) {
  for (const l of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const UMBRAL = 30;
const territorio = process.argv[2];
const aplicar = process.argv.includes("--aplicar");
if (!territorio) { console.log('Uso: activar-mail1.mjs "<Territorio>" [--aplicar]'); process.exit(1); }

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data: centros, error } = await sb.from("charlas_centros").select("nombre, codigo, email_centro, estado, tipo").eq("territorio", territorio);
if (error) throw new Error(error.message);
const conCorreo = centros.filter((c) => c.email_centro);
console.log(`${territorio}: ${centros.length} fichas · ${conCorreo.length} con correo · estados: ${JSON.stringify(Object.fromEntries([...new Set(centros.map((c) => c.estado))].map((e) => [e, centros.filter((c) => c.estado === e).length])))}`);
// Castilla y León: el código de centro empieza por el de provincia (09 Burgos, 34 Palencia, 42 Soria).
const PROV = { "09": "Burgos", "34": "Palencia", "42": "Soria" };
const porProv = {};
for (const c of centros) { const p = PROV[String(c.codigo ?? "").slice(0, 2)] ?? "(sin provincia / sin código)"; porProv[p] = (porProv[p] ?? 0) + 1; }
console.log("Por provincia (según código):", JSON.stringify(porProv));

const { data: cfg } = await sb.from("charlas_config").select("valor").eq("clave", "mail1_automatico_territorios").maybeSingle();
const actual = Array.isArray(cfg?.valor) ? cfg.valor : [];
console.log("mail1_automatico_territorios ahora:", JSON.stringify(actual));
if (actual.includes(territorio)) { console.log("Ya está activado."); process.exit(0); }
if (conCorreo.length < UMBRAL) { console.log(`No llega al umbral (${UMBRAL}). No se activa.`); process.exit(0); }
if (!aplicar) { console.log(`Llega al umbral (${UMBRAL}). Falta --aplicar para activarlo.`); process.exit(0); }
const nuevo = [...actual, territorio];
const { error: e2 } = await sb.from("charlas_config").upsert({ clave: "mail1_automatico_territorios", valor: nuevo }, { onConflict: "clave" });
if (e2) throw new Error(e2.message);
console.log("Activado:", JSON.stringify(nuevo));
