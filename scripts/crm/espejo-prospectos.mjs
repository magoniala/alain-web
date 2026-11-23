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
import { parseFicha, renderFicha, igual, perfilDe, valorDe } from "./prospectos-lib.mjs";


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
// Foto del frontmatter tal y como quedó sincronizado en la última pasada
// (ruta → { clave: valor }). Sirve para saber QUÉ campos ha tocado Alain en
// Obsidian: solo esos se suben. Antes se subía todo lo que difería en cuanto la
// nota tenía un cambio posterior al de Supabase, y un frontmatter viejo pisaba
// el panel (Dilo Advertising, 12-11-2026: el 8 Perdido del panel volvió a
// 0 Por contactar porque se añadió una línea al Registro desde Obsidian).
const FOTOS_ESPEJO = join(dirname(fileURLToPath(import.meta.url)), ".espejo-fotos.json");
const fotos = (() => { try { return JSON.parse(readFileSync(FOTOS_ESPEJO, "utf8")); } catch { return {}; } })();
const fotoDe = (f) => Object.fromEntries(perfilDe(f).claves.map((k) => [k, valorDe(f, k)]));
function guardarFotos() {
  try { writeFileSync(FOTOS_ESPEJO, JSON.stringify(fotos), "utf8"); } catch { /* no es crítico */ }
}
const tocadaEnObsidian = (ruta, actualizadoEn) => {
  const m = statSync(ruta).mtimeMs;
  return escritas[ruta] !== m && m > Date.parse(actualizadoEn) + 5000;
};

// Desde el 23-11-2026 sirve para los dos carriles del CRM genérico: magia
// (Prospectos/) y entrenatzaile (Vías/Entrenatzaile/Leads/). Mismas reglas.
export async function espejoProspectos({ dir, url, key, comprobar = false, carril = "magia" } = {}) {
  const perfil = perfilDe(carril);
  const CLAVES = perfil.claves;
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
  const sub = carril === "magia" ? ["..", "..", "Prospectos"] : ["..", "Entrenatzaile", "Leads"];
  dir = dir ?? (process.env.VAULT_CHARLAS_DIR ? join(process.env.VAULT_CHARLAS_DIR, ...sub) : null);
  if (!url || !key || !dir || !existsSync(dir)) throw new Error(`espejo (${carril}): faltan credenciales o la carpeta de fichas`);

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

  const claveCfg = carril === "magia" ? "magia_espejo" : "leads_espejo";
  const { data: cfg } = { data: await rest(`charlas_config?select=valor&clave=eq.${claveCfg}`) };
  if (cfg?.[0]?.valor === false) return { saltado: `${claveCfg} = false` };

  const [fichas, interacciones] = await Promise.all([todas("crm_fichas", "*", "nombre").then((f) => f.filter((x) => x.carril === carril)), todas("crm_interacciones", "*", "ficha_id,fecha,orden")]);
  const porFicha = new Map();
  for (const i of interacciones) {
    if (!porFicha.has(i.ficha_id)) porFicha.set(i.ficha_id, []);
    porFicha.get(i.ficha_id).push(i);
  }

  // Leads: lo enviado desde el panel se apunta en «## Mensajes» de la nota (como cuando se
  // preparaba a mano), para que el vault siga teniendo el historial completo. Una vez.
  const enviadas = new Map();
  if (carril === "entrenatzaile") {
    const filas = (await rest(`crm_tareas?carril=eq.entrenatzaile&estado=eq.enviada&texto_final=not.is.null&contexto->>en_vault=is.null&select=id,ficha_id,tipo,canal,texto_final,resuelto_en,contexto&order=resuelto_en`, { prefer: "return=representation" })) ?? [];
    for (const x of filas) {
      if (!enviadas.has(x.ficha_id)) enviadas.set(x.ficha_id, []);
      enviadas.get(x.ficha_id).push(x);
    }
  }
  const marcarEnVault = [];
  const ETQ = { check_in: "Check-in", seguimiento: "Seguimiento", recordatorio: "Mensaje", respuesta: "Respuesta" };

  const enVault = new Set(readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)));
  let iguales = 0;
  let distintas = 0;
  let nuevas = 0;
  let cuerpos = 0;
  const manuales = [];
  const diferencias = [];
  const subidas = [];

  for (const f of fichas) {
    const ruta = join(dir, `${f.nombre.replace(/[\/\\:*?"<>|]/g, "-")}.md`);
    enVault.delete(f.nombre);
    const registro = porFicha.get(f.id) ?? [];
    if (!existsSync(ruta)) {
      nuevas++;
      if (!comprobar) {
        escribir(ruta, renderFicha(f, registro));
        fotos[ruta] = fotoDe(f);
      }
      continue;
    }
    const actual = readFileSync(ruta, "utf8");
    let p;
    try {
      p = parseFicha(actual, perfil);
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
    for (const x of enviadas.get(f.id) ?? []) {
      const dia = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit" }).format(new Date(x.resuelto_en ?? Date.now())).replace("/", "-");
      const canal = x.canal === "mail" ? "mail, mismo hilo" : x.canal === "whatsapp" ? "WhatsApp" : "otra vía";
      const bloque = `### ${ETQ[x.tipo] ?? x.tipo} · enviado desde el panel (${dia}, ${canal})\n\n\`\`\`\n${String(x.texto_final).trim()}\n\`\`\`\n\n`;
      const desp = p.cuerpo_despues ?? "";
      const i = desp.search(/^## Mensajes[^\n]*\n/m);
      if (i >= 0) {
        // Al final de la sección (va de más antiguo a más nuevo), antes del siguiente «## ».
        const inicio = desp.indexOf("\n", i) + 1;
        const sig = desp.slice(inicio).search(/^## /m);
        const fin = sig >= 0 ? inicio + sig : desp.length;
        const seccion = desp.slice(0, fin).replace(/\n*$/, "\n\n");
        p.cuerpo_despues = `${seccion}${bloque}${desp.slice(fin)}`;
      } else p.cuerpo_despues = `${desp.replace(/\n*$/, desp ? "\n\n" : "")}## Mensajes\n\n${bloque}`;
      marcarEnVault.push(x);
    }
    // El cuerpo de la nota (Su caso, Mensajes, Notas, bloque mensaje-listo…) y la forma del
    // frontmatter son del vault: el servidor nunca los escribe, y los chats y Alain sí los
    // tocan a diario. Antes se regeneraba la nota con la copia de Supabase y un cambio en el
    // cuerpo hecho en Obsidian se perdía en la pasada siguiente (visto el 23-11-2026 al meter
    // los leads). Ahora se toma siempre el de la nota y, si ha cambiado, se sube.
    if (p.cuerpo_antes !== f.cuerpo_antes || (p.cuerpo_despues ?? null) !== (f.cuerpo_despues ?? null) || p.frontmatter_raw !== f.frontmatter_raw) {
      cuerpos++;
      if (!comprobar) await rest(`crm_fichas?id=eq.${f.id}`, { method: "PATCH", body: JSON.stringify({ cuerpo_antes: p.cuerpo_antes, cuerpo_despues: p.cuerpo_despues, frontmatter_raw: p.frontmatter_raw }) });
      f.cuerpo_antes = p.cuerpo_antes;
      f.cuerpo_despues = p.cuerpo_despues;
      f.frontmatter_raw = p.frontmatter_raw;
    }
    const db = (k) => valorDe(f, k, perfil);
    const calcularDifs = () => CLAVES.filter((k) => !igual(p.frontmatter[k], db(k), k, perfil)).map((k) => `${k}: vault="${p.frontmatter[k] ?? ""}" · db="${db(k) ?? ""}"`);
    let difs = calcularDifs();
    // Si la nota se ha tocado en Obsidian después del último cambio en
    // Supabase, se suben SOLO los campos que Alain ha cambiado en Obsidian
    // (los que difieren de la foto de la última pasada). El resto del
    // frontmatter puede estar viejo (la nota se editó antes de que el espejo
    // bajara un cambio del panel): ahí gana Supabase y la nota se reescribe.
    const base = fotos[ruta];
    if (difs.length && tocadaEnObsidian(ruta, f.actualizado_en)) {
      const tocados = base ? CLAVES.filter((k) => !igual(p.frontmatter[k], base[k] ?? null, k, perfil)) : CLAVES;
      const aSubir = tocados.filter((k) => !igual(p.frontmatter[k], db(k), k, perfil));
      const cambios = {};
      const datos = { ...(f.datos ?? {}) };
      let conDatos = false;
      for (const k of aSubir) {
        let v = p.frontmatter[k];
        if (v === "" || v === undefined) v = null;
        if (k === "enviado" && v !== null && typeof v !== "boolean") v = String(v) === "true";
        const col = perfil.columnas[k];
        if (col) cambios[col] = v;
        else {
          datos[k] = v;
          conDatos = true;
        }
      }
      if (conDatos) cambios.datos = datos;
      if (aSubir.length) {
        cambios.actualizado_por = "vault";
        subidas.push({ nombre: f.nombre, difs: difs.filter((d) => aSubir.includes(d.split(":")[0])) });
        if (!comprobar) await rest(`crm_fichas?id=eq.${f.id}`, { method: "PATCH", body: JSON.stringify(cambios) });
      }
      if (!base) {
        // Sin foto (primera pasada con esta versión): como antes, la nota no se reescribe.
        if (!comprobar) fotos[ruta] = fotoDe({ ...f, ...cambios, datos: conDatos ? datos : f.datos });
        continue;
      }
      // Lo subido ya está en Supabase; lo demás que difiera lo pone Supabase.
      for (const k of Object.keys(cambios)) if (k !== "actualizado_por") f[k] = cambios[k];
      difs = calcularDifs();
    }
    const nuevo = renderFicha(f, registro);
    if (!comprobar) fotos[ruta] = fotoDe(f);
    if (difs.length === 0 && nuevo === actual) {
      iguales++;
      continue;
    }
    distintas++;
    if (difs.length) diferencias.push({ nombre: f.nombre, difs });
    if (!comprobar) escribir(ruta, nuevo);
  }

  if (!comprobar && manuales.length) await rest("crm_interacciones", { method: "POST", body: JSON.stringify(manuales) });
  if (!comprobar) for (const x of marcarEnVault) await rest(`crm_tareas?id=eq.${x.id}`, { method: "PATCH", body: JSON.stringify({ contexto: { ...(x.contexto ?? {}), en_vault: true } }) });
  if (!comprobar) {
    guardarEstadoEspejo();
    guardarFotos();
  }

  return { fichas: fichas.length, iguales, distintas, nuevas, cuerpos, manuales: manuales.length, subidas: subidas.length, sin_supabase: [...enVault], diferencias, detalle_subidas: subidas };
}

// Ejecución directa.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const comprobar = process.argv.includes("--comprobar");
  const carril = process.argv.includes("--leads") ? "entrenatzaile" : "magia";
  const dir = process.argv.slice(2).find((a) => !a.startsWith("--"));
  espejoProspectos({ dir, comprobar, carril })
    .then((r) => {
      if (r.saltado) return console.log(`Prospectos: saltado (${r.saltado})`);
      console.log(`${carril === "magia" ? "Prospectos (magia)" : "Leads (Entrenatzaile)"}: ${r.fichas} fichas en Supabase · ${r.iguales} iguales · ${r.distintas} con diferencias · ${r.nuevas} nuevas · ${r.manuales} apuntes a mano ${comprobar ? "detectados" : "subidos"} · ${r.subidas} fichas cambiadas en Obsidian ${comprobar ? "por subir" : "subidas"}${r.sin_supabase.length ? ` · en el vault sin Supabase: ${r.sin_supabase.slice(0, 5).join(", ")}` : ""}`);
      for (const d of r.detalle_subidas.slice(0, 10)) console.log(`↑ ${d.nombre} (cambiada en Obsidian)\n    ${d.difs.join("\n    ")}`);
      for (const d of r.diferencias.slice(0, 10)) console.log(`· ${d.nombre}\n    ${d.difs.join("\n    ")}`);
      if (comprobar) console.log("(modo --comprobar: no se ha escrito nada)");
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
