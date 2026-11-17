#!/usr/bin/env node
// Protocolo post-evento (17-11-2026). Lo llama la pasada horaria del espejo
// (scripts/charlas/espejo-vault.mjs), igual que las altas y los guiones.
//
// Lee las notas de evento del vault (🎩 MAGIA/📅 EVENTOS y Vías/Charlas/Eventos).
// Un evento cuenta como celebrado cuando ya pasó su fecha o su nota dice
// `estado_evento: realizado`; cancelado o aplazado no cuenta. Entonces crea,
// el día que toca, una tarjeta en la bandeja de su carril:
//   D+1  → enlace /quetal personal ya creado + mensaje listo (WhatsApp o correo)
//          + aviso de factura si no consta emitida.
//   D+30 → borrador para plantear repetir.
// Sesiones recurrentes (« · Sesión NN», p. ej. Eguzkilore): un solo /quetal al
// contratante y sin D+30. Sin /quetal si la nota dice testimonio_recibido: true.
// Sin D+30 si ya hay otro evento posterior con el mismo cliente.
// Lo hecho queda en eventos_postventa (sql/eventos_postventa.sql).
//
// Uso suelto:  node scripts/crm/post-evento.mjs [--comprobar]

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

/** Eventos anteriores a esta fecha no entran (los de primavera ya están cerrados a mano). */
const DESDE = "2026-10-15";
const DIA = 86400000;

const sumar = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") + n * DIA).toISOString().slice(0, 10);

function frontmatter(texto) {
  const m = /^---\n([\s\S]*?)\n---/.exec(texto.replace(/\r/g, ""));
  const fm = {};
  if (!m) return fm;
  for (const l of m[1].split("\n")) {
    const k = /^([a-z_]+):\s*(.*)$/.exec(l);
    if (!k) continue;
    fm[k[1]] = k[2].replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "");
  }
  return fm;
}
const enlace = (v) => (/\[\[([^\]|]+)/.exec(v ?? "")?.[1] ?? "").trim();
const si = (v) => /^(true|s[ií]|yes|bai)$/i.test(String(v ?? "").trim());
const telWa = (t) => {
  const d = String(t ?? "").replace(/\D/g, "");
  return !d ? null : d.length === 9 ? `34${d}` : d;
};
const primerNombre = (s) => String(s ?? "").replace(/\(.*$/, "").trim().split(/\s+/)[0] || "";

/** Nombre del evento para los mensajes: título sin fecha, sin lo entrecomillado y sin el subtítulo. */
function nombreEvento(fichero) {
  return basename(fichero, ".md")
    .replace(/^\d{4}-\d{2}-\d{2}\s+/, "")
    .replace(/["“”«»][^"“”«»]*["“”«»]/g, "")
    .split(/\s+[—·-]\s+/)[0]
    .trim();
}

/** Tipo de /quetal (feedback_links.tipo_evento) a partir de la nota. */
function tipoQuetal(carril, nombre, fm) {
  if (carril === "charlas") return "centro";
  const t = `${nombre} ${fm.cliente ?? ""} ${fm.show_base ?? ""}`.toLowerCase();
  if (/mirariak|tailer|taller/.test(t)) return "taller";
  if (/haurtxoko|famil|guraso|liburutegi/.test(t)) return "familiar";
  if (/eguzkilore|\bbar\b|ostalari|hosteler|taberna|jatetxe/.test(t)) return "hosteleria";
  if (/ikastola|\bbhi\b|\bies\b|colegio|ikastetxe|instituto/.test(t)) return "centro";
  if (/jai|fiesta|festa/.test(t)) return "fiestas";
  if (/empresa|gala|sari|premio|debegesa|enpresa/.test(t)) return "empresa";
  return "familiar";
}

const urlQuetal = (token) => `https://alainzulaika.com/quetal?t=${token}`;
// Mismo texto que mensajeWhatsApp() de lib/quetal.ts.
function mensajeQuetal({ nombre, evento, idioma, token }) {
  const n = nombre || (idioma === "eu" ? "kaixo" : "hola");
  return idioma === "eu"
    ? `Kaixo ${n}! Eskerrik asko berriro ${evento}-n nirekin kontatzeagatik. Asko lagunduko lidake nola joan zen kontatzea, 3 minutu dira: ${urlQuetal(token)}`
    : `¡Hola ${n}! Gracias otra vez por contar conmigo en ${evento}. Me ayudaría mucho que me contases qué tal fue, son 3 minutos: ${urlQuetal(token)}`;
}
function mensajeRepetir({ nombre, evento, idioma, carril }) {
  if (carril === "charlas")
    return idioma === "eu"
      ? `Kaixo ${nombre || ""}:\n\nHilabete pasa da hitzaldia egin genuenetik. Nola gogoratzen dute ikasleek, denbora pasata?\n\nDatorren ikasturtean errepikatu nahi baduzue, data aldez aurretik gorde diezazuket.\n\nOndo izan,\nAlain`
      : `Hola ${nombre || ""}:\n\nYa hace un mes de la charla. ¿Cómo la recuerdan los alumnos, con la distancia?\n\nSi queréis repetirla el curso que viene, os puedo guardar fecha con tiempo.\n\nUn saludo,\nAlain`;
  return idioma === "eu"
    ? `Kaixo ${nombre || ""}! Zer moduz? Hilabete pasa da ${evento} egin genuenetik. Errepikatzea pentsatzen ari zarete? Nahi baduzue, data aldez aurretik gordeko dizuet eta lasai hitz egingo dugu.`
    : `¡Hola ${nombre || ""}! ¿Qué tal? Ya hace un mes de ${evento}. ¿Os estáis planteando repetir? Si queréis, os guardo fecha con tiempo y lo vamos hablando.`;
}

export async function postEvento({ url, key, vaultCharlas, comprobar = false, hoy = new Date().toISOString().slice(0, 10) }) {
  const cab = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const rest = async (ruta, op = {}) => {
    const r = await fetch(`${url}/rest/v1/${ruta}`, { ...op, headers: { ...cab, ...(op.headers ?? {}) } });
    const t = await r.text();
    if (!r.ok) throw new Error(`${ruta.split("?")[0]}: ${r.status} ${t.slice(0, 200)}`);
    return t.trim() ? JSON.parse(t) : null;
  };
  const informe = { creadas: [], omitidas: [], errores: [] };

  // --- eventos del vault -----------------------------------------------------------
  const empresa = join(vaultCharlas, "..", "..", "..");
  const carpetas = [
    { carril: "magia", dir: join(empresa, "🎩 MAGIA", "📅 EVENTOS") },
    { carril: "charlas", dir: join(vaultCharlas, "Eventos") },
  ];
  const eventos = [];
  for (const { carril, dir } of carpetas) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".md") && /^\d{4}-\d{2}-\d{2} |— \d{4}-\d{2}-\d{2}\.md$/.test(x))) {
      const fm = frontmatter(readFileSync(join(dir, f), "utf8"));
      const fecha = /^\d{4}-\d{2}-\d{2}/.exec(fm.fecha_evento ?? "")?.[0];
      if (!fecha) continue;
      eventos.push({ carril, fichero: f, fm, fecha, ficha: enlace(fm.cliente_ficha) || enlace(fm.centro), serie: /·\s*Sesi[oó]n/i.test(f) });
    }
  }

  const hechos = new Map(((await rest("eventos_postventa?select=*").catch((e) => (comprobar ? [] : Promise.reject(e)))) ?? []).map((r) => [r.clave, r]));

  for (const ev of eventos) {
    if (ev.fecha < DESDE) continue;
    const estado = String(ev.fm.estado_evento ?? "").toLowerCase();
    if (/cancel|anul|aplaz|suspend/.test(estado)) continue;
    const celebrado = /realiz|celebr|hecho/.test(estado) || hoy >= sumar(ev.fecha, 1);
    if (!celebrado) continue;

    const clave = ev.serie ? `serie:${ev.ficha}` : ev.fichero.replace(/\.md$/, "");
    const fila = hechos.get(clave) ?? { clave, carril: ev.carril, nombre: ev.serie ? ev.ficha : nombreEvento(ev.fichero), fecha_evento: ev.fecha };
    const evento = ev.serie ? ev.ficha : nombreEvento(ev.fichero);
    const tocaD1 = !fila.d1_tarea && !fila.d1_omitido;
    const tocaD30 = !ev.serie && hoy >= sumar(ev.fecha, 30) && !fila.d30_tarea && !fila.d30_omitido;
    if (!tocaD1 && !tocaD30) continue;

    try {
      // Destino: ficha de magia o centro de charlas.
      let dest = null;
      if (ev.carril === "magia") {
        const [f] = await rest(`crm_fichas?select=id,nombre,responsable,responsable_tel,responsable_email,telefono,email,idioma&carril=eq.magia&nombre=eq.${encodeURIComponent(ev.ficha)}`);
        if (f) dest = { id: f.id, nombre: f.nombre, contacto: f.responsable || primerNombre(/\(([^)]+)\)/.exec(ev.fm.cliente ?? "")?.[1]), tel: telWa(f.responsable_tel || f.telefono), email: f.responsable_email || f.email, idioma: f.idioma === "es" ? "es" : "eu" };
      } else {
        const [c] = await rest(`charlas_centros?select=id,nombre,responsable,responsable_email,email_centro,euskera&nombre=eq.${encodeURIComponent(ev.ficha)}`);
        if (c) dest = { id: c.id, nombre: c.nombre, contacto: c.responsable, email: c.responsable_email || c.email_centro, idioma: c.euskera === "no" ? "es" : "eu" };
      }
      if (!dest) {
        if (tocaD1) fila.d1_omitido = `sin ficha en el CRM («${ev.ficha}»)`;
        if (tocaD30) fila.d30_omitido = `sin ficha en el CRM («${ev.ficha}»)`;
        informe.omitidas.push(`${evento}: sin ficha «${ev.ficha}»`);
      } else {
        const nombre = primerNombre(dest.contacto);
        const canal = ev.carril === "charlas" ? "mail" : dest.tel ? "whatsapp" : dest.email ? "mail" : "whatsapp";
        const destinatario = canal === "whatsapp" ? dest.tel : dest.email;
        const crear = async (tipo, texto, asunto, nota, contexto) => {
          if (comprobar) return "(comprobar)";
          const base = { tipo, nivel: "C", estado: "revisar", idioma: dest.idioma, borrador_asunto: asunto, borrador_texto: texto, destinatario, nota_para_alain: nota, contexto: { post_evento: contexto } };
          const [t] =
            ev.carril === "magia"
              ? await rest("crm_tareas", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...base, ficha_id: dest.id, carril: "magia", canal, urgencia: 2, urgencia_motivo: "Protocolo post-evento" }) })
              : await rest("charlas_tareas", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...base, centro_id: dest.id, fecha_prevista: hoy }) });
          return t.id;
        };

        if (tocaD1) {
          if (si(ev.fm.testimonio_recibido)) {
            fila.d1_omitido = "testimonio ya recibido (nota del evento)";
            informe.omitidas.push(`${evento}: /quetal no, testimonio ya recibido`);
          } else {
            const tipoEv = tipoQuetal(ev.carril, evento, ev.fm);
            if (!fila.quetal_token && !comprobar) {
              const token = randomBytes(18).toString("base64url");
              await rest("feedback_links", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ token, tipo_evento: tipoEv, nombre_evento: evento, fecha_evento: ev.fecha, entidad: dest.nombre, contacto_nombre: dest.contacto || dest.nombre, idioma: dest.idioma }) });
              fila.quetal_token = token;
            }
            const texto = ev.carril === "charlas"
              ? (dest.idioma === "eu"
                  ? `Kaixo ${nombre}:\n\nEskerrik asko berriro hitzaldiarengatik. Asko lagunduko lidake nola joan zen kontatzea; 3 minutu dira:\n${urlQuetal(fila.quetal_token ?? "TOKEN")}\n\nOndo izan,\nAlain`
                  : `Hola ${nombre}:\n\nGracias otra vez por la charla. Me ayudaría mucho que me contases qué tal fue; son 3 minutos:\n${urlQuetal(fila.quetal_token ?? "TOKEN")}\n\nUn saludo,\nAlain`)
              : mensajeQuetal({ nombre, evento, idioma: dest.idioma, token: fila.quetal_token ?? "TOKEN" });
            const factura = ev.fm.factura_emitida ? `Factura emitida (${ev.fm.factura_emitida}).` : "Factura: no consta emitida en la nota del evento; si toca, emítela y mándala con este mensaje.";
            const nota = [
              `Protocolo post-evento, día siguiente: /quetal personal (tipo «${tipoEv}»).`,
              factura,
              ev.serie ? "Sesiones recurrentes: un solo /quetal al contratante." : "",
              !destinatario ? `Sin ${canal === "whatsapp" ? "teléfono" : "correo"} en la ficha: copia el mensaje.` : "",
              `Idioma: ${dest.idioma === "eu" ? "euskera" : "castellano"} (cámbialo si no es el suyo).`,
            ].filter(Boolean).join(" ");
            fila.d1_tarea = await crear("post_evento", texto, ev.carril === "charlas" ? (dest.idioma === "eu" ? "Zer moduz joan zen hitzaldia?" : "¿Qué tal fue la charla?") : null, nota, { clave, paso: "d1", fecha_evento: ev.fecha, evento });
            fila.d1_en = new Date().toISOString();
            informe.creadas.push(`${evento}: /quetal (${canal})`);
          }
        }

        if (tocaD30) {
          const posterior = eventos.find((o) => o !== ev && o.ficha === ev.ficha && o.fecha > ev.fecha && !/cancel|anul/.test(String(o.fm.estado_evento ?? "").toLowerCase()));
          if (posterior) {
            fila.d30_omitido = `ya repite: evento del ${posterior.fecha}`;
            informe.omitidas.push(`${evento}: repetir no, ya hay evento el ${posterior.fecha}`);
          } else {
            const asunto = ev.carril === "charlas" ? (dest.idioma === "eu" ? "Datorren ikasturtea" : "El curso que viene") : null;
            fila.d30_tarea = await crear("post_evento", mensajeRepetir({ nombre, evento, idioma: dest.idioma, carril: ev.carril }), asunto, "Protocolo post-evento, a los 30 días: plantear repetir. Borrador para repasar.", { clave, paso: "d30", fecha_evento: ev.fecha, evento });
            fila.d30_en = new Date().toISOString();
            informe.creadas.push(`${evento}: plantear repetir (${canal})`);
          }
        }
      }
      if (!comprobar) {
        await rest("eventos_postventa?on_conflict=clave", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([{ ...fila, actualizado_en: new Date().toISOString() }]) });
      }
    } catch (e) {
      informe.errores.push(`${evento}: ${String(e.message).slice(0, 200)}`);
    }
  }
  return informe;
}

export function resumenPostEvento(inf, comprobar) {
  const p = [`${inf.creadas.length} ${comprobar ? "se crearían" : "tarjetas creadas"}${inf.creadas.length ? ` (${inf.creadas.join("; ")})` : ""}`];
  if (inf.omitidas.length) p.push(`omitidas: ${inf.omitidas.join("; ")}`);
  if (inf.errores.length) p.push(`errores: ${inf.errores.join("; ")}`);
  return `Post-evento: ${p.join(" · ")}`;
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
  postEvento({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY, vaultCharlas: process.env.VAULT_CHARLAS_DIR, comprobar })
    .then((inf) => console.log(resumenPostEvento(inf, comprobar)))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
