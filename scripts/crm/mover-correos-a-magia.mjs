#!/usr/bin/env node
// Pasa a una ficha de MAGIA (crm_fichas) los correos que se asociaron por error
// a un centro de CHARLAS (charlas_centros). Caso de origen (11-11-2026):
// cultura@berriz.eus (ayuntamiento, antiguo cliente de magia) quedó dentro de
// "Berriz BHI" porque el dominio berriz.eus lleva el nombre del pueblo.
//
//   node scripts/crm/mover-correos-a-magia.mjs --centro "Berriz BHI" --ficha "Berrizko Udala" --dominio berriz.eus
//   node scripts/crm/mover-correos-a-magia.mjs … --aplicar
//
// Sin --aplicar solo enseña qué haría (no escribe nada). Con --aplicar:
//  1. Copia a crm_mensajes los correos del centro cuyo remitente o destinatario
//     sea del dominio. El ÚLTIMO entrante entra como 'nuevo' para que la IA de
//     magia lo lea y proponga la tarjeta en el panel de Prospectos de magia; el
//     resto, como 'procesado'.
//  2. Copia a crm_interacciones las líneas del Registro del centro que cuadren con
//     --registro (por defecto «Cultura Berriz» / «Concejalía de Cultura»).
//  3. En Charlas, saca esos correos del centro (centro_id = null, estado 'ignorado'; no
//     se borra nada), descarta las tarjetas abiertas del centro que dependan de ellos y
//     borra del Registro de Supabase las líneas copiadas.
// Se puede repetir: lo que ya está en crm_mensajes no se duplica.
//
// OJO: las notas del vault («Berriz BHI.md», «Berrizko Udala (Kultura).md») no se tocan
// aquí: el espejo conserva su Registro tal cual; limpiarlas a mano o pedirlo aparte.

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
const arg = (n, def = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : def;
};
const APLICAR = process.argv.includes("--aplicar");
const nombreCentro = arg("centro");
const nombreFicha = arg("ficha");
const dominio = (arg("dominio") ?? "").toLowerCase();
const regRegistro = new RegExp(arg("registro", "Cultura Berriz|Concejal[ií]a de Cultura"), "i");
if (!nombreCentro || !nombreFicha || !dominio) {
  console.error('Uso: --centro "Berriz BHI" --ficha "Berrizko Udala" --dominio berriz.eus [--registro "regex"] [--aplicar]');
  process.exit(1);
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en .env.local");
  process.exit(1);
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const ok = (r, que) => {
  if (r.error) throw new Error(`${que}: ${r.error.message}`);
  return r.data;
};

const centros = ok(await sb.from("charlas_centros").select("id, nombre").eq("nombre", nombreCentro), "buscar centro");
if (centros.length !== 1) throw new Error(`Centro «${nombreCentro}»: ${centros.length} resultados (tiene que ser 1).`);
const centro = centros[0];
const fichas = ok(await sb.from("crm_fichas").select("id, nombre, estado, responsable_email").eq("carril", "magia").ilike("nombre", `%${nombreFicha}%`), "buscar ficha");
if (fichas.length !== 1) throw new Error(`Ficha de magia «${nombreFicha}»: ${fichas.length} resultados (tiene que ser 1): ${fichas.map((f) => f.nombre).join(" | ")}`);
const ficha = fichas[0];
console.log(`Centro de Charlas: ${centro.nombre} (${centro.id})\nFicha de magia:    ${ficha.nombre} · ${ficha.estado} · ${ficha.responsable_email ?? "sin email"} (${ficha.id})\n`);

const todos = ok(await sb.from("charlas_mensajes").select("*").eq("centro_id", centro.id).order("fecha"), "leer mensajes");
const delDominio = (m) => `${m.de ?? ""} ${(m.para ?? []).join(" ")}`.toLowerCase().includes(`@${dominio}`);
const mover = todos.filter(delDominio);
console.log(`Correos del centro: ${todos.length} · de/para @${dominio}: ${mover.length}`);
for (const m of mover) console.log(`  ${m.fecha?.slice(0, 16)} ${m.direccion === "entrante" ? "←" : "→"} ${m.direccion === "entrante" ? m.de : (m.para ?? []).join(",")} | ${(m.asunto ?? "").slice(0, 60)} | ${m.estado} | match_por: ${m.match_por ?? "—"}`);
if (!mover.length) {
  console.log("Nada que mover.");
  process.exit(0);
}
const ultimoEntrante = [...mover].reverse().find((m) => m.direccion === "entrante");
const idsMover = new Set(mover.map((m) => m.id));

const registro = ok(await sb.from("charlas_interacciones").select("*").eq("centro_id", centro.id).order("fecha").order("orden"), "leer registro");
const lineas = registro.filter((r) => regRegistro.test(r.texto ?? "") && !(r.canal === "Recibido" && r.mensaje_id === ultimoEntrante?.id));
console.log(`\nLíneas del Registro que se copiarían a la ficha de magia (${lineas.length}):`);
for (const r of lineas) console.log(`  ${r.fecha} · ${r.canal} · ${(r.texto ?? "").slice(0, 110)}`);

const tareas = ok(await sb.from("charlas_tareas").select("id, tipo, estado, mensaje_entrante_id, destinatario").eq("centro_id", centro.id).in("estado", ["revisar", "pendiente", "error"]), "leer tareas");
const tareasDep = tareas.filter((t) => idsMover.has(t.mensaje_entrante_id) || (t.destinatario ?? "").toLowerCase().includes(`@${dominio}`));
console.log(`\nTarjetas abiertas del centro que se descartarían (${tareasDep.length}): ${tareasDep.map((t) => `${t.tipo}/${t.estado}`).join(", ") || "ninguna"}`);
console.log(`Entra como 'nuevo' (lo lee la IA de magia): ${ultimoEntrante ? `${ultimoEntrante.fecha?.slice(0, 16)} «${(ultimoEntrante.asunto ?? "").slice(0, 50)}»` : "ninguno (no hay entrantes)"}`);

if (!APLICAR) {
  console.log("\n(Simulación: no se ha escrito nada. Repite con --aplicar para hacerlo.)");
  process.exit(0);
}

// 1. crm_mensajes
const yaEstan = new Set(ok(await sb.from("crm_mensajes").select("message_id").in("message_id", mover.map((m) => m.message_id).filter(Boolean)), "comprobar duplicados").map((m) => m.message_id));
const mapaId = new Map();
for (const m of mover) {
  if (m.message_id && yaEstan.has(m.message_id)) {
    const e = ok(await sb.from("crm_mensajes").select("id").eq("message_id", m.message_id).single(), "buscar existente");
    mapaId.set(m.id, e.id);
    continue;
  }
  const fila = {
    ficha_id: ficha.id,
    direccion: m.direccion,
    message_id: m.message_id,
    in_reply_to: m.in_reply_to,
    referencias: m.referencias,
    de: m.de,
    para: m.para,
    asunto: m.asunto,
    texto: m.texto,
    fecha: m.fecha,
    idioma: m.idioma,
    estado: m.id === ultimoEntrante?.id ? "nuevo" : "procesado",
    tipo_salida: m.direccion === "saliente" ? "respuesta" : null,
  };
  const nuevo = ok(await sb.from("crm_mensajes").insert(fila).select("id").single(), `insertar correo ${m.message_id}`);
  mapaId.set(m.id, nuevo.id);
}
console.log(`\n✔ crm_mensajes: ${mover.length} correos en la ficha de magia (${yaEstan.size} ya estaban).`);

// 2. crm_interacciones
if (lineas.length) {
  const filas = lineas.map((r) => ({ ficha_id: ficha.id, fecha: r.fecha, canal: r.canal, texto: r.texto, raw: r.raw, orden: r.orden, origen: r.origen, mensaje_id: r.mensaje_id ? mapaId.get(r.mensaje_id) ?? null : null }));
  ok(await sb.from("crm_interacciones").insert(filas), "insertar registro");
  console.log(`✔ crm_interacciones: ${filas.length} líneas copiadas.`);
}

// 3. Charlas: sacar del centro
ok(await sb.from("charlas_mensajes").update({ centro_id: null, estado: "ignorado" }).in("id", [...idsMover]), "sacar correos del centro");
if (tareasDep.length) {
  ok(await sb.from("charlas_tareas").update({ estado: "descartada", motivo: "Movida a la ficha de magia (correo asociado al centro por error)", resuelto_en: new Date().toISOString(), resuelto_por: "sistema" }).in("id", tareasDep.map((t) => t.id)), "descartar tarjetas");
}
if (lineas.length) ok(await sb.from("charlas_interacciones").delete().in("id", lineas.map((r) => r.id)), "borrar registro del centro");
console.log(`✔ charlas: correos sacados de «${centro.nombre}», ${tareasDep.length} tarjetas descartadas, ${lineas.length} líneas del Registro quitadas.`);
console.log("\nListo. El último correo entrante lo leerá la IA de magia en su próxima ventana y saldrá la tarjeta en Prospectos de magia.");
