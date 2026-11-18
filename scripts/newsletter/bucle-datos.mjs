#!/usr/bin/env node
// Bucle de aprendizaje de la newsletter (18-11-2026) · paso de DATOS.
//
// Junta, por cada mail diario enviado: asunto, fecha, destinatarios, métricas
// de Mailjet (newsletter_campanas.metricas, si ya las hay) y RESPUESTAS reales
// (correo_entrada, buzón newsletter, emparejadas por "Re: <asunto>").
// Calcula tasas y la mediana de los últimos 30 mails, y marca los que se salen.
// No interpreta nada: eso lo hace la tarea semanal de Claude con este JSON.
//
// Uso: node scripts/newsletter/bucle-datos.mjs [salida.json] [--cuerpos]
//   --cuerpos incluye el texto del mail (sin HTML) para poder etiquetarlo.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const envPath = join(RAIZ, ".env.local");
if (existsSync(envPath)) {
  for (const l of readFileSync(envPath, "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const URL_SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL_SB || !KEY) { console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY"); process.exit(1); }

const salida = process.argv.find((a, i) => i > 1 && !a.startsWith("--")) ?? "bucle-datos.json";
const conCuerpos = process.argv.includes("--cuerpos");

async function sb(ruta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${URL_SB}/rest/v1/${ruta}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${desde}-${desde + 999}` },
    });
    if (!r.ok) throw new Error(`${ruta}: ${r.status} ${await r.text()}`);
    const lote = await r.json();
    filas.push(...lote);
    if (lote.length < 1000) return filas;
  }
}

const sinHtml = (h) => (h ?? "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>|<\/p>/gi, "\n")
  .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();
const norm = (s) => (s ?? "").toLowerCase().replace(/^\s*((re|rv|fwd?|erantzun|aw)\s*:\s*)+/i, "").replace(/\s+/g, " ").trim();
const mediana = (xs) => { const v = xs.filter((x) => x != null).sort((a, b) => a - b); if (!v.length) return null;
  const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const r4 = (x) => (x == null ? null : Math.round(x * 10000) / 10000);

let campos = "id,subject_es,subject_eu,preheader_es,enviado_en,enviados_es,enviados_eu,remitente";
const conMetricas = await fetch(`${URL_SB}/rest/v1/newsletter_campanas?select=metricas&limit=1`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }).then((r) => r.ok);
if (conMetricas) campos += ",metricas,metricas_en";
if (conCuerpos) campos += ",body_es,body_eu";

const mails = await sb(`newsletter_campanas?estado=eq.enviado&select=${campos}&order=enviado_en.asc`);
const respuestas = await sb(
  "correo_entrada?buzon=eq.newsletter&direccion=eq.entrante&masivo=eq.false&select=fecha,asunto,de&order=fecha.asc"
);
const inicioRespuestas = respuestas[0]?.fecha ?? null; // antes de esto el buzón no se leía

// Emparejar cada respuesta con el último mail enviado antes, con el mismo asunto, en ≤10 días.
const porMail = new Map(mails.map((m) => [m.id, []]));
for (const r of respuestas) {
  if (!/^\s*(re|rv|erantzun|aw)\s*:/i.test(r.asunto ?? "")) continue;
  if (/alainzulaika\.com|niala\.es/i.test(r.de ?? "")) continue;
  const a = norm(r.asunto), t = new Date(r.fecha).getTime();
  const cand = mails.filter((m) => (norm(m.subject_es) === a || norm(m.subject_eu) === a)
    && new Date(m.enviado_en).getTime() <= t && t - new Date(m.enviado_en).getTime() <= 10 * 86400_000);
  const m = cand.at(-1);
  if (m) porMail.get(m.id).push(r.de);
}

const filas = mails.map((m) => {
  const enviados = (m.enviados_es ?? 0) + (m.enviados_eu ?? 0);
  const tot = m.metricas?.total;
  const remitentes = [...new Set(porMail.get(m.id))];
  const midiendoRespuestas = inicioRespuestas && m.enviado_en >= inicioRespuestas;
  return {
    id: m.id,
    fecha: m.enviado_en.slice(0, 10),
    asunto_es: m.subject_es, asunto_eu: m.subject_eu, preheader_es: m.preheader_es ?? null,
    enviados,
    respuestas: midiendoRespuestas ? remitentes.length : null,
    tasa_respuesta: midiendoRespuestas && enviados ? r4(remitentes.length / enviados) : null,
    aperturas: tot?.aperturas ?? null, clics: tot?.clics ?? null, bajas: tot?.bajas ?? null,
    tasa_apertura: tot?.entregados ? r4(tot.aperturas / tot.entregados) : null,
    tasa_clic: tot?.entregados ? r4(tot.clics / tot.entregados) : null,
    tasa_baja: tot?.entregados ? r4(tot.bajas / tot.entregados) : null,
    ...(conCuerpos ? { texto_es: sinHtml(m.body_es), texto_eu: m.body_es ? undefined : sinHtml(m.body_eu) } : {}),
  };
});

const ultimos = filas.slice(-30);
const base = {
  n: ultimos.length,
  tasa_respuesta: r4(mediana(ultimos.map((f) => f.tasa_respuesta))),
  tasa_apertura: r4(mediana(ultimos.map((f) => f.tasa_apertura))),
  tasa_clic: r4(mediana(ultimos.map((f) => f.tasa_clic))),
  tasa_baja: r4(mediana(ultimos.map((f) => f.tasa_baja))),
};
// "Se sale": ≥1,5× la mediana (y al menos 2 respuestas / 3 clics) · "flojo": ≤0,5× · bajas: ≥2×.
for (const f of filas) {
  const s = [];
  if (f.respuestas != null && f.respuestas >= 2 && base.tasa_respuesta != null && f.tasa_respuesta >= 1.5 * Math.max(base.tasa_respuesta, 0.0025)) s.push("respuestas↑");
  if (f.clics != null && f.clics >= 3 && base.tasa_clic && f.tasa_clic >= 1.5 * base.tasa_clic) s.push("clics↑");
  if (f.tasa_apertura != null && base.tasa_apertura && f.tasa_apertura >= 1.25 * base.tasa_apertura) s.push("aperturas↑");
  if (f.tasa_apertura != null && base.tasa_apertura && f.tasa_apertura <= 0.75 * base.tasa_apertura) s.push("aperturas↓");
  if (f.bajas != null && f.bajas >= 2 && base.tasa_baja != null && f.tasa_baja >= 2 * Math.max(base.tasa_baja, 0.001)) s.push("bajas↑");
  f.senales = s;
}

const cola = await sb("newsletter_campanas?estado=eq.cola&select=id");
const programados = await sb(`newsletter_campanas?estado=eq.programado&programado_para=gte.${new Date().toISOString()}&select=programado_para&order=programado_para.asc`);

writeFileSync(salida, JSON.stringify({
  generado: new Date().toISOString(),
  metricas_mailjet: conMetricas ? "columna presente" : "falta ejecutar sql/newsletter_metricas.sql",
  respuestas_medidas_desde: inicioRespuestas,
  base_ultimos_30: base,
  cola_b: cola.length,
  programados: programados.map((p) => p.programado_para.slice(0, 10)),
  mails: filas,
}, null, 2));
console.log(`OK ${filas.length} mails · ${respuestas.length} correos entrantes · cola B ${cola.length} · programados ${programados.length} → ${salida}`);
