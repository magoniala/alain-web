#!/usr/bin/env node
// Espejo al vault de lo que se guarda desde Correo › Por revisar (28-11-2026):
//   · tabla `testimonios`  → Testimonios charlas.md / Testimonios Entrenatzaile.md / Testimonios magia.md
//   · tabla `correo_respuestas_news` → 📰 Newsletter/Respuestas de suscriptores.md
//
// Lo llama la pasada horaria (scripts/charlas/espejo-vault.mjs), sin cron nuevo. Solo AÑADE al
// final de las notas (nunca reescribe lo que ya hay) y es idempotente: cada fila lleva un
// marcador <!-- id:… --> y se marca `espejado_en` al volcarla. Si el testimonio ya está en la
// nota (volcado a mano, como el de Garbiñe del 25-11), no lo duplica: lo enlaza.
// Los pendientes de correo NO se espejan (decisión de Alain, 28-11).
// El Registro de las fichas no pasa por aquí: las líneas van a `charlas_interacciones` y las baja
// el espejo de siempre. Sin .bak.
//
// Uso suelto:  SUPABASE_URL=… SUPABASE_SERVICE_KEY=… VAULT_CHARLAS_DIR=… node scripts/crm/espejo-correo.mjs [--comprobar]

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PERMISO_TXT = {
  solo_anonimo: "SOLO ANÓNIMO: sin nombre ni cargo",
  no_consta: "SOLO ANÓNIMO (el permiso no consta: pedirlo antes de usar el nombre)",
  con_nombre: "Con nombre: se puede usar su nombre",
};
const DONDE_TXT = { objecion: "objeción", dossier: "dossier", cierre: "cierre", web: "web" };
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const corta = (iso) => (iso ? `${Number(iso.slice(8, 10))}-${MESES[Number(iso.slice(5, 7)) - 1]}` : "");
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function rutas(vaultCharlas) {
  const vias = dirname(vaultCharlas); // …/COMERCIAL/Vías
  const empresa = dirname(dirname(vias)); // …/💼 EMPRESA
  return {
    charlas: join(vaultCharlas, "Testimonios charlas.md"),
    entrenatzaile: join(vias, "Entrenatzaile", "Testimonios Entrenatzaile.md"),
    magia: join(vias, "Eventos", "Testimonios magia.md"),
    newsletter: join(empresa, "📰 Newsletter", "Respuestas de suscriptores.md"),
  };
}

/** ¿El texto del testimonio ya está en la nota? (3 trozos de 40 caracteres, 2 o más coinciden). */
function yaVolcado(nota, texto) {
  const t = norm(texto);
  if (t.length < 80) return false;
  const n = norm(nota);
  const trozos = [0.2, 0.5, 0.8].map((p) => t.slice(Math.floor(t.length * p), Math.floor(t.length * p) + 40));
  return trozos.filter((x) => n.includes(x)).length >= 2;
}

const citar = (texto) => String(texto).trim().split("\n").map((l) => (l.trim() ? `> ${l}` : ">")).join("\n");

function bloqueCharlas(t) {
  const nombre = t.quien || "Anónimo";
  const marca = t.permiso === "con_nombre" ? "" : " · SOLO ANÓNIMO (sin nombre ni cargo)";
  const donde = (t.donde ?? []).map((d) => DONDE_TXT[d] ?? d).join(", ");
  return [
    "",
    `### ${nombre}${t.centro ? ` (${t.centro})` : ""} · ${corta(t.fecha)}${marca}`,
    `<!-- id:${t.id} -->`,
    `Guardado desde el panel el ${corta(new Date().toISOString().slice(0, 10))}. **Permiso:** ${PERMISO_TXT[t.permiso]}.${t.permiso !== "con_nombre" ? " No se ofrece nunca para copy con nombre: para citar, «una profesora» o «un profesor» sin centro ni cargo." : ""} Idioma: ${t.idioma ?? "—"}.${donde ? ` **Dónde usarlo:** ${donde}.` : ""}`,
    "",
    String(t.texto).trim(),
    "",
  ].join("\n");
}

function filaFuentes(t) {
  const permiso = t.permiso === "con_nombre" ? "Sí: se puede usar su nombre" : t.permiso === "no_consta" ? "**SOLO ANÓNIMO (permiso no consta).** Pedirlo antes de usar el nombre" : "**Solo anónimo: sin nombre ni cargo**";
  return `| ${t.quien || "(sin nombre)"} | ${t.centro ?? ""} | ${t.fecha ?? ""} | ${permiso}. Texto en «Respuestas completas» |`;
}

function bloqueOtraVia(t) {
  const nombre = t.quien || "Anónimo";
  const donde = (t.donde ?? []).map((d) => DONDE_TXT[d] ?? d).join(", ");
  return [
    "",
    `## ${nombre} · ${t.centro ?? t.via} · ${t.fecha ?? ""}${t.permiso === "con_nombre" ? "" : " · SOLO ANÓNIMO"}`,
    `<!-- id:${t.id} -->`,
    "",
    `**Permiso:** ${PERMISO_TXT[t.permiso]}.${t.permiso === "con_nombre" ? ` **Firma:** "${nombre}".` : " No se ofrece nunca para copy con nombre."} Idioma: ${t.idioma ?? "—"}.${donde ? ` **Dónde usarlo:** ${donde}.` : ""}`,
    "",
    citar(t.texto),
    "",
  ].join("\n");
}

async function rest(url, key, ruta, opciones = {}) {
  const r = await fetch(`${url}/rest/v1/${ruta}`, { ...opciones, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(opciones.headers ?? {}) } });
  if (!r.ok) throw new Error(`${ruta.split("?")[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}

export async function espejoCorreo({ url, key, vaultCharlas, comprobar = false }) {
  const res = { testimonios: 0, enlazados: 0, respuestas: 0, avisos: [] };
  const R = rutas(vaultCharlas);
  let tes = [];
  let resp = [];
  try {
    tes = await rest(url, key, "testimonios?espejado_en=is.null&select=*&order=creado_en");
    resp = await rest(url, key, "correo_respuestas_news?espejado_en=is.null&select=*&order=creado_en");
  } catch (e) {
    return { ...res, omitido: `sin tablas todavía (${String(e.message).slice(0, 80)})` };
  }
  const marcar = (tabla, id, cuerpo) => rest(url, key, `${tabla}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(cuerpo), headers: { Prefer: "return=minimal" } });

  for (const t of tes) {
    const ruta = R[t.via];
    if (!ruta) continue;
    const nombreNota = ruta.split("/").pop();
    if (!existsSync(ruta)) {
      if (t.via !== "magia") {
        res.avisos.push(`No encuentro ${nombreNota}: ${t.id} se queda sin volcar.`);
        continue;
      }
      if (!comprobar) {
        mkdirSync(dirname(ruta), { recursive: true });
        writeFileSync(ruta, "---\ntags: [magia, testimonios]\n---\n\n# Testimonios magia\n\nTestimonios de clientes de magia guardados desde el panel (Correo › Por revisar). Cada uno indica cómo se puede firmar.\n");
      }
    }
    const nota = existsSync(ruta) ? readFileSync(ruta, "utf8") : "";
    if (nota.includes(`id:${t.id}`)) {
      if (!comprobar) await marcar("testimonios", t.id, { espejado_en: new Date().toISOString(), vault_nota: nombreNota });
      continue;
    }
    if (yaVolcado(nota, t.texto)) {
      // Ya estaba a mano (caso de Garbiñe): se enlaza, no se duplica.
      res.enlazados++;
      if (!comprobar) await marcar("testimonios", t.id, { espejado_en: new Date().toISOString(), vault_nota: `ya volcado a mano en ${nombreNota}` });
      continue;
    }
    res.testimonios++;
    if (comprobar) continue;
    let nuevo = nota.replace(/\s+$/, "") + "\n";
    if (t.via === "charlas") {
      // Fila en «Fuentes» (tabla) + sección «Respuestas completas».
      const lineas = nuevo.split("\n");
      const ini = lineas.findIndex((l) => /^## Fuentes/.test(l));
      if (ini >= 0) {
        let fin = ini + 1;
        while (fin < lineas.length && !/^\|/.test(lineas[fin])) fin++; // cabecera de la tabla
        while (fin < lineas.length && /^\|/.test(lineas[fin])) fin++;
        lineas.splice(fin, 0, filaFuentes(t));
        nuevo = lineas.join("\n");
      } else res.avisos.push("Testimonios charlas.md no tiene «## Fuentes»: solo se añadió la respuesta completa.");
      if (!/^## Respuestas completas/m.test(nuevo)) nuevo += "\n## Respuestas completas (tal como llegaron)\n";
      nuevo = nuevo.replace(/\s+$/, "") + "\n" + bloqueCharlas(t);
    } else {
      nuevo += bloqueOtraVia(t);
    }
    writeFileSync(ruta, nuevo);
    await marcar("testimonios", t.id, { espejado_en: new Date().toISOString(), vault_nota: nombreNota });
  }

  for (const r of resp) {
    let nota = existsSync(R.newsletter) ? readFileSync(R.newsletter, "utf8") : null;
    if (nota?.includes(`id:${r.id}`)) {
      if (!comprobar) await marcar("correo_respuestas_news", r.id, { espejado_en: new Date().toISOString() });
      continue;
    }
    res.respuestas++;
    if (comprobar) continue;
    if (nota == null) {
      mkdirSync(dirname(R.newsletter), { recursive: true });
      nota = "---\ntags: [newsletter, suscriptores, privado]\n---\n\n# Respuestas de suscriptores a la newsletter\n\n**Privado: no usar en copy sin permiso** (ni parafraseado ni «anonimizado» si la persona podría reconocerse). Se añaden desde el panel (Correo › Por revisar › «Guardar respuesta»). Si quieres usar una, antes se le pide permiso.\n";
    }
    const bloque = [
      "",
      `## ${r.fecha ?? ""} · ${r.nombre ? `${r.nombre} · ` : ""}${r.remitente ?? ""}`,
      `<!-- id:${r.id} -->`,
      "",
      "**Privado: no usar en copy sin permiso.**",
      r.newsletter_asunto ? `**Mail al que contesta:** ${r.newsletter_asunto}` : "",
      r.pregunta ? `**Pregunta:** ${r.pregunta}` : "",
      "",
      "**Respuesta literal:**",
      citar(r.respuesta),
      "",
    ]
      .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
      .join("\n");
    writeFileSync(R.newsletter, nota.replace(/\s+$/, "") + "\n" + bloque);
    await marcar("correo_respuestas_news", r.id, { espejado_en: new Date().toISOString() });
  }
  return res;
}

export function resumenEspejoCorreo(r, comprobar) {
  if (r.omitido) return `Correo: ${r.omitido}`;
  const partes = [`${r.testimonios} testimonios ${comprobar ? "por volcar" : "volcados"}`, `${r.enlazados} ya estaban a mano (enlazados)`, `${r.respuestas} respuestas de newsletter`];
  return `Correo → vault: ${partes.join(" · ")}${r.avisos.length ? ` · AVISOS: ${r.avisos.join(" | ")}` : ""}`;
}

// Uso suelto
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_KEY: key, VAULT_CHARLAS_DIR: vaultCharlas } = process.env;
  if (!url || !key || !vaultCharlas) {
    console.error("Faltan SUPABASE_URL, SUPABASE_SERVICE_KEY o VAULT_CHARLAS_DIR.");
    process.exit(1);
  }
  const comprobar = process.argv.includes("--comprobar");
  espejoCorreo({ url, key, vaultCharlas, comprobar }).then((r) => console.log(resumenEspejoCorreo(r, comprobar)));
}
