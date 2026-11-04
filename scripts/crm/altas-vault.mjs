#!/usr/bin/env node
// Altas vault → Supabase del CRM.
//
//   node scripts/crm/altas-vault.mjs --comprobar   # simulación: solo lista
//   node scripts/crm/altas-vault.mjs               # da de alta
//
// Las carpetas se deducen de VAULT_CHARLAS_DIR; se puede pasar otra ruta a la
// carpeta "Charlas" como argumento (útil para probar sobre una copia).
//
// Lo llama espejo-vault.mjs al principio de cada pasada horaria, ANTES del
// espejo Supabase → vault: así una ficha que Alain acaba de crear en Obsidian
// entra en Supabase, sale en el panel y el motor le crea tareas en la misma
// pasada, en vez de quedarse solo en el vault.
//
// Reglas (a propósito, conservadoras):
//   · Solo ALTAS. Nunca actualiza ni borra nada: para las fichas que ya
//     existen manda Supabase, y eso lo siguen haciendo espejo-vault.mjs y
//     espejo-prospectos.mjs.
//   · La clave es la misma de cada tabla: el nombre del fichero .md
//     (charlas_centros.nombre UNIQUE · crm_fichas UNIQUE (carril, nombre)).
//   · Idempotente: si la ficha ya está, no se toca; y si el INSERT choca con
//     la clave única (dos pasadas a la vez), se ignora el 409.
//   · Ante la mínima sospecha de duplicado (mismo email, mismo teléfono o
//     nombre casi igual que otra ficha), NO se inserta: se apunta en el log
//     para que Alain lo resuelva a mano.
//   · El frontmatter y el Registro se leen con la misma lógica que los
//     importadores (filaDesdeFicha de prospectos-lib.mjs para Prospectos,
//     exportar-vault.py + centros-lib.mjs para Centros).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { filaDesdeFicha } from "./prospectos-lib.mjs";
import { filaCentro, interaccionesCentro, contactosCentro, leerFichasCentro } from "../charlas/centros-lib.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");

// --- comparación de nombres, correos y teléfonos ---------------------------
const sinAcentos = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Nombre comparable: sin acentos, sin paréntesis, sin puntuación. */
export const claveNombre = (s) =>
  sinAcentos(s).toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
export const claveMail = (s) => (s ? String(s).trim().toLowerCase() : "");
/** Teléfono comparable: últimos 9 dígitos (así da igual el prefijo). */
export const claveTel = (s) => {
  const d = String(s ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
};

/** Levenshtein con corte: en cuanto pasa de `tope`, devuelve tope + 1. */
export function distancia(a, b, tope = 3) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    let min = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, fila[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      fila[j] = v;
      if (v < min) min = v;
    }
    if (min > tope) return tope + 1;
    prev = fila;
  }
  return prev[b.length];
}

/**
 * Motivos para NO insertar `cand` por parecerse a algo que ya existe.
 * `otras`: fichas ya en Supabase (y las demás candidatas de esta pasada).
 */
export function sospechas(cand, otras) {
  const motivos = [];
  for (const o of otras) {
    if (o === cand) continue;
    const mail = cand.mails.find((m) => m && o.mails.includes(m));
    if (mail) {
      motivos.push(`mismo email (${mail}) que «${o.nombre}»`);
      continue;
    }
    const tel = cand.tels.find((t) => t && o.tels.includes(t));
    if (tel) {
      motivos.push(`mismo teléfono (…${tel.slice(-6)}) que «${o.nombre}»`);
      continue;
    }
    const a = cand.clave;
    const b = o.clave;
    if (!a || !b) continue;
    if (a === b) motivos.push(`nombre equivalente al de «${o.nombre}»`);
    else if (a.length >= 12 && b.length >= 12 && (a.includes(b) || b.includes(a))) motivos.push(`nombre contenido en el de «${o.nombre}»`);
    else if (distancia(a, b, 2) <= 2) motivos.push(`nombre casi idéntico al de «${o.nombre}»`);
  }
  return motivos;
}

const identidad = (nombre, mails, tels) => ({
  nombre,
  clave: claveNombre(nombre),
  mails: [...new Set(mails.map(claveMail).filter(Boolean))],
  tels: [...new Set(tels.map(claveTel).filter(Boolean))],
});

// --- Supabase --------------------------------------------------------------
function restDe(url, key) {
  const rest = async (ruta, opciones = {}) => {
    const r = await fetch(`${url}/rest/v1/${ruta}`, {
      ...opciones,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: opciones.prefer ?? "return=minimal", ...(opciones.headers ?? {}) },
    });
    const texto = await r.text();
    if (!r.ok) {
      const e = new Error(`${ruta}: ${r.status} ${texto}`);
      e.status = r.status;
      throw e;
    }
    return texto.trim() ? JSON.parse(texto) : null;
  };
  rest.todas = async (tabla, select, filtro = "") => {
    const out = [];
    for (let desde = 0; ; desde += 1000) {
      const lote = await rest(`${tabla}?select=${encodeURIComponent(select)}${filtro}`, { headers: { Range: `${desde}-${desde + 999}` }, prefer: "count=exact" });
      out.push(...(lote ?? []));
      if (!lote || lote.length < 1000) break;
    }
    return out;
  };
  return rest;
}

const ficherosMd = (dir) => readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("00 ") && !f.startsWith("_"));

// --- Prospectos/ → crm_fichas (carril magia) -------------------------------
async function altasProspectos({ dir, rest, comprobar, informe }) {
  if (!dir || !existsSync(dir)) return;
  const existentes = await rest.todas("crm_fichas", "id,nombre,email,telefono,responsable_email,responsable_tel", "&carril=eq.magia");
  const nombres = new Set(existentes.map((f) => f.nombre));
  const identidades = existentes.map((f) => identidad(f.nombre, [f.email, f.responsable_email], [f.telefono, f.responsable_tel]));

  const candidatas = [];
  for (const f of ficherosMd(dir)) {
    const nombre = f.slice(0, -3);
    if (nombres.has(nombre)) continue;
    let leido;
    try {
      leido = filaDesdeFicha(nombre, readFileSync(join(dir, f), "utf8"));
    } catch (e) {
      informe.errores.push({ carpeta: "Prospectos", nombre, error: e.message });
      continue;
    }
    const { fila, registro } = leido;
    candidatas.push({ nombre, fila, registro, id: identidad(nombre, [fila.email, fila.responsable_email], [fila.telefono, fila.responsable_tel]) });
  }
  if (!candidatas.length) return;

  const todas = [...identidades, ...candidatas.map((c) => c.id)];
  for (const c of candidatas) {
    const motivos = sospechas(c.id, todas);
    if (motivos.length) {
      informe.dudas.push({ carpeta: "Prospectos", nombre: c.nombre, motivos });
      continue;
    }
    const alta = { carpeta: "Prospectos", tabla: "crm_fichas (magia)", nombre: c.nombre, lineas: c.registro.length, estado: c.fila.estado, proxima: c.fila.fecha_proxima_accion ?? null };
    if (comprobar) {
      informe.altas.push(alta);
      continue;
    }
    try {
      const creada = await rest("crm_fichas", { method: "POST", prefer: "return=representation", body: JSON.stringify([c.fila]) });
      const id = creada?.[0]?.id;
      if (!id) throw new Error("Supabase no ha devuelto el id de la ficha");
      if (c.registro.length) {
        const inter = c.registro.map((r) => ({ ficha_id: id, fecha: r.fecha, canal: r.canal, texto: r.texto, raw: r.raw, orden: r.orden, origen: "vault" }));
        await rest("crm_interacciones", { method: "POST", body: JSON.stringify(inter) });
      }
      informe.altas.push(alta);
    } catch (e) {
      // 409 = otra pasada la ha dado de alta mientras tanto: no es un error.
      if (e.status === 409) informe.ya_estaban.push({ carpeta: "Prospectos", nombre: c.nombre });
      else informe.errores.push({ carpeta: "Prospectos", nombre: c.nombre, error: e.message });
    }
  }
}

// --- Centros/ e Instituciones/ → charlas_centros ---------------------------
async function altasCentros({ dirs, rest, comprobar, informe }) {
  const presentes = dirs.filter((d) => d && existsSync(d));
  if (!presentes.length) return;
  const existentes = await rest.todas("charlas_centros", "id,nombre,email_centro,telefono,responsable_email,responsable_tel,ampa_email");
  const nombres = new Set(existentes.map((c) => c.nombre));
  const identidades = existentes.map((c) => identidad(c.nombre, [c.email_centro, c.responsable_email, c.ampa_email], [c.telefono, c.responsable_tel]));

  const rutas = [];
  for (const d of presentes) for (const f of ficherosMd(d)) if (!nombres.has(f.slice(0, -3))) rutas.push(join(d, f));
  if (!rutas.length) return;

  let centros;
  try {
    centros = leerFichasCentro(rutas);
  } catch (e) {
    informe.errores.push({ carpeta: "Centros", nombre: `${rutas.length} fichas`, error: `no se han podido leer con exportar-vault.py: ${String(e.message).slice(0, 200)}` });
    return;
  }

  const candidatas = centros.map((c) => {
    const fila = filaCentro(c);
    return { nombre: c.nombre, c, fila, id: identidad(c.nombre, [fila.email_centro, fila.responsable_email, fila.ampa_email], [fila.telefono, fila.responsable_tel]) };
  });
  const todas = [...identidades, ...candidatas.map((c) => c.id)];
  for (const c of candidatas) {
    const motivos = sospechas(c.id, todas);
    if (motivos.length) {
      informe.dudas.push({ carpeta: "Centros", nombre: c.nombre, motivos });
      continue;
    }
    const alta = { carpeta: "Centros", tabla: "charlas_centros", nombre: c.nombre, lineas: (c.c.registro ?? []).length, estado: c.fila.estado, proxima: c.fila.fecha_proxima_accion ?? null };
    if (comprobar) {
      informe.altas.push(alta);
      continue;
    }
    try {
      const creada = await rest("charlas_centros", { method: "POST", prefer: "return=representation", body: JSON.stringify([c.fila]) });
      const id = creada?.[0]?.id;
      if (!id) throw new Error("Supabase no ha devuelto el id del centro");
      const inter = interaccionesCentro(c.c, id);
      if (inter.length) await rest("charlas_interacciones", { method: "POST", body: JSON.stringify(inter) });
      const cont = contactosCentro(c.c, id);
      if (cont.length) await rest("charlas_contactos", { method: "POST", body: JSON.stringify(cont) });
      informe.altas.push(alta);
    } catch (e) {
      if (e.status === 409) informe.ya_estaban.push({ carpeta: "Centros", nombre: c.nombre });
      else informe.errores.push({ carpeta: "Centros", nombre: c.nombre, error: e.message });
    }
  }
}

// --- principal -------------------------------------------------------------
export async function altasVault({ url, key, vaultCharlas, comprobar = false } = {}) {
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
  vaultCharlas = vaultCharlas ?? process.env.VAULT_CHARLAS_DIR;
  if (!url || !key || !vaultCharlas) throw new Error("altas-vault: faltan SUPABASE_URL / SUPABASE_SERVICE_KEY / VAULT_CHARLAS_DIR");

  const rest = restDe(url, key);
  const informe = { altas: [], dudas: [], errores: [], ya_estaban: [], sin_tabla: [] };

  const dirProspectos = join(vaultCharlas, "..", "..", "Prospectos");
  const dirCentros = join(vaultCharlas, "Centros");
  const dirInstituciones = join(vaultCharlas, "Instituciones");
  const dirLeads = join(vaultCharlas, "..", "Entrenatzaile", "Leads");

  for (const [nombre, d] of [["Prospectos", dirProspectos], ["Centros", dirCentros]]) {
    if (!existsSync(d)) informe.errores.push({ carpeta: nombre, nombre: "(carpeta)", error: `no existe: ${d}` });
  }
  await altasProspectos({ dir: dirProspectos, rest, comprobar, informe });
  await altasCentros({ dirs: [dirCentros, dirInstituciones], rest, comprobar, informe });

  // Leads de Entrenatzaile: hoy no hay tabla de fichas en Supabase (el carril
  // 'entrenatzaile' de crm_fichas está previsto pero sin panel ni motor), así
  // que no hay dónde darlos de alta. Se cuenta para que quede en el log.
  if (existsSync(dirLeads)) informe.sin_tabla.push({ carpeta: "Leads (Entrenatzaile)", fichas: ficherosMd(dirLeads).length });

  informe.vault_charlas = vaultCharlas;
  return informe;
}

export function resumenAltas(informe, comprobar) {
  const n = informe.altas.length;
  return (
    `Altas vault → Supabase: ${n} ${n === 1 ? "ficha" : "fichas"} ${comprobar ? (n === 1 ? "se daría de alta" : "se darían de alta") : n === 1 ? "dada de alta" : "dadas de alta"}` +
    ` · ${informe.dudas.length} con dudas (no insertadas)` +
    (informe.ya_estaban.length ? ` · ${informe.ya_estaban.length} ya estaban` : "") +
    (informe.errores.length ? ` · ${informe.errores.length} con error` : "") +
    (informe.sin_tabla.length ? ` · sin tabla en Supabase: ${informe.sin_tabla.map((s) => `${s.carpeta} (${s.fichas})`).join(", ")}` : "")
  );
}

export function detalleAltas(informe) {
  const lineas = [];
  for (const a of informe.altas) lineas.push(`  + ${a.carpeta}/${a.nombre} → ${a.tabla} · estado "${a.estado}"${a.proxima ? ` · próxima acción ${a.proxima}` : ""} · ${a.lineas} líneas de Registro`);
  for (const d of informe.dudas) lineas.push(`  ? ${d.carpeta}/${d.nombre} — NO insertada: ${d.motivos.slice(0, 3).join(" · ")}`);
  for (const y of informe.ya_estaban) lineas.push(`  = ${y.carpeta}/${y.nombre} — ya estaba en Supabase`);
  for (const e of informe.errores) lineas.push(`  ! ${e.carpeta}/${e.nombre} — ${e.error}`);
  return lineas;
}

// Ejecución directa.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const comprobar = process.argv.includes("--comprobar");
  const vaultCharlas = process.argv.slice(2).find((a) => !a.startsWith("--"));
  altasVault({ comprobar, vaultCharlas })
    .then(async (informe) => {
      console.log(resumenAltas(informe, comprobar));
      for (const l of detalleAltas(informe)) console.log(l);
      if (comprobar) {
        // Comprobación extra de la simulación: ¿el espejo devolvería la nota
        // igual que está ahora, o la reescribiría? (solo informativo)
        const { renderFicha } = await import("./prospectos-lib.mjs");
        for (const a of informe.altas.filter((x) => x.carpeta === "Prospectos")) {
          const ruta = join(informe.vault_charlas, "..", "..", "Prospectos", `${a.nombre}.md`);
          const original = readFileSync(ruta, "utf8");
          const { fila, registro } = filaDesdeFicha(a.nombre, original);
          const regenerada = renderFicha(fila, registro.map((r) => ({ ...r, origen: "vault" })));
          console.log(`  · ${a.nombre}: el espejo ${regenerada === original ? "devolvería la nota idéntica" : "reescribiría la nota (hay diferencias de formato)"}`);
        }
        console.log("(modo --comprobar: no se ha escrito nada en Supabase)");
      }
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
