#!/usr/bin/env node
// Carga en crm_conocimiento (carril magia) los guiones del CRM comercial del
// vault: Guía comercial, flujos y plantillas de Antiguos / Recuperar /
// Intermediarios, Mensajes comunes, protocolo de fecha provisional, los
// recordatorios en uso en las tandas y, como ejemplos de estilo, los bloques
// "mensaje-listo" que Alain ha escrito en fichas concretas.
//
//   node scripts/crm/cargar-conocimiento-magia.mjs [ruta a COMERCIAL/]
//
// Sin ruta, la deduce de VAULT_CHARLAS_DIR (…/Vías/Charlas → ../..).

import { readFileSync, readdirSync, existsSync } from "node:fs";
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
const DIR = process.argv[2] ?? (process.env.VAULT_CHARLAS_DIR ? join(process.env.VAULT_CHARLAS_DIR, "..", "..") : null);
if (!URL || !KEY || !DIR || !existsSync(join(DIR, "Guía comercial.md"))) {
  console.error("Faltan credenciales o la carpeta COMERCIAL/ (con Guía comercial.md).");
  process.exit(1);
}

const leer = (rel) => {
  const p = join(DIR, rel);
  return existsSync(p) ? readFileSync(p, "utf8").replace(/^---[\s\S]*?---\n/, "") : null;
};
const docs = [];
const add = (clave, titulo, tipo, texto, orden) => texto && docs.push({ clave, carril: "magia", titulo, tipo, texto: texto.trim(), activo: true, orden, actualizado_en: new Date().toISOString() });

add("guia_comercial", "Guía comercial (estados, segmentos, reglas, niveles de cobro)", "guion", leer("Guía comercial.md"), 10);
add("flujo_antiguos", "Flujo — Antiguos clientes", "guion", leer("Vías/Antiguos clientes/00 Flujo antiguos.md"), 20);
add("antiguos_reactivacion", "Antiguos · Reactivación", "guion", leer("Vías/Antiguos clientes/Antiguos · Reactivación.md"), 21);
add("antiguos_recordatorios", "Antiguos · Recordatorios", "guion", leer("Vías/Antiguos clientes/Antiguos · Recordatorios.md"), 22);
add("antiguos_propuesta", "Antiguos · Propuesta y cierre", "guion", leer("Vías/Antiguos clientes/Antiguos · Propuesta y cierre.md"), 23);
add("antiguos_objeciones", "Antiguos · Objeciones", "guion", leer("Vías/Antiguos clientes/Antiguos · Objeciones.md"), 24);
add("flujo_recuperar", "Flujo — Recuperar", "guion", leer("Vías/Recuperar/00 Flujo recuperar.md"), 30);
add("recuperar_mensaje", "Recuperar · Mensaje", "guion", leer("Vías/Recuperar/Recuperar · Mensaje.md"), 31);
add("flujo_intermediarios", "Flujo — Intermediarios", "guion", leer("Vías/Intermediarios/00 Flujo intermediarios.md"), 40);
add("intermediarios_checkin", "Intermediarios · Check-in", "guion", leer("Vías/Intermediarios/Intermediarios · Check-in.md"), 41);
add("flujo_agencias", "Flujo — Agencias de eventos", "guion", leer("Vías/Agencias/00 Flujo agencias.md"), 42);
add("agencias_guion", "Agencias · Guion del primer mail (1-A, 1-B y seguimiento)", "guion", leer("Vías/Agencias/2026-11-05 Guion — primer mail a agencias.md"), 43);
add("agencias_investigacion", "Agencias · Investigación (qué piden a un mago y censo)", "guion", leer("Vías/Agencias/2026-11-05 Investigación agencias de eventos.md"), 44);
add("protocolo_fecha_provisional", "Protocolo — Fecha provisional", "guion", leer("Protocolo — Fecha provisional.md"), 45);

const comunesDir = join(DIR, "Mensajes comunes");
if (existsSync(comunesDir)) {
  const partes = readdirSync(comunesDir).filter((f) => f.endsWith(".md")).sort().map((f) => `## ${f.slice(0, -3)}\n\n${leer(join("Mensajes comunes", f))}`);
  add("mensajes_comunes", "Mensajes comunes (liberar fecha, seguimiento corto, cierre suave, seguimiento de propuesta, aviso fecha provisional)", "guion", partes.join("\n\n---\n\n"), 46);
}

// Recordatorios de las tandas de antiguos (los que usaba cerrar_tanda.py).
const tanda = leer("Vías/Antiguos clientes/_sistema/cerrar_tanda.py");
if (tanda) {
  const r1 = /R1 = (\{[\s\S]*?\})\n/.exec(tanda)?.[1];
  const r2 = /R2 = (\{[\s\S]*?\})\n/.exec(tanda)?.[1];
  const limpiar = (s) => (s ?? "").replace(/\\n/g, "\n").replace(/"eu": "/g, "**Euskaraz**\n").replace(/", "es": "/g, '\n\n**Castellano**\n').replace(/[{}"]/g, "");
  add(
    "tandas_recordatorios",
    "Recordatorios en uso en las tandas de antiguos (textos reales)",
    "ejemplos",
    `Textos que salían automáticamente en las tandas de antiguos clientes (cerrar_tanda.py). Son los recordatorios que Alain da por buenos.\n\n## Recordatorio 1 (4 días laborables después de la reactivación)\n${limpiar(r1)}\n\n## Recordatorio 2, el último (7 días después)\n${limpiar(r2)}\n\nReglas de la tanda: los particulares que pidieron recomendación no se persiguen (9 Aparcado directo); sin respuesta tras el R2 → 9 Aparcado, 2 meses antes de su temporada.`,
    47
  );
}

// Ejemplos de estilo: bloques "mensaje-listo" escritos por Alain en fichas concretas.
const prospDir = join(DIR, "Prospectos");
if (existsSync(prospDir)) {
  const bloques = [];
  for (const f of readdirSync(prospDir).filter((x) => x.endsWith(".md"))) {
    const t = readFileSync(join(prospDir, f), "utf8");
    const m = /<!-- mensaje-listo -->\n([\s\S]*?)<!-- \/mensaje-listo -->/.exec(t);
    if (m) bloques.push(`## ${f.slice(0, -3)}\n\n${m[1].trim()}`);
  }
  if (bloques.length) add("ejemplos_mensajes_listos", "Mensajes escritos por Alain en fichas de magia (ejemplos de voz y tono)", "ejemplos", `Mensajes y guiones que Alain dejó listos en fichas concretas. Son la referencia de cómo escribe a clientes de magia: cercano, concreto, con los precios siempre "+ IVA" y sin bajar de precio (si duda, reduce el compromiso, no el precio).\n\n${bloques.join("\n\n---\n\n")}`, 80);
}

add(
  "reglas_aprendidas",
  "Reglas aprendidas de las correcciones de Alain (magia)",
  "reglas",
  `Reglas que Alain ha fijado revisando la bandeja. Tienen prioridad sobre los guiones cuando chocan.

1. (02-11-2026) Lo que va dentro de un hilo ya abierto (recordatorios, seguimientos) no lleva saludo ni firma: solo el texto. El primer mensaje a alguien sí lleva presentación o contexto y firma.
2. (02-11-2026) Párrafos cortos separados por una línea en blanco, nunca un bloque seguido. En WhatsApp, mensajes cortos: dos o tres frases, sin asunto, con el nombre al principio como hace Alain ("Ey Iván", "Hola Leire!").
3. (02-11-2026) Precios: solo los que estén en la ficha, en el Registro, en los guiones o en el catálogo de shows (documentos tipo "catalogo"). Si no hay dato, no se da cifra: se propone hablarlo o se pide el dato que falte. Siempre "+ IVA".`,
  5
);

async function rest(ruta, opciones = {}) {
  const r = await fetch(`${URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: opciones.prefer ?? "return=minimal", ...(opciones.headers ?? {}) },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${texto}`);
  return texto.trim() ? JSON.parse(texto) : null;
}

// Las reglas aprendidas no se pisan si ya existen (las edita Alain desde el panel).
const existentes = new Set((((await rest("crm_conocimiento?select=clave&carril=eq.magia", { prefer: "return=representation" })) ?? []).map((d) => d.clave)));
const subir = docs.filter((d) => !(d.clave === "reglas_aprendidas" && existentes.has("reglas_aprendidas")));
await rest("crm_conocimiento?on_conflict=carril,clave", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: JSON.stringify(subir) });
console.log(`${subir.length} documentos de conocimiento de magia cargados (${Math.round(subir.reduce((s, d) => s + d.texto.length, 0) / 1024)} KB): ${subir.map((d) => d.clave).join(", ")}`);
