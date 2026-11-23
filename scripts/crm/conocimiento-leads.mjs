// Guiones de los leads de Entrenatzaile (Vías/Entrenatzaile/Guiones/) → crm_conocimiento
// (carril "entrenatzaile"), para que la IA redacte los borradores de las tarjetas con el
// protocolo de Alain (23-11-2026). El vault manda: lo llama el espejo horario, así que si
// Alain cambia un guion en Obsidian, la IA lo usa en la pasada siguiente.
//
//   node scripts/crm/conocimiento-leads.mjs [ruta a Vías/Entrenatzaile/] [--comprobar]

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Los guiones que usa el redactor, en orden. (Hoja de Ruta reservada y Testimonio no: los lleva la pestaña Hoja de Ruta.)
const GUIONES = [
  ["flujo", "00 Flujo leads", "Guiones/00 Flujo leads.md"],
  ["check_in", "Check-in", "Guiones/Leads · Check-in.md"],
  ["seguimiento", "Seguimiento", "Guiones/Leads · Seguimiento.md"],
  ["conversacion", "Conversación", "Guiones/Leads · Conversación.md"],
  ["propuesta", "Propuesta Hoja de Ruta", "Guiones/Leads · Propuesta Hoja de Ruta.md"],
  ["cierre", "Cierre de la propuesta", "Guiones/Leads · Cierre de la propuesta.md"],
  ["whatsapp", "WhatsApp", "Guiones/Leads · WhatsApp.md"],
  ["mail_personal", "Mail personal", "Guiones/Leads · Mail personal.md"],
];

export async function conocimientoLeads({ dir, url, key, comprobar = false }) {
  const docs = [];
  GUIONES.forEach(([clave, titulo, rel], i) => {
    const ruta = join(dir, rel);
    if (!existsSync(ruta)) return;
    docs.push({ carril: "entrenatzaile", clave, titulo, tipo: "guion", texto: readFileSync(ruta, "utf8"), orden: 10 + i, activo: true, actualizado_en: new Date().toISOString() });
  });
  if (!docs.length) throw new Error(`no hay guiones en ${dir}`);
  if (comprobar) return { docs: docs.length, kb: Math.round(docs.reduce((s, d) => s + d.texto.length, 0) / 1024), cambiados: null };
  const r0 = await fetch(`${url}/rest/v1/crm_conocimiento?select=clave,texto&carril=eq.entrenatzaile`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const previos = new Map(((await r0.json()) ?? []).map((d) => [d.clave, d.texto]));
  const cambiados = docs.filter((d) => previos.get(d.clave) !== d.texto);
  if (cambiados.length) {
    const r = await fetch(`${url}/rest/v1/crm_conocimiento?on_conflict=carril,clave`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(cambiados) });
    if (!r.ok) throw new Error(`crm_conocimiento: ${r.status} ${await r.text()}`);
  }
  return { docs: docs.length, kb: Math.round(docs.reduce((s, d) => s + d.texto.length, 0) / 1024), cambiados: cambiados.map((d) => d.clave) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  for (const l of existsSync(join(RAIZ, ".env.local")) ? readFileSync(join(RAIZ, ".env.local"), "utf8").split("\n") : []) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  const dir = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? join(process.env.VAULT_CHARLAS_DIR ?? "", "..", "Entrenatzaile");
  conocimientoLeads({ dir, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY, comprobar: process.argv.includes("--comprobar") })
    .then((r) => console.log(`Conocimiento de leads: ${r.docs} guiones (${r.kb} KB)${r.cambiados ? ` · actualizados: ${r.cambiados.join(", ") || "ninguno"}` : ""}`))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
