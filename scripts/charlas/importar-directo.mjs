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

const texto = (v) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());
const fecha = (v) => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v ?? ""));
  return m ? m[1] : null;
};
const entero = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);
const numero = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const enlace = (v) => {
  if (typeof v !== "string") return null;
  const m = /^\[\[([^\]|]+)/.exec(v.trim());
  return m ? m[1].trim() : v.trim() || null;
};

function normalizar(fm) {
  return {
    codigo: texto(fm.codigo), territorio: texto(fm.territorio), localidad: texto(fm.localidad),
    tipo: texto(fm.tipo), tipo_centro: texto(fm.tipo_centro), modelo_linguistico: texto(fm.modelo_linguistico),
    euskera: texto(fm.euskera),
    etapas: Array.isArray(fm.etapas) ? fm.etapas.map(String) : fm.etapas ? [String(fm.etapas)] : [],
    etapas_confirmadas: texto(fm.etapas_confirmadas), direccion: texto(fm.direccion), telefono: texto(fm.telefono),
    email_centro: texto(fm.email_centro), web: texto(fm.web), prioridad: texto(fm.prioridad),
    estado: texto(fm.estado) ?? "0 Por llamar", origen: texto(fm.origen), via: texto(fm.via),
    responsable: texto(fm.responsable), responsable_cargo: texto(fm.responsable_cargo),
    responsable_email: texto(fm.responsable_email), responsable_tel: texto(fm.responsable_tel),
    ampa: texto(fm.ampa), ampa_contacto: texto(fm.ampa_contacto), ampa_email: texto(fm.ampa_email),
    calendario_abierto: texto(fm.calendario_abierto), intentos_llamada: entero(fm.intentos_llamada),
    mails_enviados: entero(fm.mails_enviados), fecha_ultimo_contacto: fecha(fm.fecha_ultimo_contacto),
    proxima_accion: texto(fm.proxima_accion), bloqueado_por: texto(fm.bloqueado_por),
    fecha_proxima_accion: fecha(fm.fecha_proxima_accion), fecha_creacion: fecha(fm.fecha_creacion),
    ficha_cliente: texto(fm.ficha_cliente),
  };
}

const errores = [];
const id = new Map();
const { data: ya } = await sb.from("charlas_centros").select("id, nombre");
for (const c of ya ?? []) id.set(c.nombre, c.id);
let nuevos = 0, actualizados = 0;

const filas = datos.centros.map((c) => ({
  nombre: c.nombre, ...normalizar(c.frontmatter ?? {}),
  notas: c.notas?.trim() || null, secciones_extra: c.secciones_extra ?? {}, actualizado_por: "vault",
}));
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
  if (!cid) continue;
  c.registro.forEach((l, orden) => {
    if (!l.texto?.trim() && !l.raw?.trim()) return;
    inter.push({ centro_id: cid, fecha: fecha(l.fecha), canal: l.canal, texto: (l.texto ?? l.raw).trim(), raw: l.raw ?? null, orden, origen: "vault" });
  });
}
let nInter = 0;
for (let i = 0; i < inter.length; i += 500) {
  const { error } = await sb.from("charlas_interacciones").insert(inter.slice(i, i + 500));
  if (error) errores.push(`interacciones ${i}: ${error.message}`); else nInter += Math.min(500, inter.length - i);
}

const contactos = [];
const vistos = new Set();
for (const c of datos.centros) {
  const cid = id.get(c.nombre);
  if (!cid) continue;
  const fm = normalizar(c.frontmatter ?? {});
  const add = (k) => {
    const clave = k.email ? `${cid}|${k.email}` : null;
    if (clave && vistos.has(clave)) return;
    if (clave) vistos.add(clave);
    contactos.push({ centro_id: cid, origen: "vault", ...k });
  };
  if (fm.responsable || fm.responsable_email)
    add({ nombre: fm.responsable, cargo: fm.responsable_cargo, email: fm.responsable_email?.toLowerCase() ?? null, telefono: fm.responsable_tel, rol: "responsable" });
  if (fm.ampa_contacto || fm.ampa_email)
    add({ nombre: fm.ampa_contacto, cargo: fm.ampa ? `AMPA · ${fm.ampa}` : "AMPA", email: fm.ampa_email?.toLowerCase() ?? null, telefono: null, rol: "ampa" });
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
