#!/usr/bin/env node
// Importa vault-export.json directamente en Supabase (sin pasar por la web).
// Hace lo mismo que /api/admin/charlas/importar; sirve cuando la web no es
// alcanzable o para cargas grandes.
//
//   node scripts/charlas/importar-directo.mjs scripts/charlas/vault-export.json
//
// Lee SUPABASE_URL y SUPABASE_SERVICE_KEY de .env.local o del entorno.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { filaCentro, interaccionesCentro, contactosCentro, fecha, numero, enlace } from "./centros-lib.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const envPath = join(RAIZ, ".env.local");
if (existsSync(envPath)) {
  for (const l of readFileSync(envPath, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const datos = JSON.parse(readFileSync(process.argv[2], "utf8"));

const errores = [];
const id = new Map();
const { data: ya } = await sb.from("charlas_centros").select("id, nombre");
for (const c of ya ?? []) id.set(c.nombre, c.id);
let nuevos = 0, actualizados = 0;

const filas = datos.centros.map(filaCentro);
for (let i = 0; i < filas.length; i += 100) {
  const { data, error } = await sb.from("charlas_centros").upsert(filas.slice(i, i + 100), { onConflict: "nombre" }).select("id, nombre");
  if (error) { errores.push(`centros ${i}: ${error.message}`); continue; }
  for (const f of data) { id.has(f.nombre) ? actualizados++ : nuevos++; id.set(f.nombre, f.id); }
}

const ids = datos.centros.map((c) => id.get(c.nombre)).filter(Boolean);
for (let i = 0; i < ids.length; i += 200) {
  await sb.from("charlas_interacciones").delete().eq("origen", "vault").in("centro_id", ids.slice(i, i + 200));
  await sb.from("charlas_contactos").delete().eq("origen", "vault").in("centro_id", ids.slice(i, i + 200));
}

const inter = [];
for (const c of datos.centros) {
  const cid = id.get(c.nombre);
  if (cid) inter.push(...interaccionesCentro(c, cid));
}
let nInter = 0;
for (let i = 0; i < inter.length; i += 500) {
  const { error } = await sb.from("charlas_interacciones").insert(inter.slice(i, i + 500));
  if (error) errores.push(`interacciones ${i}: ${error.message}`); else nInter += Math.min(500, inter.length - i);
}

const contactos = [];
for (const c of datos.centros) {
  const cid = id.get(c.nombre);
  if (cid) contactos.push(...contactosCentro(c, cid));
}
let nCont = 0;
for (let i = 0; i < contactos.length; i += 500) {
  const { error } = await sb.from("charlas_contactos").insert(contactos.slice(i, i + 500));
  if (error) errores.push(`contactos ${i}: ${error.message}`); else nCont += Math.min(500, contactos.length - i);
}

let nEv = 0;
for (const e of datos.eventos ?? []) {
  const fm = e.frontmatter ?? {};
  const centro = enlace(fm.centro) ?? enlace(fm.cliente_ficha);
  const { error } = await sb.from("charlas_eventos").upsert({
    nombre: e.nombre, centro_id: centro ? id.get(centro) ?? null : null,
    fecha_evento: fecha(fm.fecha_evento), estado_evento: fm.estado_evento ?? null, via_pago: fm.via_pago ?? null,
    formato: fm.formato ?? null, n_sesiones: numero(fm.n_sesiones), importe_base: numero(fm.importe_base),
    importe_total: numero(fm.importe_total), importe_neto: numero(fm.importe_neto),
    pago_reserva: fecha(fm.pago_reserva), pago_resto: fecha(fm.pago_resto), factura_emitida: fecha(fm.factura_emitida),
    vencimiento_factura: fecha(fm.vencimiento_factura), fecha_cobro: fecha(fm.fecha_cobro),
    contacto_dia: fm.contacto_dia ?? null, negocio: fm.negocio ?? "charlas", cuerpo: e.cuerpo ?? null, frontmatter: fm,
  }, { onConflict: "nombre" });
  if (error) errores.push(`evento ${e.nombre}: ${error.message}`); else nEv++;
}

console.log(`${nuevos} centros nuevos · ${actualizados} actualizados · ${nInter} líneas de registro · ${nCont} contactos · ${nEv} eventos`);
if (errores.length) { console.log("ERRORES:"); for (const e of errores) console.log("  " + e); process.exit(1); }
