#!/usr/bin/env node
// Rescate único (17-11-2026): correos de centros que se perdieron antes de
// ampliar «Sin emparejar» (dominio compartido, correo nuevo sin hilo; caso
// Patricia Rivas). Salen de la bandeja general (correo_entrada, sin vía) y
// entran en charlas_mensajes como pendiente_asignar con match_por = 'rescate':
// el lector les trae el texto y Alain los asocia a mano (pueden estar ya
// atendidos, por eso no se asocian solos).
//
//   node scripts/charlas/rescatar-sin-emparejar.mjs --comprobar   # lista, no escribe
//   node scripts/charlas/rescatar-sin-emparejar.mjs [--desde 2026-10-15]

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
if (existsSync(join(raiz, ".env.local"))) {
  for (const l of readFileSync(join(raiz, ".env.local"), "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
const COMPROBAR = process.argv.includes("--comprobar");
const i = process.argv.indexOf("--desde");
const DESDE = i > 0 ? process.argv[i + 1] : new Date(Date.now() - 35 * 86400000).toISOString().slice(0, 10);

// Mismo criterio que lib/charlas-correo.ts (ASUNTO_CHARLAS) y lib/charlas-emparejar.ts (DOMINIOS_PERSONALES).
const ASUNTO = /(calendario de actividades|jardueren egutegia|egutegia|charlas? sobre (la )?atenci|arreta|hitzaldi|dossier|dosierra|magia.*atenci)/i;
const PERSONALES = new Set(["gmail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es", "yahoo.com", "yahoo.es", "icloud.com", "live.com", "msn.com", "euskalnet.net", "telefonica.net", "me.com", "protonmail.com"]);

const cab = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
async function todas(ruta) {
  const out = [];
  for (let d = 0; ; d += 1000) {
    const r = await fetch(`${URL}/rest/v1/${ruta}`, { headers: { ...cab, Range: `${d}-${d + 999}` } });
    if (!r.ok) throw new Error(`${ruta}: ${r.status} ${await r.text()}`);
    const lote = await r.json();
    out.push(...lote);
    if (lote.length < 1000) break;
  }
  return out;
}

const centros = await todas("charlas_centros?select=email_centro,responsable_email,ampa_email");
const dominios = new Set();
for (const c of centros) for (const e of `${c.email_centro} ${c.responsable_email} ${c.ampa_email}`.toLowerCase().match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) {
  const d = e.split("@")[1];
  if (!PERSONALES.has(d)) dominios.add(d);
}
const entradas = await todas(`correo_entrada?select=message_id,in_reply_to,referencias,de,para,asunto,fecha,carpeta,uid,masivo&via=is.null&direccion=eq.entrante&fecha=gte.${DESDE}&order=fecha.asc`);
const candidatos = entradas.filter((m) => !m.masivo && (ASUNTO.test(m.asunto ?? "") || dominios.has(String(m.de ?? "").split("@")[1])));
const ya = new Set();
for (const lote of [candidatos.slice(0, 150), candidatos.slice(150)]) {
  if (!lote.length) continue;
  const ids = lote.map((m) => `"${String(m.message_id).replace(/"/g, '\\"')}"`).join(",");
  for (const f of await todas(`charlas_mensajes?select=message_id&message_id=in.(${encodeURIComponent(ids)})`)) ya.add(f.message_id);
}
const nuevos = candidatos.filter((m) => !ya.has(m.message_id));
for (const m of nuevos) console.log(`${m.fecha.slice(0, 16)} · ${m.de} · ${m.asunto}`);
console.log(`${nuevos.length} para rescatar (${candidatos.length} candidatos, ${candidatos.length - nuevos.length} ya estaban) desde ${DESDE}`);

if (!COMPROBAR && nuevos.length) {
  const filas = nuevos.map((m) => ({
    direccion: "entrante", message_id: m.message_id, in_reply_to: m.in_reply_to, referencias: m.referencias ?? [],
    de: m.de, para: m.para ?? [], asunto: m.asunto, fecha: m.fecha, carpeta: m.carpeta, uid: m.uid,
    estado: "pendiente_asignar", match_por: "rescate",
  }));
  const r = await fetch(`${URL}/rest/v1/charlas_mensajes?on_conflict=message_id`, { method: "POST", headers: { ...cab, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(filas) });
  if (!r.ok) throw new Error(`insertar: ${r.status} ${await r.text()}`);
  console.log(`Rescatados: ${filas.length}`);
}
