// Prueba de paridad sin Supabase: toma vault-export.json, simula las filas
// que crearía /api/admin/charlas/importar y comprueba que el espejo regenera
// cada ficha igual (frontmatter normalizado + líneas del Registro).
//   node scripts/charlas/_prueba-paridad.mjs "<ruta Charlas>" scripts/charlas/vault-export.json
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ficha, partir, registroDe, normal, ORDEN } from "./espejo-vault.mjs";

const [, , VAULT, JSONF] = process.argv;
const datos = JSON.parse(readFileSync(JSONF, "utf8"));

function texto(v) { if (v === null || v === undefined) return null; const s = String(v).trim(); return s === "" ? null : s; }
function fila(c) {
  const fm = c.frontmatter;
  const row = { nombre: c.nombre, notas: c.notas?.trim() || null, secciones_extra: c.secciones_extra ?? {} };
  for (const k of ORDEN) {
    if (k === "etapas") row[k] = Array.isArray(fm.etapas) ? fm.etapas.map(String) : fm.etapas ? [String(fm.etapas)] : [];
    else if (k === "intentos_llamada" || k === "mails_enviados") row[k] = Number(fm[k]) || 0;
    else if (k.startsWith("fecha")) { const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(fm[k] ?? "")); row[k] = m ? m[1] : null; }
    else row[k] = texto(fm[k]);
  }
  if (!row.estado) row.estado = "0 Por llamar";
  return row;
}

let ok = 0, mal = 0; const ejemplos = [];
for (const c of datos.centros) {
  const row = fila(c);
  const registro = c.registro.map((l, i) => ({ ...l, orden: i, origen: "vault", creado_en: "" }));
  const generado = ficha(row, registro);
  const original = readFileSync(join(VAULT, "Centros", `${c.nombre}.md`), "utf8");
  const a = partir(original), b = partir(generado);
  const difs = [];
  for (const k of ORDEN) if (normal(a.fm[k], k) !== normal(b.fm[k], k)) difs.push(`${k}: "${normal(a.fm[k], k)}" ≠ "${normal(b.fm[k], k)}"`);
  const ra = registroDe(a.cuerpo).map((l) => l.trim()), rb = registroDe(b.cuerpo).map((l) => l.trim());
  if (ra.join("\n") !== rb.join("\n")) difs.push(`registro ${ra.length} vs ${rb.length}`);
  if (difs.length) { mal++; if (ejemplos.length < 10) ejemplos.push([c.nombre, difs]); } else ok++;
}
console.log(`${ok} iguales · ${mal} con diferencias`);
for (const [n, d] of ejemplos) console.log(`· ${n}\n    ${d.join("\n    ")}`);
