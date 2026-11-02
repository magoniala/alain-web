#!/usr/bin/env node
// Espejo Supabase → vault para el CRM de magia (Prospectos/).
//
//   node scripts/crm/espejo-prospectos.mjs [--comprobar] [ruta a Prospectos/]
//
// Lee crm_fichas (carril magia) y crm_interacciones y reescribe solo las
// fichas que hayan cambiado, conservando tal cual el bloque mensaje-listo,
// las Notas y el resto del cuerpo. Si Alain ha apuntado una línea a mano en el
// Registro de una ficha, se sube a Supabase (origen manual) antes de reescribir.
// Lo llama espejo-vault.mjs al final de su pasada (misma tarea de launchd).

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFicha, renderFicha, igual, CLAVES } from "./prospectos-lib.mjs";


// Qué notas escribió el propio espejo (ruta → mtime): una nota con ese mtime
// no la ha tocado Alain, así que no cuenta como "cambiada en Obsidian".
const ESTADO_ESPEJO = join(dirname(fileURLToPath(import.meta.url)), ".espejo-mtimes.json");
const escritas = (() => { try { return JSON.parse(readFileSync(ESTADO_ESPEJO, "utf8")); } catch { return {}; } })();
function escribir(ruta, texto) {
  writeFileSync(ruta, texto, "utf8");
  escritas[ruta] = statSync(ruta).mtimeMs;
}
function guardarEstadoEspejo() {
  try { writeFileSync(ESTADO_ESPEJO, JSON.stringify(escritas), "utf8"); } catch { /* no es crítico */ }
}
const tocadaEnObsidian = (ruta, actualizadoEn) => {
  const m = statSync(ruta).mtimeMs;
  return escritas[ruta] !== m && m > Date.parse(actualizadoEn) + 5000;
};

export async function espejoProspectos({ dir, url, key, comprobar = false } = {}) {
  const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  if (!url || !key) {
    const envPath = join(RAIZ, ".env.local");
    if (existsSync(envPath)) {
      for (const l of readFileSync(envPath, "utf8").split("\n")) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
    url = url ?? process.env.SUPABASE_URL;
    key = key ?? process.env.SUPABASE_SERVICE_KEY;
  }
  dir = dir ?? (process.env.VAULT_CHARLAS_DIR ? join(process.env.VAULT_CHARLAS_DIR, "..", "..", "Prospectos") : null);
  if (!url || !key || !dir || !existsSync(dir)) throw new Error("espejo-prospectos: faltan credenciales o la carpeta Prospectos/");

  const rest = async (ruta, opciones = {}) => {
    const r = await fetch(`${url}/rest/v1/${ruta}`, {
      ...opciones,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: opciones.prefer ?? "return=minimal", ...(opciones.headers ?? {}) },
    });
    const texto = await r.text();
    if (!r.ok) throw new Error(`${ruta}: ${r.status} ${texto}`);
    return texto.trim() ? JSON.parse(texto) : null;
  };
  const todas = async (tabla, select, orden) => {
    const out = [];
    for (let desde = 0; ; desde += 1000) {
      const lote = await rest(`${tabla}?select=${encodeURIComponent(select)}${orden ? `&order=${orden}` : ""}`, { headers: { Range: `${desde}-${desde + 999}`, Prefer: "count=exact" } });
      out.push(...(lote ?? []));
      if (!lote || lote.length < 1000) break;
    }
    return out;
  };

  const { data: cfg } = { data: await rest("charlas_config?select=valor&clave=eq.magia_espejo") };
  if (cfg?.[0]?.valor === false) return { saltado: "magia_espejo = false" };

  const [fichas, interacciones] = await Promise.all([todas("crm_fichas", "*", "nombre").then((f) => f.filter((x) => x.carril === "magia")), todas("crm_interacciones", "*", "ficha_id,fecha,orden")]);
  const porFicha = new Map();
  for (const i of interacciones) {
    if (!porFicha.has(i.ficha_id)) porFicha.set(i.ficha_id, []);
    porFicha.get(i.ficha_id).push(i);
  }

  const enVault = new Set(readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)));
  let iguales = 0;
  let distintas = 0;
  let nuevas = 0;
  const manuales = [];
  const diferencias = [];
  const subidas = [];

  for (const f of fichas) {
    const ruta = join(dir, `${f.nombre.replace(/[\/\\:*?"<>|]/g, "-")}.md`);
    enVault.delete(f.nombre);
    const registro = porFicha.get(f.id) ?? [];
    if (!existsSync(ruta)) {
      nuevas++;
      if (!comprobar) escribir(ruta, renderFicha(f, registro));
      continue;
    }
    const actual = readFileSync(ruta, "utf8");
    let p;
    try {
      p = parseFicha(actual);
    } catch {
      diferencias.push({ nombre: f.nombre, difs: ["no se puede leer el frontmatter; no se toca"] });
      continue;
    }
    // Apuntes a mano: líneas del Registro del vault que no están en Supabase.
    const conocidas = new Set(registro.map((r) => (r.raw ?? "").trim()).filter(Boolean));
    const nuevasManuales = p.registro.filter((r) => !conocidas.has(r.raw.trim()) && !registro.some((x) => x.texto === r.texto && (x.fecha ?? null) === (r.fecha ?? null)));
    for (const r of nuevasManuales) {
      const fila = { ficha_id: f.id, fecha: r.fecha, canal: r.canal ?? "Manual", texto: r.texto, raw: r.raw, orden: 900 + r.orden, origen: "manual" };
      manuales.push(fila);
      registro.push({ ...fila, creado_en: new Date().toISOString() });
    }
    const difs = [];
    for (const k of CLAVES) if (!igual(p.frontmatter[k], f[k] ?? f.datos?.[k] ?? null, k)) difs.push(`${k}: vault="${p.frontmatter[k] ?? ""}" · db="${f[k] ?? ""}"`);
    // Si la nota se ha tocado en Obsidian después del último cambio en
    // Supabase (Alain cambia el estado o la próxima acción a mano), gana el
    // vault: se sube lo que difiere y no se reescribe la nota. Si lo último
    // fue del panel o del sistema, gana Supabase.
    if (difs.length && tocadaEnObsidian(ruta, f.actualizado_en)) {
      const cambios = {};
      const datos = { ...(f.datos ?? {}) };
      let conDatos = false;
      for (const k of CLAVES) {
        if (igual(p.frontmatter[k], f[k] ?? f.datos?.[k] ?? null, k)) continue;
        let v = p.frontmatter[k];
        if (v === "" || v === undefined) v = null;
        if (k === "enviado" && v !== null && typeof v !== "boolean") v = String(v) === "true";
        if (k in f) cambios[k] = v;
        else {
          datos[k] = v;
          conDatos = true;
        }
      }
      if (conDatos) cambios.datos = datos;
      cambios.actualizado_por = "vault";
      subidas.push({ nombre: f.nombre, difs });
      if (!comprobar) await rest(`crm_fichas?id=eq.${f.id}`, { method: "PATCH", body: JSON.stringify(cambios) });
      continue;
    }
    const nuevo = renderFicha(f, registro);
    if (difs.length === 0 && nuevo === actual) {
      iguales++;
      continue;
    }
    distintas++;
    if (difs.length) diferencias.push({ nombre: f.nombre, difs });
    if (!comprobar) escribir(ruta, nuevo);
  }

  if (!comprobar && manuales.length) await rest("crm_interacciones", { method: "POST", body: JSON.stringify(manuales) });
  if (!comprobar) guardarEstadoEspejo();

  return { fichas: fichas.length, iguales, distintas, nuevas, manuales: manuales.length, subidas: subidas.length, sin_supabase: [...enVault], diferencias, detalle_subidas: subidas };
}

// Ejecución directa.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const comprobar = process.argv.includes("--comprobar");
  const dir = process.argv.slice(2).find((a) => !a.startsWith("--"));
  espejoProspectos({ dir, comprobar })
    .then((r) => {
      if (r.saltado) return console.log(`Prospectos: saltado (${r.saltado})`);
      console.log(`Prospectos (magia): ${r.fichas} fichas en Supabase · ${r.iguales} iguales · ${r.distintas} con diferencias · ${r.nuevas} nuevas · ${r.manuales} apuntes a mano ${comprobar ? "detectados" : "subidos"} · ${r.subidas} fichas cambiadas en Obsidian ${comprobar ? "por subir" : "subidas"}${r.sin_supabase.length ? ` · en el vault sin Supabase: ${r.sin_supabase.slice(0, 5).join(", ")}` : ""}`);
      for (const d of r.detalle_subidas.slice(0, 10)) console.log(`↑ ${d.nombre} (cambiada en Obsidian)\n    ${d.difs.join("\n    ")}`);
      for (const d of r.diferencias.slice(0, 10)) console.log(`· ${d.nombre}\n    ${d.difs.join("\n    ")}`);
      if (comprobar) console.log("(modo --comprobar: no se ha escrito nada)");
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
