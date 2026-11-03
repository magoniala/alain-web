#!/usr/bin/env node
// Espejo Supabase → vault del CRM de charlas.
//
// Reescribe las fichas de Centros/ a partir de charlas_centros y
// charlas_interacciones, con el mismo frontmatter y el mismo Registro que
// tenían. Dirección única: lo que está en Supabase manda. Si en el vault hay
// una línea de Registro que no está en Supabase (Alain la apuntó a mano), no
// se pisa: se sube como interacción de origen 'manual' y luego se escribe.
//
// Uso:
//   node scripts/charlas/espejo-vault.mjs --comprobar   # solo compara, no escribe
//   node scripts/charlas/espejo-vault.mjs               # escribe las fichas
//
// Variables (de .env.local del proyecto, o del entorno):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY
//   VAULT_CHARLAS_DIR  → ruta a ".../🗂️ COMERCIAL/Vías/Charlas"
//
// Sin dependencias: usa fetch contra la API REST de Supabase y escribe el
// YAML a mano (el esquema del frontmatter es plano y fijo).

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));

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

const RAIZ = join(AQUI, "..", "..");

// --- entorno ---------------------------------------------------------------
function cargarEnv() {
  const ruta = join(RAIZ, ".env.local");
  if (!existsSync(ruta)) return;
  for (const linea of readFileSync(ruta, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
cargarEnv();

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const VAULT = process.env.VAULT_CHARLAS_DIR;
const COMPROBAR = process.argv.includes("--comprobar");

function comprobarEntorno() {
  if (!URL || !KEY) {
    console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY.");
    process.exit(1);
  }
  if (!VAULT || !existsSync(join(VAULT, "Centros"))) {
    console.error("VAULT_CHARLAS_DIR no apunta a la carpeta Charlas del vault (debe contener Centros/).");
    process.exit(1);
  }
}

// --- Supabase REST -----------------------------------------------------------
async function rest(ruta, opciones = {}) {
  const r = await fetch(`${URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: opciones.method === "POST" ? "return=minimal" : "count=exact",
      ...(opciones.headers ?? {}),
    },
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${texto}`);
  // Los POST con return=minimal responden 201 sin cuerpo: no hay JSON que leer.
  return texto.trim() ? JSON.parse(texto) : null;
}

async function todas(tabla, select = "*", orden = "") {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const lote = await rest(`${tabla}?select=${encodeURIComponent(select)}${orden ? `&order=${orden}` : ""}`, {
      headers: { Range: `${desde}-${desde + 999}` },
    });
    filas.push(...lote);
    if (lote.length < 1000) break;
  }
  return filas;
}

// --- YAML a mano -----------------------------------------------------------------
const ORDEN = [
  "codigo", "territorio", "localidad", "tipo", "tipo_centro", "modelo_linguistico", "euskera", "etapas",
  "etapas_confirmadas", "direccion", "telefono", "email_centro", "web", "prioridad", "estado", "origen", "via",
  "responsable", "responsable_cargo", "responsable_email", "responsable_tel", "ampa", "ampa_contacto", "ampa_email",
  "calendario_abierto", "intentos_llamada", "mails_enviados", "fecha_ultimo_contacto", "proxima_accion",
  "bloqueado_por", "fecha_proxima_accion", "fecha_creacion", "ficha_cliente", "otros_formatos",
];
const OPCIONALES = new Set(["via", "bloqueado_por", "ficha_cliente", "otros_formatos"]);
const SIEMPRE_COMILLAS = new Set(["codigo", "telefono", "ficha_cliente", "proxima_accion"]);
const NUMERICOS = new Set(["intentos_llamada", "mails_enviados"]);

function escalar(clave, v) {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v);
  if (NUMERICOS.has(clave)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) && clave.startsWith("fecha")) return s;
  // Obsidian no sigue una regla fija (lo que se edita en el panel de
  // propiedades sale entrecomillado; lo que escriben scripts, no). Aquí se
  // entrecomilla solo cuando YAML lo exige, para que el diff sea mínimo.
  const necesita =
    SIEMPRE_COMILLAS.has(clave) ||
    /: |\s#|["\n]/.test(s) ||
    /^[\s\-?:,\[\]{}&*!|>'%@`#]/.test(s) ||
    /[\s:]$/.test(s) ||
    // "no"/"sí" de euskera van sin comillas, como las escribió el directorio.
    (/^(true|false|null|yes|on|off|~)$/i.test(s) && clave !== "euskera") ||
    /^[\d.+-]+$/.test(s);
  return necesita ? `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : s;
}

function frontmatter(c) {
  // Las instituciones (ayuntamientos, mancomunidades, Diputación) llevan su
  // propia etiqueta y carpeta para no mezclarse con la cola de centros.
  const lineas = ["---", "tags:", c.tipo === "ayuntamiento" ? "  - institucion" : "  - centro"];
  for (const k of ORDEN) {
    const v = c[k];
    if (OPCIONALES.has(k) && (v === null || v === undefined || v === "")) continue;
    if (k === "etapas") {
      const et = Array.isArray(v) ? v : [];
      if (et.length === 0) lineas.push("etapas: []");
      else {
        lineas.push("etapas:");
        for (const e of et) lineas.push(`  - ${e}`);
      }
      continue;
    }
    const s = escalar(k, v);
    lineas.push(s === "" ? `${k}:` : `${k}: ${s}`);
  }
  lineas.push("---");
  return lineas.join("\n");
}

function lineaRegistro(r) {
  if (r.raw && r.origen === "vault") return r.raw;
  const fecha = r.fecha ?? "";
  const canal = r.canal ? ` · ${r.canal}` : "";
  const texto = (r.texto ?? "").replace(/\n/g, "\n    ");
  return `- ${fecha}${canal} · ${texto}`;
}

// `registroVault`: si se pasa, es el texto del Registro tal cual está en la
// ficha actual (con sus líneas en blanco y su formato) y se conserva
// verbatim; solo se añaden debajo las líneas nuevas (panel, sistema, manual).
function ficha(c, registro, registroVault = null) {
  const vault = registro.filter((r) => r.origen === "vault").sort((a, b) => a.orden - b.orden);
  const resto = registro
    .filter((r) => r.origen !== "vault")
    .sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? "") || a.creado_en.localeCompare(b.creado_en));
  const bloque =
    registroVault !== null
      ? [registroVault.replace(/\s+$/, ""), ...resto.map(lineaRegistro)].filter(Boolean).join("\n")
      : [...vault, ...resto].map(lineaRegistro).join("\n");

  let cuerpo = `${frontmatter(c)}\n\n## Registro\n\n${bloque}\n\n## Notas\n\n${c.notas ?? ""}`;
  for (const [titulo, texto] of Object.entries(c.secciones_extra ?? {})) {
    cuerpo += `\n\n${titulo}\n\n${texto}`;
  }
  return cuerpo.replace(/\s+$/, "") + "\n";
}

// --- lectura de la ficha actual (para comparar y para rescatar apuntes a mano) ---
function partir(texto) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(texto);
  if (!m) return { fm: {}, cuerpo: texto };
  const fm = {};
  let lista = null;
  for (const l of m[1].split("\n")) {
    const li = /^\s+-\s*(.*)$/.exec(l);
    if (li && lista) {
      fm[lista].push(li[1].trim());
      continue;
    }
    const kv = /^([a-zA-Z_]+):\s*(.*)$/.exec(l);
    if (!kv) continue;
    const [, k, v] = kv;
    if (v === "" && (k === "etapas" || k === "tags")) {
      fm[k] = [];
      lista = k;
      continue;
    }
    lista = null;
    fm[k] = v === "[]" ? [] : v.replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"');
  }
  return { fm, cuerpo: m[2] };
}

function registroDe(cuerpo) {
  const m = /## Registro\n([\s\S]*?)(?=\n## |$)/.exec(cuerpo);
  if (!m) return [];
  return m[1]
    .split("\n")
    .filter((l) => l.trim().startsWith("-"))
    .map((l) => l.trimEnd());
}

function normal(v, clave) {
  if (v === null || v === undefined) return clave && NUMERICOS.has(clave) ? "0" : "";
  if (Array.isArray(v)) return v.join("|");
  const s = String(v).trim();
  return clave && NUMERICOS.has(clave) && s === "" ? "0" : s;
}

// --- principal -------------------------------------------------------------------
async function main() {
  comprobarEntorno();
  const [centros, interacciones] = await Promise.all([
    todas("charlas_centros", "*", "nombre"),
    todas("charlas_interacciones", "*", "centro_id,fecha,orden"),
  ]);
  const porCentro = new Map();
  for (const i of interacciones) {
    if (!porCentro.has(i.centro_id)) porCentro.set(i.centro_id, []);
    porCentro.get(i.centro_id).push(i);
  }

  const dir = join(VAULT, "Centros");
  const dirInst = join(VAULT, "Instituciones");
  if (!existsSync(dirInst)) mkdirSync(dirInst, { recursive: true });
  const enVault = new Set(readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)));

  let iguales = 0;
  let distintas = 0;
  let nuevas = 0;
  const apuntesManuales = [];
  const diferencias = [];
  const subidasVault = [];

  for (const c of centros) {
    const ruta = join(c.tipo === "ayuntamiento" ? dirInst : dir, `${c.nombre.replace(/[\/\\:*?"<>|]/g, "-")}.md`);
    const registro = porCentro.get(c.id) ?? [];
    enVault.delete(c.nombre);

    if (!existsSync(ruta)) {
      nuevas++;
      if (!COMPROBAR) escribir(ruta, ficha(c, registro));
      continue;
    }

    const actual = readFileSync(ruta, "utf8");
    const { fm, cuerpo } = partir(actual);

    // Líneas del Registro escritas a mano desde la última importación: no
    // están en Supabase. Se suben como 'manual' antes de reescribir.
    // Una entrada puede ocupar varias líneas (párrafo debajo de la línea con
    // fecha): se reconocen todas sus líneas, no solo la entrada completa.
    const conocidas = new Set(
      registro.flatMap((r) => [r.raw ?? "", lineaRegistro(r)]).flatMap((t) => t.split("\n")).map((l) => l.trimEnd()).filter(Boolean)
    );
    const conocidasTexto = conocidas;
    for (const l of registroDe(cuerpo)) {
      if (conocidas.has(l) || conocidasTexto.has(l)) continue;
      const m = /^-\s*(\d{4}-\d{2}-\d{2})?\s*(?:[·\-]\s*)?(.*)$/.exec(l.trim());
      const nueva = {
        centro_id: c.id,
        fecha: m?.[1] ?? null,
        canal: "Manual",
        texto: (m?.[2] ?? l).trim(),
        raw: l,
        orden: 900 + apuntesManuales.length,
        origen: "manual",
      };
      apuntesManuales.push(nueva);
      registro.push({ ...nueva, creado_en: new Date().toISOString() });
    }

    // Comparación semántica: mismo frontmatter (normalizado) y mismas líneas.
    const difs = [];
    for (const k of ORDEN) {
      const esperado = normal(c[k], k);
      const real = normal(fm[k], k);
      if (esperado !== real) difs.push(`${k}: vault="${real}" · db="${esperado}"`);
    }
    // Si la nota se ha tocado en Obsidian después del último cambio en
    // Supabase (Alain cambia el estado o la próxima acción a mano), gana el
    // vault: se sube lo que difiere y esta vez no se reescribe la nota. Si lo
    // último fue del panel o del sistema, gana Supabase (como hasta ahora).
    if (difs.length && tocadaEnObsidian(ruta, c.actualizado_en)) {
      const cambios = {};
      for (const k of ORDEN) {
        if (normal(c[k], k) === normal(fm[k], k)) continue;
        let v = fm[k];
        if (k === "etapas") v = Array.isArray(v) ? v : String(v ?? "").split(/\s*,\s*/).filter(Boolean);
        else if (v === undefined || String(v).trim() === "") v = NUMERICOS.has(k) ? 0 : null;
        else if (NUMERICOS.has(k)) v = Number(v) || 0;
        cambios[k] = v;
      }
      cambios.actualizado_por = "vault";
      subidasVault.push({ nombre: c.nombre, difs });
      if (!COMPROBAR) await rest(`charlas_centros?id=eq.${c.id}`, { method: "PATCH", body: JSON.stringify(cambios) });
      continue;
    }
    const nuevo = ficha(c, registro);
    const regVault = registroDe(cuerpo).map((l) => l.trim());
    const regNuevo = registroDe(nuevo.split("\n---\n")[1] ?? nuevo).map((l) => l.trim());
    if (regVault.join("\n") !== regNuevo.join("\n")) {
      difs.push(`registro: ${regVault.length} líneas en vault, ${regNuevo.length} generadas`);
    }

    if (difs.length === 0) iguales++;
    else {
      distintas++;
      diferencias.push({ nombre: c.nombre, difs });
    }

    // Solo se reescribe lo que ha cambiado de verdad, y conservando el
    // Registro tal cual estaba (líneas en blanco incluidas): así Obsidian no
    // ve 344 ficheros tocados cada hora.
    if (!COMPROBAR && difs.length > 0) {
      const mReg = /## Registro\n([\s\S]*?)(?=\n## |$)/.exec(cuerpo);
      const soloNuevas = difs.every((d) => d.startsWith("registro:"));
      const registroVault = soloNuevas && mReg ? mReg[1] : null;
      escribir(ruta, ficha(c, registro, registroVault));
    }
  }

  if (!COMPROBAR && apuntesManuales.length) {
    await rest("charlas_interacciones", { method: "POST", body: JSON.stringify(apuntesManuales) });
  }
  if (!COMPROBAR) guardarEstadoEspejo();

  console.log(
    `${centros.length} centros en Supabase · ${iguales} fichas iguales · ${distintas} con diferencias · ${nuevas} nuevas` +
      ` · ${apuntesManuales.length} apuntes a mano ${COMPROBAR ? "detectados" : "subidos"}` +
      ` · ${subidasVault.length} fichas cambiadas en Obsidian ${COMPROBAR ? "por subir" : "subidas"}` +
      (enVault.size ? ` · ${enVault.size} fichas en el vault que no están en Supabase: ${[...enVault].slice(0, 5).join(", ")}` : "")
  );
  for (const d of subidasVault.slice(0, 15)) console.log(`\n↑ ${d.nombre} (cambiada en Obsidian)\n    ${d.difs.join("\n    ")}`);
  for (const d of diferencias.slice(0, 15)) {
    console.log(`\n· ${d.nombre}`);
    for (const x of d.difs) console.log(`    ${x}`);
  }
  if (diferencias.length > 15) console.log(`\n… y ${diferencias.length - 15} más.`);
  if (COMPROBAR) console.log("\n(modo --comprobar: no se ha escrito nada)");

  if (!COMPROBAR) await espejoDiario(centros);
}

// ---------------------------------------------------------------------------
// Bandeja diaria, Volumen y nota diaria.
//
// Reproduce lo que Alain hacía a mano cada día en el vault: la nota
// "Bandeja — respuestas DD-MM-AAAA" (qué ha llegado, qué ha salido, qué queda
// por revisar), el recuento de contactos en "Volumen — <mes>" y una línea en
// la nota diaria con enlace a la bandeja y al panel. Se regenera cada hora
// para hoy (y para ayer, por si quedó algo de última hora). Lo que escribe el
// sistema va marcado; lo que Alain escribe a mano no se toca.
// ---------------------------------------------------------------------------
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaMadrid = (d = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);
const ddmmaaaa = (iso) => iso.split("-").reverse().join("-");
const horaMadrid = (iso) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

// Quita la parte citada de una respuesta (lo que ya está en el hilo).
function sinCita(texto) {
  const lineas = texto.replace(/\r/g, "").split("\n");
  const corte = lineas.findIndex((l) => /^>/.test(l.trim()) || /(escribió|wrote|idatzi zuen|idatzi du)\s*:\s*$/i.test(l.trim()) || /^-{2,}\s*(Mensaje original|Original Message)/i.test(l.trim()));
  return (corte > 0 ? lineas.slice(0, corte) : lineas).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function configValor(clave, defecto) {
  const r = await rest(`charlas_config?select=valor&clave=eq.${encodeURIComponent(clave)}`);
  return r?.[0]?.valor ?? defecto;
}

async function espejoDiario(centros) {
  const nombrePorId = new Map(centros.map((c) => [c.id, c.nombre]));
  const hoy = fechaMadrid();
  const ayer = fechaMadrid(new Date(Date.now() - 86400000));
  const bandejaOn = (await configValor("espejo_bandeja_diaria", true)) !== false;
  const notaOn = (await configValor("espejo_nota_diaria", true)) !== false;

  // Todo lo de ayer y hoy, de una vez.
  const desde = `${ayer}T00:00:00+01:00`;
  const [entrantes, salientes, tareas, pendientes, llamadas] = await Promise.all([
    rest(`charlas_mensajes?select=centro_id,de,asunto,fecha,clasificacion,resumen,estado&direccion=eq.entrante&fecha=gte.${encodeURIComponent(desde)}&order=fecha`),
    rest(`charlas_mensajes?select=centro_id,para,asunto,fecha,texto,tipo_salida,estado&direccion=eq.saliente&fecha=gte.${encodeURIComponent(desde)}&order=fecha`),
    rest(`charlas_tareas?select=centro_id,tipo,estado,urgencia,resuelto_en,resuelto_por,motivo,contexto&resuelto_en=gte.${encodeURIComponent(desde)}&order=resuelto_en`),
    rest(`charlas_tareas?select=centro_id,tipo,nivel,urgencia,urgencia_motivo,contexto,creado_en&estado=eq.revisar&order=urgencia.desc,creado_en`),
    rest(`charlas_interacciones?select=centro_id,fecha,canal&canal=eq.Llamada&fecha=gte.${ayer}`),
  ]);

  const dirBandejas = join(VAULT, "Bandejas");
  if (!existsSync(dirBandejas)) mkdirSync(dirBandejas);
  const raizVault = join(VAULT, "..", "..", "..", "..", "..");

  for (const dia of [ayer, hoy]) {
    const ent = (entrantes ?? []).filter((m) => fechaMadrid(new Date(m.fecha)) === dia && m.estado !== "ignorado");
    const sal = (salientes ?? []).filter((m) => fechaMadrid(new Date(m.fecha)) === dia && m.tipo_salida !== "prueba");
    const res = (tareas ?? []).filter((t) => t.resuelto_en && fechaMadrid(new Date(t.resuelto_en)) === dia);
    const nombre = (id) => nombrePorId.get(id) ?? "¿Centro?";
    const enlace = (id) => (nombrePorId.has(id) ? `[[${nombrePorId.get(id)}]]` : "¿Centro?");

    if (bandejaOn && (ent.length || sal.length || res.length || dia === hoy)) {
      const lineas = [
        "---",
        "tags:",
        "  - bandeja",
        "  - sistema",
        `fecha: ${dia}`,
        "---",
        "",
        `# Bandeja — ${ddmmaaaa(dia)} (sistema)`,
        "",
        `Generada por el sistema a las ${horaMadrid(new Date().toISOString())}. Se actualiza sola cada hora. Panel: [[00 Panel charlas]] · bandeja en vivo: www.alainzulaika.com/admin → Charlas.`,
        "",
        `## Han llegado · ${ent.length}`,
        "",
      ];
      if (!ent.length) lineas.push("Nada.");
      for (const m of ent) {
        lineas.push(`- **${enlace(m.centro_id)}** · ${horaMadrid(m.fecha)} · ${m.de ?? ""} · *${m.clasificacion ?? "sin clasificar"}*`);
        if (m.resumen) lineas.push(`\t- ${m.resumen}`);
      }
      lineas.push("", `## Han salido · ${sal.length}`, "");
      if (!sal.length) lineas.push("Nada.");
      for (const m of sal) {
        lineas.push(`### ${nombre(m.centro_id)} · ${horaMadrid(m.fecha)} · ${(m.para ?? []).join(", ")}`, "", `**${m.asunto ?? ""}**`, "");
        for (const l of sinCita(String(m.texto ?? "")).split("\n")) lineas.push(`> ${l}`);
        lineas.push("");
      }
      const descartadas = res.filter((t) => t.estado === "descartada" && t.resuelto_por === "alain");
      if (descartadas.length) {
        lineas.push(`## Descartadas por Alain · ${descartadas.length}`, "");
        for (const t of descartadas) lineas.push(`- ${enlace(t.centro_id)} · ${t.tipo}${t.motivo ? ` · ${t.motivo}` : ""}`);
        lineas.push("");
      }
      if (dia === hoy) {
        lineas.push(`## Pendiente en la bandeja · ${(pendientes ?? []).length}`, "");
        if (!(pendientes ?? []).length) lineas.push("Nada.");
        for (const t of pendientes ?? []) {
          const u = t.urgencia === 3 ? "🔴" : t.urgencia === 2 ? "🟠" : "🟢";
          lineas.push(`- ${u} ${enlace(t.centro_id)} · ${t.contexto?.resumen ?? t.tipo}${t.urgencia_motivo ? ` · _${t.urgencia_motivo}_` : ""}`);
        }
      }
      writeFileSync(join(dirBandejas, `Bandeja — ${ddmmaaaa(dia)}.md`), lineas.join("\n").replace(/\n{3,}/g, "\n\n") + "\n", "utf8");
    }

    // Volumen del mes: sección propia del sistema debajo de la tabla de Alain.
    const [y, m] = dia.split("-");
    const rutaVol = join(VAULT, "..", "..", `Volumen — ${MESES[Number(m) - 1]} ${y}.md`);
    if (existsSync(rutaVol)) {
      const txt = readFileSync(rutaVol, "utf8");
      const llam = (llamadas ?? []).filter((l) => l.fecha === dia).length;
      const fila = `| ${dia} | ${sal.length} | ${ent.length} | ${llam} |`;
      const ini = "<!-- sistema-volumen -->";
      const fin = "<!-- /sistema-volumen -->";
      let bloque = txt.includes(ini) ? txt.slice(txt.indexOf(ini) + ini.length, txt.indexOf(fin)).trim() : "";
      const filas = bloque.split("\n").filter((l) => /^\| \d{4}-\d{2}-\d{2} \|/.test(l) && !l.startsWith(`| ${dia} |`));
      filas.push(fila);
      filas.sort();
      const nuevoBloque = `${ini}\n## Automático (sistema)\n\nLo que el sistema ha visto cada día: correos enviados a centros, correos recibidos de centros y llamadas apuntadas en el Registro. No sustituye a tu recuento de arriba; lo complementa.\n\n| Fecha | Mails enviados | Recibidos | Llamadas |\n| --- | --- | --- | --- |\n${filas.join("\n")}\n${fin}`;
      const nuevo = txt.includes(ini) ? txt.slice(0, txt.indexOf(ini)) + nuevoBloque + txt.slice(txt.indexOf(fin) + fin.length) : txt.replace(/\s+$/, "") + "\n\n" + nuevoBloque + "\n";
      if (nuevo !== txt) writeFileSync(rutaVol, nuevo, "utf8");
    }
  }

  // Nota diaria de hoy: una línea del sistema, entre marcadores, al final.
  if (notaOn) {
    const [y, m] = hoy.split("-");
    const rutaDia = join(raizVault, "02 - AREAS", "PERSONAL", "📆 Notas diarias", y, `${y}-${m}`, `${hoy}.md`);
    if (existsSync(rutaDia)) {
      const txt = readFileSync(rutaDia, "utf8");
      const n = (pendientes ?? []).length;
      const rojas = (pendientes ?? []).filter((t) => t.urgencia === 3).length;
      const linea = `- **Charlas (sistema):** ${n === 0 ? "bandeja vacía" : `${n} por revisar${rojas ? ` (${rojas} 🔴)` : ""}`} · [[Bandeja — ${ddmmaaaa(hoy)}]] · [[00 Panel charlas]] · www.alainzulaika.com/admin`;
      const ini = "<!-- charlas-sistema -->";
      const fin = "<!-- /charlas-sistema -->";
      const bloque = `${ini}\n${linea}\n${fin}`;
      const nuevo = txt.includes(ini) ? txt.slice(0, txt.indexOf(ini)) + bloque + txt.slice(txt.indexOf(fin) + fin.length) : txt.replace(/\s+$/, "") + "\n\n" + bloque + "\n";
      if (nuevo !== txt) writeFileSync(rutaDia, nuevo, "utf8");
    }
  }
  console.log(`Bandeja diaria, Volumen y nota diaria actualizados (${hoy}).`);
}

export { ficha, frontmatter, partir, registroDe, lineaRegistro, normal, ORDEN };

// Tras las charlas, el CRM de magia (Prospectos/), si existe: misma tarea de launchd.
async function espejoMagia() {
  try {
    const { espejoProspectos } = await import("../crm/espejo-prospectos.mjs");
    const r = await espejoProspectos({ url: URL, key: KEY, comprobar: COMPROBAR });
    if (r.saltado) return console.log(`Prospectos: saltado (${r.saltado})`);
    console.log(`Prospectos (magia): ${r.fichas} fichas · ${r.iguales} iguales · ${r.distintas} con diferencias · ${r.nuevas} nuevas · ${r.manuales} apuntes a mano ${COMPROBAR ? "detectados" : "subidos"}`);
  } catch (e) {
    // Si las tablas crm_* aún no existen o la carpeta no está, no pasa nada: el espejo de charlas ya ha terminado.
    console.log(`Prospectos: no espejado (${String(e.message).slice(0, 160)})`);
  }
}

// Reservas de la Hoja de Ruta con WhatsApp enviado desde el panel → ficha del lead en Vías/Entrenatzaile/Leads/.
async function espejoReservasHojaRuta() {
  try {
    const { espejoReservas } = await import("../leads/espejo-reservas.mjs");
    const dirLeads = join(VAULT, "..", "Entrenatzaile", "Leads");
    const r = await espejoReservas({ dirLeads, url: URL, key: KEY, comprobar: COMPROBAR });
    if (r.saltado) return console.log(`Reservas Hoja de Ruta: saltado (${r.saltado})`);
    if (r.reservas) console.log(`Reservas Hoja de Ruta: ${r.apuntadas} apuntadas en fichas de leads${r.sin_ficha.length ? ` · sin ficha: ${r.sin_ficha.join(", ")}` : ""}`);
  } catch (e) {
    console.log(`Reservas Hoja de Ruta: no espejadas (${String(e.message).slice(0, 160)})`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .then(espejoMagia)
    .then(espejoReservasHojaRuta)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
