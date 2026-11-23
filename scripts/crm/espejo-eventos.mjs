#!/usr/bin/env node
// Espejo de los eventos de magia (23-11-2026): tabla `eventos` ⇄ notas de
// 🎩 MAGIA/📅 EVENTOS. Lo llama la pasada horaria (scripts/charlas/espejo-vault.mjs)
// ANTES del post-evento, así post-evento.mjs lee las notas ya al día.
//
//   1. Altas: nota del vault (desde el 15-10-2026) que no está en la tabla → fila.
//      Los pasos los crea el cron del servidor (lib/eventos.ts), con el estado
//      que diga el frontmatter. Si una nota se ha renombrado (cambio de fecha),
//      se reconoce por el cliente y se renombra la fila.
//   2. Fila creada en el panel sin nota → se escribe la nota con TPL - Evento.
//   3. Fecha, estado y pasos: manda el último que cambió. Panel y cron marcan
//      actualizado_en; si es posterior a espejado_en, gana la tabla; si no, gana
//      el vault. Pasos ↔ campos del frontmatter (CLAVE_VAULT, igual que en
//      lib/eventos-protocolo.ts). El resto del frontmatter es del vault: aquí
//      solo se copia a `frontmatter` para enseñarlo en el panel.
//   4. Nota generada Vías/Eventos/00 Pasos de eventos.md: lo pendiente, para la
//      skill de planificación diaria (preparación → nota diaria).
//
// Uso suelto:  node scripts/crm/espejo-eventos.mjs [--comprobar]

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DESDE = "2026-10-15";
const DIA = 86400000;
const CLAVE_VAULT = {
  mensaje_1: "rider_enviado",
  cartel: "cartel_enviado",
  pago_80: "pago_resto",
  mensaje_7dias: "mensaje_7dias",
  mensaje_vispera: "mensaje_vispera",
  guion: "prep_guion",
  material: "prep_material",
  compartido: "prep_compartido",
  ensayo: "prep_ensayo",
  maleta: "prep_maleta",
  post: "prep_post",
};
const ORDEN_FM = ["tags", "negocio", "cliente_ficha", "cliente", "fecha_evento", "hora", "lugar", "estado_evento", "show_base", "via_pago", "importe_total", "importe_neto", "factura_emitida", "fecha_cobro", "cartel_enviado", "rider_enviado", "mensaje_7dias", "mensaje_vispera", "prep_guion", "prep_material", "prep_ensayo", "prep_maleta", "prep_post", "testimonio_pedido", "testimonio_recibido"];

const hoyMadrid = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
const sumar = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") + n * DIA).toISOString().slice(0, 10);
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const corta = (iso) => {
  const d = new Date(iso + "T12:00:00Z");
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}-${MESES[d.getUTCMonth()]}`;
};
const enlace = (v) => (/\[\[([^\]|]+)/.exec(String(v ?? ""))?.[1] ?? String(v ?? "")).trim();
const nombreCorto = (n) => n.replace(/^\d{4}-\d{2}-\d{2}\s+/, "").replace(/["“”«»][^"“”«»]*["“”«»]/g, "").split(/\s+[—·-]\s+/)[0].trim();

function estadoDeValor(v) {
  const s = String(v ?? "").trim().replace(/^["']|["']$/g, "");
  if (!s || /^(false|null|~)$/i.test(s)) return { estado: "pendiente", fecha: null };
  if (/^(-|—|n\/a|no aplica)$/i.test(s)) return { estado: "no_aplica", fecha: null };
  return { estado: "hecho", fecha: /^\d{4}-\d{2}-\d{2}/.exec(s)?.[0] ?? null };
}
const valorDeEstado = (p) => (p.estado === "hecho" ? p.hecho_en ?? "true" : p.estado === "no_aplica" ? "-" : "");

// --- frontmatter plano: leer y cambiar líneas sueltas sin tocar el resto ---------------
function partir(texto) {
  const t = texto.replace(/\r/g, "");
  const m = /^---\n([\s\S]*?)\n---/.exec(t);
  return m ? { fm: m[1], resto: t.slice(m[0].length) } : null;
}
function leerFm(fmTexto) {
  const fm = {};
  for (const l of fmTexto.split("\n")) {
    const k = /^([a-z_]+):\s*(.*)$/.exec(l);
    if (!k) continue;
    fm[k[1]] = k[2].replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "");
  }
  return fm;
}
function yaml(v) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "boolean" || typeof v === "number") return ` ${v}`;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) || /^-?\d+(\.\d+)?$/.test(s) || /^(true|false)$/.test(s)) return ` ${s}`;
  if (s === "-" || /^[\[{>|*&!%@`#'"-]/.test(s) || /:\s|\s#/.test(s)) return ` ${JSON.stringify(s)}`;
  return ` ${s}`;
}
function ponerClave(fmTexto, clave, valor) {
  const linea = `${clave}:${yaml(valor)}`;
  const re = new RegExp(`^${clave}:.*$`, "m");
  return re.test(fmTexto) ? fmTexto.replace(re, linea) : `${fmTexto}\n${linea}`;
}

export async function espejoEventos({ url, key, vaultCharlas, comprobar = false }) {
  const cab = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const rest = async (ruta, op = {}) => {
    const r = await fetch(`${url}/rest/v1/${ruta}`, { ...op, headers: { ...cab, ...(op.headers ?? {}) } });
    const t = await r.text();
    if (!r.ok) throw new Error(`${ruta.split("?")[0]}: ${r.status} ${t.slice(0, 200)}`);
    return t.trim() ? JSON.parse(t) : null;
  };
  const informe = { altas: [], renombradas: [], notas_nuevas: [], a_vault: [], a_tabla: [], avisos: [] };
  const hoy = hoyMadrid();
  const empresa = join(vaultCharlas, "..", "..", "..");
  const raiz = join(empresa, "..", "..");
  const dir = join(empresa, "🎩 MAGIA", "📅 EVENTOS");
  if (!existsSync(dir)) throw new Error(`No encuentro ${dir}`);

  // --- notas del vault ---
  const notas = new Map();
  for (const f of readdirSync(dir).filter((x) => /^\d{4}-\d{2}-\d{2} .*\.md$/.test(x))) {
    const ruta = join(dir, f);
    const texto = readFileSync(ruta, "utf8");
    const p = partir(texto);
    if (!p) continue;
    const fm = leerFm(p.fm);
    const fecha = /^\d{4}-\d{2}-\d{2}/.exec(fm.fecha_evento ?? "")?.[0];
    if (!fecha || fecha < DESDE) continue;
    notas.set(f.slice(0, -3), { ruta, texto, fm, fecha });
  }

  const filas = (await rest("eventos?select=*&carril=eq.magia")) ?? [];
  const pasos = filas.length ? (await rest(`eventos_pasos?select=*&evento_id=in.(${filas.map((e) => e.id).join(",")})`)) ?? [] : [];
  const porNombre = new Map(filas.map((e) => [e.nombre, e]));
  const huerfanas = filas.filter((e) => !notas.has(e.nombre) && e.espejado_en);

  // --- 1 · altas y renombres ---
  for (const [nombre, n] of notas) {
    if (porNombre.has(nombre)) continue;
    const cliente = enlace(n.fm.cliente_ficha);
    const candidatas = huerfanas.filter((e) => enlace(e.cliente_ficha) === cliente);
    if (cliente && candidatas.length === 1) {
      const e = candidatas[0];
      if (!comprobar) await rest(`eventos?id=eq.${e.id}`, { method: "PATCH", body: JSON.stringify({ nombre }) });
      informe.renombradas.push(`${e.nombre} → ${nombre}`);
      porNombre.delete(e.nombre);
      e.nombre = nombre;
      porNombre.set(nombre, e);
      huerfanas.splice(huerfanas.indexOf(e), 1);
      continue;
    }
    let fichaId = null;
    if (cliente) {
      const [f] = (await rest(`crm_fichas?select=id&carril=eq.magia&nombre=eq.${encodeURIComponent(cliente)}`)) ?? [];
      fichaId = f?.id ?? null;
      if (!f) informe.avisos.push(`${nombre}: sin ficha «${cliente}» en el CRM`);
    }
    const ts = new Date().toISOString();
    const fila = { nombre, carril: "magia", ficha_id: fichaId, cliente_ficha: cliente || null, fecha_evento: n.fecha, estado_evento: n.fm.estado_evento || "confirmado", tipo: /·\s*Sesi[oó]n/i.test(nombre) ? "recurrente" : "show", frontmatter: n.fm, creado_desde: "vault", actualizado_en: ts, espejado_en: ts };
    if (!comprobar) {
      const [nueva] = await rest("eventos", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(fila) });
      porNombre.set(nombre, nueva);
    }
    informe.altas.push(nombre);
  }

  // --- 2 · filas del panel sin nota → nota nueva ---
  const plantilla = (() => {
    try {
      const t = readFileSync(join(raiz, "03 - RECURSOS", "_ TEMPLATES", "TPL - Evento.md"), "utf8").replace(/\r/g, "");
      return partir(t)?.resto.replace(/^\n+/, "") ?? t;
    } catch {
      return "## 1. Contexto del evento\n\n## 8. Post-evento (rellenar después)\n";
    }
  })();
  for (const e of porNombre.values()) {
    if (notas.has(e.nombre)) continue;
    if (e.espejado_en) {
      informe.avisos.push(`${e.nombre}: la nota no está en el vault (¿renombrada o movida?)`);
      continue;
    }
    const fm = { tags: null, negocio: "magia", ...(e.frontmatter ?? {}), fecha_evento: e.fecha_evento, estado_evento: e.estado_evento };
    const lineas = ["tags:", "  - evento"];
    const claves = [...ORDEN_FM.filter((k) => k !== "tags"), ...Object.keys(fm).filter((k) => !ORDEN_FM.includes(k) && k !== "tags")];
    for (const k of claves) if (k in fm) lineas.push(`${k}:${yaml(fm[k])}`);
    const cuerpo = `${plantilla.trimEnd()}\n\n## Registro\n- ${hoy} · Evento creado desde el panel (/admin → Eventos)\n`;
    const ruta = join(dir, `${e.nombre}.md`);
    if (!comprobar) {
      writeFileSync(ruta, `---\n${lineas.join("\n")}\n---\n${cuerpo}`);
      const ts = new Date().toISOString();
      await rest(`eventos?id=eq.${e.id}`, { method: "PATCH", body: JSON.stringify({ espejado_en: ts, actualizado_en: ts }) });
    }
    informe.notas_nuevas.push(e.nombre);
  }

  // --- 3 · fecha, estado y pasos en las dos direcciones ---
  for (const [nombre, n] of notas) {
    const e = porNombre.get(nombre);
    if (!e || !e.id) continue;
    const p = partir(n.texto);
    let fmTexto = p.fm;
    const ts = new Date().toISOString();
    const esp = e.espejado_en ? Date.parse(e.espejado_en) : 0;
    const tablaCambio = Date.parse(e.actualizado_en) > esp;
    const cambiosFila = {};
    const vEstado = n.fm.estado_evento || "confirmado";
    if (n.fecha !== e.fecha_evento) {
      if (tablaCambio) fmTexto = ponerClave(fmTexto, "fecha_evento", e.fecha_evento);
      else cambiosFila.fecha_evento = n.fecha;
      informe[tablaCambio ? "a_vault" : "a_tabla"].push(`${nombreCorto(nombre)}: fecha ${tablaCambio ? e.fecha_evento : n.fecha}`);
    }
    if (vEstado !== e.estado_evento) {
      if (tablaCambio) fmTexto = ponerClave(fmTexto, "estado_evento", e.estado_evento);
      else cambiosFila.estado_evento = vEstado;
      informe[tablaCambio ? "a_vault" : "a_tabla"].push(`${nombreCorto(nombre)}: estado ${tablaCambio ? e.estado_evento : vEstado}`);
    }
    for (const paso of pasos.filter((x) => x.evento_id === e.id)) {
      const campo = CLAVE_VAULT[paso.clave];
      if (!campo) continue;
      const v = estadoDeValor(n.fm[campo]);
      if (v.estado === paso.estado) continue;
      if (Date.parse(paso.actualizado_en) > esp) {
        fmTexto = ponerClave(fmTexto, campo, valorDeEstado(paso));
        informe.a_vault.push(`${nombreCorto(nombre)}: ${campo} = ${valorDeEstado(paso) || "(vacío)"}`);
      } else {
        if (!comprobar) await rest(`eventos_pasos?id=eq.${paso.id}`, { method: "PATCH", body: JSON.stringify({ estado: v.estado, hecho_en: v.estado === "hecho" ? v.fecha ?? hoy : null, hecho_por: v.estado === "pendiente" ? null : "vault", actualizado_en: ts }) });
        informe.a_tabla.push(`${nombreCorto(nombre)}: ${paso.clave} → ${v.estado}`);
        paso.estado = v.estado; // para la nota generada de abajo
      }
    }
    const fmFinal = leerFm(fmTexto);
    if (!comprobar) {
      if (fmTexto !== p.fm) writeFileSync(n.ruta, `---\n${fmTexto}\n---${p.resto}`);
      await rest(`eventos?id=eq.${e.id}`, { method: "PATCH", body: JSON.stringify({ ...cambiosFila, frontmatter: fmFinal, espejado_en: ts, actualizado_en: ts }) });
    }
  }

  // --- 4 · nota generada para la planificación diaria ---
  const vivos = [...porNombre.values()].filter((e) => e.id && e.fecha_evento >= sumar(hoy, -1) && e.fecha_evento <= sumar(hoy, 45) && !/cancel|anul|aplaz|suspend/i.test(e.estado_evento ?? ""));
  const pend = pasos
    .filter((p) => p.estado === "pendiente" && vivos.some((e) => e.id === p.evento_id))
    .map((p) => ({ ...p, ev: vivos.find((e) => e.id === p.evento_id) }))
    .sort((a, b) => (a.fecha_limite + a.fecha_ideal).localeCompare(b.fecha_limite + b.fecha_ideal));
  const linea = (p) => {
    const marca = hoy >= p.fecha_limite ? "⚠ " : hoy >= p.fecha_ideal ? "▶ " : "";
    return `- ${marca}${p.titulo} · [[${p.ev.nombre}|${nombreCorto(p.ev.nombre)} ${corta(p.ev.fecha_evento)}]] · ideal ${corta(p.fecha_ideal)} · límite ${corta(p.fecha_limite)}${p.tipo === "interno" ? ` · marcar: \`${CLAVE_VAULT[p.clave]}\`` : ""}`;
  };
  const internos = pend.filter((p) => p.tipo === "interno");
  const mensajes = pend.filter((p) => p.tipo === "mensaje");
  const sinFicha = vivos.filter((e) => !e.ficha_id).map((e) => `- [[${e.nombre}]]: sin ficha en el CRM («${e.cliente_ficha ?? "—"}»); sus mensajes no salen como tarjeta`);
  const texto = [
    "# Pasos de eventos (nota generada)",
    "",
    "> La escribe cada hora el espejo (`scripts/crm/espejo-eventos.mjs`) desde /admin → Eventos. **No editar a mano: se reescribe.** Reglas y fechas: [[00 Protocolo de eventos]] · [[2026-11-18 Encargo — aviso automático de los pasos del protocolo de eventos|Encargo]].",
    "> Para marcar un paso de preparación como hecho: pon la fecha en su campo (`marcar:`) del frontmatter de la nota del evento, o pulsa «Hecho» en el panel. ▶ = ya toca · ⚠ = límite hoy o pasado.",
    "",
    `Actualizada: ${hoy}`,
    "",
    "## Preparación (va a la nota diaria)",
    "",
    ...(internos.length ? internos.map(linea) : ["- Nada pendiente en los próximos 45 días."]),
    "",
    "## Mensajes al cliente (salen solos en la Bandeja de Magia; no van a la nota diaria)",
    "",
    ...(mensajes.length ? mensajes.map(linea) : ["- Nada pendiente."]),
    ...(sinFicha.length ? ["", "## Avisos", "", ...sinFicha] : []),
    "",
  ].join("\n");
  const rutaPasos = join(vaultCharlas, "..", "Eventos", "00 Pasos de eventos.md");
  const antes = existsSync(rutaPasos) ? readFileSync(rutaPasos, "utf8") : "";
  if (!comprobar && antes.replace(/^Actualizada: .*$/m, "") !== texto.replace(/^Actualizada: .*$/m, "")) writeFileSync(rutaPasos, texto);
  return informe;
}

export function resumenEspejoEventos(inf, comprobar) {
  const p = [];
  const n = (k, txt) => inf[k].length && p.push(`${inf[k].length} ${txt}`);
  n("altas", comprobar ? "altas que se harían" : "altas");
  n("renombradas", "renombradas");
  n("notas_nuevas", "notas nuevas");
  n("a_vault", "cambios al vault");
  n("a_tabla", "cambios a la tabla");
  const det = [...inf.altas.map((x) => `alta ${x}`), ...inf.renombradas, ...inf.notas_nuevas.map((x) => `nota ${x}`), ...inf.a_vault, ...inf.a_tabla, ...inf.avisos];
  return `Eventos: ${p.join(" · ") || "sin cambios"}${det.length ? `\n  ${det.join("\n  ")}` : ""}`;
}

// --- uso suelto -------------------------------------------------------------------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  if (existsSync(join(raiz, ".env.local"))) {
    for (const l of readFileSync(join(raiz, ".env.local"), "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  const comprobar = process.argv.includes("--comprobar");
  espejoEventos({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY, vaultCharlas: process.env.VAULT_CHARLAS_DIR, comprobar })
    .then((inf) => console.log(resumenEspejoEventos(inf, comprobar)))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
