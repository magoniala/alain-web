// Correo del carril charlas: lectura IMAP, asociación a centros y envío SMTP.
//
// Buzón: alain@alainzulaika.com en Arsys (info@ redirige ahí). Credenciales
// en CHARLAS_MAIL_USER / CHARLAS_MAIL_PASS (variables de Vercel).
//
// Privacidad: alain@ recibe mucho más que charlas. De cada correo se leen
// primero solo las cabeceras; el cuerpo se descarga y se guarda únicamente
// si el correo se puede asociar a un centro del CRM (por hilo, por dirección
// exacta o por dominio propio del centro). Lo demás no se almacena.

import { ImapFlow, type FetchMessageObject } from "imapflow";
import { cuerpoCorreo } from "@/lib/correo-cuerpo";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { supabaseCharlas } from "./charlas";
import { CABECERAS_LECTOR, extraerCabecera, filaEntrada, guardarEntradas, reglasParaAlain } from "./correo-general";

const IMAP_HOST = "imap.serviciodecorreo.es";
const SMTP_HOST = "smtp.serviciodecorreo.es";

// Dominios que comparten muchos centros (o de correo personal): nunca sirven
// para saber de qué centro es un correo. Se suman los que el índice detecta
// como compartidos.
const DOMINIOS_GENERICOS = new Set([
  "gmail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es", "yahoo.com", "yahoo.es",
  "icloud.com", "live.com", "msn.com", "euskalnet.net", "telefonica.net", "hezkuntza.net", "ikastola.eus",
]);

const PROPIOS = new Set(["alain@alainzulaika.com", "info@alainzulaika.com", "contacto@alainzulaika.com", "newsletter@alainzulaika.com"]);

export const DOSSIER = {
  es: { archivo: "Dossier_La_atencion_en_la_era_digital_ES.pdf", nombre: "Dossier - La atencion en la era digital.pdf" },
  eu: { archivo: "Dossierra_Arreta_aro_digitalean_EU.pdf", nombre: "Dossierra - Arreta aro digitalean.pdf" },
} as const;

function credenciales() {
  const user = process.env.CHARLAS_MAIL_USER;
  const pass = process.env.CHARLAS_MAIL_PASS;
  if (!user || !pass) throw new Error("Faltan CHARLAS_MAIL_USER / CHARLAS_MAIL_PASS en Vercel.");
  return { user, pass };
}

async function config<T>(clave: string, defecto: T): Promise<T> {
  const { data } = await supabaseCharlas().from("charlas_config").select("valor").eq("clave", clave).maybeSingle();
  return (data?.valor as T) ?? defecto;
}

const norm = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();
const dominio = (e: string) => e.split("@")[1] ?? "";
const limpiarId = (id: string | null | undefined) => (id ?? "").trim().replace(/^<|>$/g, "");

function idsDeReferencias(valor: string | Buffer | null | undefined): string[] {
  if (!valor) return [];
  return Array.from(String(valor).matchAll(/<([^>]+)>/g)).map((m) => m[1].trim());
}

/** Quita la parte citada de una respuesta ("El ... escribió:", "> …", firma de Outlook). */
export function quitarCita(texto: string): string {
  const lineas = texto.replace(/\r/g, "").split("\n");
  const corte = lineas.findIndex(
    (l) =>
      /^(El|On|Le|Am)\s.+(escribió|wrote|a écrit|schrieb)\s*:\s*$/i.test(l.trim()) ||
      /(idatzi zuen|idatzi du)\s*:\s*$/i.test(l.trim()) ||
      /^-{2,}\s*(Mensaje original|Original Message|Jatorrizko mezua)/i.test(l.trim()) ||
      /^_{5,}$/.test(l.trim()) ||
      // Outlook: bloque "De: … / Enviado: …" sin línea "escribió:"
      (/^(De|From|Nork)\s*:\s.+/i.test(l.trim()) && /^(Enviado|Sent|Data|Fecha|Bidalia)\s*:/i.test((lineas[lineas.indexOf(l) + 1] ?? "").trim()))
  );
  const util = (corte > 0 ? lineas.slice(0, corte) : lineas).filter((l) => !l.startsWith(">"));
  return util.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ---------------------------------------------------------------------------
// Índice para asociar correos a centros
// ---------------------------------------------------------------------------
interface Indice {
  porEmail: Map<string, string>;
  porDominio: Map<string, string>;
  /** (slug del nombre del centro, id) para casar dominios como durangobhi.net con "Durango BHI". */
  slugs: { slug: string; id: string }[];
}

const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

async function construirIndice(): Promise<Indice> {
  const supabase = supabaseCharlas();
  const porEmail = new Map<string, string>();
  const dominios = new Map<string, Set<string>>();
  const slugs: { slug: string; id: string }[] = [];
  // Un campo puede traer varios correos ("a@x.eus / b@x.eus"): se cogen todos.
  const anotar = (valor: string | null, centro: string) => {
    for (const e of (valor ?? "").toLowerCase().match(EMAIL_RE) ?? []) {
      porEmail.set(e, centro);
      const d = dominio(e);
      if (!dominios.has(d)) dominios.set(d, new Set());
      dominios.get(d)!.add(centro);
    }
  };

  for (let desde = 0; ; desde += 1000) {
    const { data } = await supabase.from("charlas_centros").select("id, nombre, responsable_email, email_centro, ampa_email").range(desde, desde + 999);
    for (const c of data ?? []) {
      slugs.push({ slug: slug(c.nombre), id: c.id });
      anotar(c.responsable_email, c.id);
      anotar(c.email_centro, c.id);
      anotar(c.ampa_email, c.id);
    }
    if (!data || data.length < 1000) break;
  }
  for (let desde = 0; ; desde += 1000) {
    const { data } = await supabase.from("charlas_contactos").select("centro_id, email").not("email", "is", null).range(desde, desde + 999);
    for (const c of data ?? []) anotar(c.email, c.centro_id);
    if (!data || data.length < 1000) break;
  }

  const porDominio = new Map<string, string>();
  for (const [d, centros] of dominios) {
    if (centros.size === 1 && !DOMINIOS_GENERICOS.has(d)) porDominio.set(d, [...centros][0]);
  }
  return { porEmail, porDominio, slugs };
}

function asociar(indice: Indice, direcciones: string[]): { centro: string | null; por: string | null } {
  for (const a of direcciones) {
    const c = indice.porEmail.get(norm(a));
    if (c) return { centro: c, por: "email" };
  }
  for (const a of direcciones) {
    const c = indice.porDominio.get(dominio(norm(a)));
    if (c) return { centro: c, por: "dominio" };
  }
  // El dominio suele llevar el nombre del centro: durangobhi.net, kirikino.com,
  // armentiaikastola.eus. Vale si casa con un solo centro.
  for (const a of direcciones) {
    const d = dominio(norm(a));
    if (!d || DOMINIOS_GENERICOS.has(d)) continue;
    const etiqueta = slug(d.split(".")[0] ?? "");
    if (etiqueta.length < 5) continue;
    const candidatos = indice.slugs.filter((x) => x.slug.startsWith(etiqueta) || (etiqueta.length >= 7 && x.slug.includes(etiqueta)));
    const ids = new Set(candidatos.map((x) => x.id));
    if (ids.size === 1) return { centro: [...ids][0], por: "dominio~nombre" };
  }
  return { centro: null, por: null };
}

// Asuntos propios de la campaña: un correo sin centro pero con uno de estos
// asuntos se guarda como "pendiente de asignar" en vez de descartarse.
const ASUNTO_CHARLAS = /(calendario de actividades|jardueren egutegia|egutegia|charlas? sobre (la )?atenci|arreta|hitzaldi|dossier|dosierra|magia.*atenci)/i;

// ---------------------------------------------------------------------------
// Lectura
//
// Todo lo que se consulta por correo (hilos conocidos, direcciones, hilos
// por centro) se carga en memoria una vez al empezar; a la base de datos
// solo se escribe en bloques. Así una tanda de 100 cabeceras se resuelve en
// segundos, y el avance (último UID leído) se guarda tras cada bloque: si
// Vercel corta la función, la siguiente ejecución sigue donde se quedó.
// ---------------------------------------------------------------------------
export interface ResumenLectura {
  magia?: number;
  /** Bandeja general (F0): filas apuntadas en correo_entrada en esta pasada. */
  correo_general?: { registrados: number; error?: string };
  carpetas: Record<string, { revisados: number; asociados: number; pendientes_asignar: number; nuevos_uid: number }>;
  respondidos_desde_mail: number;
  huerfanos_asociados: number;
  /** true si se han leído todas las carpetas hasta el final (sin cortar por tiempo). */
  al_dia: boolean;
  error?: string;
}

interface Hilo {
  centro_id: string;
  canal: "principal";
  asunto: string | null;
  message_id_raiz: string | null;
  ultimo_message_id: string | null;
  ultimo_mensaje_en: string | null;
}

async function cargarConocidos() {
  const supabase = supabaseCharlas();
  // message-id (o id citado en sus referencias) → centro
  const porId = new Map<string, string>();
  const guardados = new Set<string>();
  for (let desde = 0; ; desde += 1000) {
    const { data } = await supabase.from("charlas_mensajes").select("message_id, referencias, centro_id").range(desde, desde + 999);
    for (const m of data ?? []) {
      guardados.add(m.message_id);
      if (!m.centro_id) continue;
      porId.set(m.message_id, m.centro_id);
      for (const r of m.referencias ?? []) if (!porId.has(r)) porId.set(r, m.centro_id);
    }
    if (!data || data.length < 1000) break;
  }
  const hilos = new Map<string, Hilo>();
  for (let desde = 0; ; desde += 1000) {
    const { data } = await supabase.from("charlas_hilos").select("centro_id, canal, asunto, message_id_raiz, ultimo_message_id, ultimo_mensaje_en").eq("canal", "principal").range(desde, desde + 999);
    for (const h of data ?? []) hilos.set(h.centro_id, h as Hilo);
    if (!data || data.length < 1000) break;
  }
  const { data: abiertas } = await supabase.from("charlas_tareas").select("centro_id").in("estado", ["revisar", "pendiente"]);
  const conTareaAbierta = new Set((abiertas ?? []).map((t) => t.centro_id as string));
  return { porId, guardados, hilos, conTareaAbierta };
}

// ---------------------------------------------------------------------------
// Carril de magia (fase 6a): los correos que no son de ningún centro pero sí
// de una ficha de Prospectos (crm_fichas) se guardan en crm_mensajes para que
// su motor los procese. Si las tablas crm_* no existen aún, se ignora.
// ---------------------------------------------------------------------------
interface IndiceMagia {
  porEmail: Map<string, string>;
  porId: Map<string, string>;
  guardados: Set<string>;
  conTareaAbierta: Set<string>;
}
async function indiceMagia(): Promise<IndiceMagia | null> {
  const supabase = supabaseCharlas();
  const { data: fichas, error } = await supabase.from("crm_fichas").select("id, email, responsable_email").eq("carril", "magia");
  if (error) return null;
  const porEmail = new Map<string, string>();
  for (const f of fichas ?? []) {
    for (const campo of [f.responsable_email, f.email]) {
      for (const e of String(campo ?? "").toLowerCase().match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) {
        porEmail.set(e, f.id as string);
      }
    }
  }
  const porId = new Map<string, string>();
  const guardados = new Set<string>();
  const { data: msgs } = await supabase.from("crm_mensajes").select("message_id, referencias, ficha_id").range(0, 4999);
  for (const m of msgs ?? []) {
    if (m.message_id) guardados.add(m.message_id);
    if (!m.ficha_id) continue;
    if (m.message_id) porId.set(m.message_id, m.ficha_id);
    for (const r of m.referencias ?? []) if (!porId.has(r)) porId.set(r, m.ficha_id);
  }
  const { data: abiertas } = await supabase.from("crm_tareas").select("ficha_id").in("estado", ["revisar", "pendiente"]);
  return { porEmail, porId, guardados, conTareaAbierta: new Set((abiertas ?? []).map((t) => t.ficha_id as string)) };
}

/** Carpeta de Enviados del buzón: por marca especial y, si el servidor no la pone (Arsys), por nombre. */
function carpetaEnviados(carpetas: { path: string; specialUse?: string }[]): string | null {
  return (
    carpetas.find((c) => c.specialUse === "\\Sent")?.path ??
    carpetas.find((c) => /^(INBOX[./])?(Sent|Enviados|Elementos enviados|Sent Items|Sent Messages)$/i.test(c.path))?.path ??
    null
  );
}

/** Marca como leído y respondido el correo al que se ha contestado, para que en Mail se vea igual que si hubiera contestado Alain. */
/** IMAP exige finales de línea CRLF en lo que se guarda con APPEND; Arsys rechaza los LF sueltos ("bare newlines"). */
function crlf(b: Buffer): Buffer {
  return Buffer.from(b.toString("binary").replace(/\r?\n/g, "\r\n"), "binary");
}

/** Busca un correo por Message-ID en la carpeta abierta; prueba con y sin <>. Si el servidor no admite la búsqueda, devuelve []. */
async function buscarPorMessageId(cliente: ImapFlow, messageId: string): Promise<number[]> {
  const limpio = messageId.replace(/^<|>$/g, "");
  for (const v of [`<${limpio}>`, limpio]) {
    try {
      const r = (await cliente.search({ header: { "message-id": v } }, { uid: true })) as number[] | false;
      if (r && r.length) return r;
    } catch {
      /* siguiente variante */
    }
  }
  return [];
}

/** Marca como leído y respondido el correo al que se ha contestado, para que en Mail se vea igual que si hubiera contestado Alain. */
async function marcarRespondido(cliente: ImapFlow, messageIdOriginal: string): Promise<boolean> {
  const lock = await cliente.getMailboxLock("INBOX");
  try {
    const uids = await buscarPorMessageId(cliente, messageIdOriginal);
    if (uids.length) await cliente.messageFlagsAdd(uids, ["\\Seen", "\\Answered"], { uid: true });
    return uids.length > 0;
  } finally {
    lock.release();
  }
}

/** Deja constancia en charlas_config de lo último que pasó con IMAP (para diagnosticar sin acceso a los logs de Vercel). */
async function diag(clave: string, valor: unknown) {
  await supabaseCharlas()
    .from("charlas_config")
    .upsert({ clave, valor: { ...(valor as object), en: new Date().toISOString() }, actualizado_en: new Date().toISOString() })
    .then(() => null, () => null);
}

export async function leerBuzon(opciones: { presupuestoMs: number }): Promise<ResumenLectura> {
  const inicio = Date.now();
  const sinTiempo = () => Date.now() - inicio > opciones.presupuestoMs;
  const supabase = supabaseCharlas();
  const resumen: ResumenLectura = { carpetas: {}, respondidos_desde_mail: 0, huerfanos_asociados: 0, al_dia: true };
  const diasInicial = Number(await config("lectura_inicial_dias", 10));
  const diasHistoricoEnviados = Number(await config("enviados_historico_dias", 75));
  const [indice, conocidos, magia, reglasCorreo] = await Promise.all([construirIndice(), cargarConocidos(), indiceMagia(), reglasParaAlain().catch(() => null)]);
  // Bandeja general (F0): si correo_remitentes no existe aún, reglasCorreo es null y no se apunta nada.
  let pendientesCorreo: Record<string, unknown>[] = [];
  resumen.correo_general = { registrados: 0 };
  const hilosCambiados = new Set<string>();
  let pendientesMagia: Record<string, unknown>[] = [];
  resumen.magia = 0;

  const cliente = new ImapFlow({ host: IMAP_HOST, port: 993, secure: true, auth: credenciales(), logger: false });
  await cliente.connect();
  try {
    const carpetas = await cliente.list();
    const enviados = carpetaEnviados(carpetas);

    // Enviados primero: así, cuando se lee la bandeja de entrada, ya se
    // conocen los hilos que abrió Alain.
    const trabajo: { carpeta: string; direccion: "entrante" | "saliente"; dias: number }[] = [];
    if (enviados) trabajo.push({ carpeta: enviados, direccion: "saliente", dias: diasHistoricoEnviados });
    trabajo.push({ carpeta: "INBOX", direccion: "entrante", dias: diasInicial });

    for (const t of trabajo) {
      if (sinTiempo()) {
        resumen.al_dia = false;
        break;
      }
      const stats = { revisados: 0, asociados: 0, pendientes_asignar: 0, nuevos_uid: 0 };
      resumen.carpetas[t.carpeta] = stats;

      const lock = await cliente.getMailboxLock(t.carpeta);
      try {
        const buzon = cliente.mailbox;
        if (!buzon) continue;
        const uidvalidity = String(buzon.uidValidity);
        const { data: est } = await supabase.from("charlas_imap_estado").select("*").eq("carpeta", t.carpeta).maybeSingle();

        let uids: number[];
        if (!est || est.uidvalidity !== uidvalidity || Number(est.ultimo_uid) === 0) {
          const desde = new Date(Date.now() - t.dias * 86400000);
          uids = ((await cliente.search({ since: desde }, { uid: true })) || []) as number[];
          // Retomar una primera lectura que se quedó a medias.
          if (est && est.uidvalidity === uidvalidity && Number(est.ultimo_uid) > 0) uids = uids.filter((u) => u > Number(est.ultimo_uid));
        } else {
          const r = (await cliente.search({ uid: `${Number(est.ultimo_uid) + 1}:*` }, { uid: true })) || [];
          uids = (r as number[]).filter((u) => u > Number(est.ultimo_uid));
        }
        uids.sort((a, b) => a - b);
        stats.nuevos_uid = uids.length;

        let ultimoLeido = est && est.uidvalidity === uidvalidity ? Number(est.ultimo_uid) : 0;
        let pendientes: Record<string, unknown>[] = [];
        let ultimoEnCola = ultimoLeido;

        const volcar = async () => {
          // Bandeja general (F0): primero, y sin lanzar nunca (guardarEntradas no lanza).
          if (pendientesCorreo.length) {
            const lote = pendientesCorreo;
            pendientesCorreo = [];
            const r = await guardarEntradas(lote);
            resumen.correo_general!.registrados += r.guardadas;
            if (r.error) resumen.correo_general!.error = r.error;
          }
          if (pendientes.length) {
            const { data: insertados, error } = await supabase
              .from("charlas_mensajes")
              .upsert(pendientes, { onConflict: "message_id", ignoreDuplicates: true })
              .select("message_id, direccion, centro_id, fecha");
            if (error) throw new Error(`guardar mensajes: ${error.message}`);
            // Alain ha contestado desde Mail: la tarea abierta de ese centro sobra.
            for (const m of insertados ?? []) {
              if (m.direccion !== "saliente" || !m.centro_id || !m.fecha || !conocidos.conTareaAbierta.has(m.centro_id)) continue;
              const { data: abiertas } = await supabase
                .from("charlas_tareas")
                .update({ estado: "descartada", motivo: "Respondido desde Mail", resuelto_en: new Date().toISOString(), resuelto_por: "alain" })
                .eq("centro_id", m.centro_id)
                .in("estado", ["revisar", "pendiente"])
                .lt("creado_en", m.fecha)
                .select("id");
              resumen.respondidos_desde_mail += abiertas?.length ?? 0;
            }
            pendientes = [];
          }
          if (pendientesMagia.length) {
            const lote = pendientesMagia;
            pendientesMagia = [];
            const { data: ins } = await supabase.from("crm_mensajes").upsert(lote, { onConflict: "message_id", ignoreDuplicates: true }).select("message_id, direccion, ficha_id, fecha, asunto, referencias");
            for (const m of ins ?? []) {
              if (!m.ficha_id) continue;
              // Hilo de la ficha: el último mensaje manda.
              await supabase
                .from("crm_hilos")
                .upsert({ ficha_id: m.ficha_id, canal: "principal", asunto: String(m.asunto ?? "").replace(/^((re|rv|fw|fwd|erantz)\s*:\s*)+/i, ""), message_id_raiz: (m.referencias ?? [])[0] ?? m.message_id, ultimo_message_id: m.message_id, ultimo_mensaje_en: m.fecha }, { onConflict: "ficha_id,canal" })
                .then(() => null, () => null);
              if (m.direccion === "saliente" && magia?.conTareaAbierta.has(m.ficha_id) && m.fecha) {
                await supabase.from("crm_tareas").update({ estado: "descartada", motivo: "Respondido desde Mail", resuelto_en: new Date().toISOString(), resuelto_por: "alain" }).eq("ficha_id", m.ficha_id).in("estado", ["revisar", "pendiente"]).lt("creado_en", m.fecha);
              }
            }
          }
          if (hilosCambiados.size) {
            const filas = [...hilosCambiados].map((c) => conocidos.hilos.get(c)!).filter(Boolean);
            const { error } = await supabase.from("charlas_hilos").upsert(filas, { onConflict: "centro_id,canal" });
            if (error) throw new Error(`guardar hilos: ${error.message}`);
            hilosCambiados.clear();
          }
          ultimoLeido = ultimoEnCola;
          await supabase.from("charlas_imap_estado").upsert({ carpeta: t.carpeta, uidvalidity, ultimo_uid: ultimoLeido, ultima_lectura: new Date().toISOString() });
        };

        try {
          for (let i = 0; i < uids.length; i += 100) {
            if (sinTiempo()) {
              resumen.al_dia = false;
              break;
            }
            const tanda = uids.slice(i, i + 100);
            const cabeceras: FetchMessageObject[] = await cliente.fetchAll(tanda.join(","), { uid: true, envelope: true, flags: true, headers: CABECERAS_LECTOR }, { uid: true });
            cabeceras.sort((a, b) => a.uid - b.uid);

            for (const m of cabeceras) {
              if (sinTiempo()) {
                resumen.al_dia = false;
                break;
              }
              stats.revisados++;
              const env = m.envelope ?? {};
              const messageId = limpiarId(env.messageId) || `sin-id-${t.carpeta}-${uidvalidity}-${m.uid}`;
              ultimoEnCola = m.uid;
              if (conocidos.guardados.has(messageId)) continue;

              const refs = [...new Set([limpiarId(env.inReplyTo), ...idsDeReferencias(extraerCabecera(m.headers, "references"))].filter(Boolean))];
              const de = norm(env.from?.[0]?.address);
              const destinos = [...(env.to ?? []), ...(env.cc ?? [])].map((a) => norm(a.address)).filter(Boolean);
              const contraparte = t.direccion === "entrante" ? [de, ...(env.replyTo ?? []).map((a) => norm(a.address))] : destinos.filter((d) => !PROPIOS.has(d));

              let centro: string | null = refs.map((r) => conocidos.porId.get(r)).find(Boolean) ?? null;
              let por: string | null = centro ? "hilo" : null;
              if (!centro) ({ centro, por } = asociar(indice, contraparte));
              // Un parecido por dominio o por nombre NO manda sobre un email exacto de una ficha de
              // magia: cultura@berriz.eus (ayuntamiento, antiguo cliente de magia) acababa en
              // "Berriz BHI" solo porque el dominio berriz.eus lleva el nombre del pueblo.
              if (centro && (por === "dominio~nombre" || por === "dominio") && magia && contraparte.some((e) => magia.porEmail.get(e))) {
                centro = null;
                por = null;
              }
              const asunto = env.subject ?? "";
              const pendiente = !centro && t.direccion === "entrante" && refs.length > 0 && ASUNTO_CHARLAS.test(asunto);
              // ¿Es de una ficha de magia?
              let fichaMagia: string | null = null;
              if (!centro && !pendiente && magia && !magia.guardados.has(messageId)) {
                fichaMagia = refs.map((r) => magia.porId.get(r)).find(Boolean) ?? contraparte.map((e) => magia.porEmail.get(e)).find(Boolean) ?? null;
              }
              // Bandeja general (F0): todo lo que entra en INBOX queda apuntado, solo con cabeceras.
              if (reglasCorreo && t.direccion === "entrante") {
                pendientesCorreo.push(
                  filaEntrada({ m, carpeta: t.carpeta, messageId, referencias: refs, via: centro || pendiente ? "charlas" : fichaMagia ? "magia" : null, viaRef: centro ?? fichaMagia ?? null, reglas: reglasCorreo }),
                );
              }
              if (!centro && !pendiente && !fichaMagia) continue;

              // Cuerpo: solo de lo asociado, y en el histórico de enviados
              // solo de lo reciente (lo antiguo sirve por sus cabeceras).
              const fecha = env.date ? new Date(env.date) : null;
              const reciente = fecha ? Date.now() - fecha.getTime() < diasInicial * 86400000 : true;
              let texto: string | null = null;
              let html: string | null = null;
              if (reciente || t.direccion === "entrante") {
                const completo = await cliente.fetchOne(String(m.uid), { source: true }, { uid: true });
                if (completo && completo.source) {
                  const p = await simpleParser(completo.source);
                  texto = p.text ?? (p.html ? String(p.html).replace(/<[^>]+>/g, " ").replace(/\s+\n/g, "\n") : null);
                  html = p.html ? String(p.html).slice(0, 200000) : null;
                }
              }

              const fechaISO = fecha?.toISOString() ?? null;
              if (fichaMagia) {
                pendientesMagia.push({
                  ficha_id: fichaMagia,
                  direccion: t.direccion,
                  message_id: messageId,
                  in_reply_to: limpiarId(env.inReplyTo) || null,
                  referencias: refs,
                  de: env.from?.[0]?.address ?? null,
                  para: destinos,
                  asunto,
                  texto,
                  fecha: fechaISO,
                  estado: t.direccion === "saliente" ? "procesado" : "nuevo",
                });
                magia!.guardados.add(messageId);
                magia!.porId.set(messageId, fichaMagia);
                for (const r of refs) if (!magia!.porId.has(r)) magia!.porId.set(r, fichaMagia);
                resumen.magia = (resumen.magia ?? 0) + 1;
                if (pendientesMagia.length >= 25) await volcar();
                continue;
              }
              pendientes.push({
                centro_id: centro,
                direccion: t.direccion,
                message_id: messageId,
                in_reply_to: limpiarId(env.inReplyTo) || null,
                referencias: refs,
                de: env.from?.[0]?.address ?? null,
                para: destinos,
                asunto,
                texto,
                html,
                fecha: fechaISO,
                carpeta: t.carpeta,
                uid: m.uid,
                match_por: centro ? por : null,
                estado: t.direccion === "saliente" ? "procesado" : pendiente ? "pendiente_asignar" : "nuevo",
              });
              conocidos.guardados.add(messageId);
              if (pendiente) stats.pendientes_asignar++;
              else stats.asociados++;

              if (centro) {
                // Lo que se acaba de ver también sirve para los siguientes correos del mismo hilo.
                conocidos.porId.set(messageId, centro);
                for (const r of refs) if (!conocidos.porId.has(r)) conocidos.porId.set(r, centro);
                const h = conocidos.hilos.get(centro);
                if (!h) {
                  conocidos.hilos.set(centro, {
                    centro_id: centro,
                    canal: "principal",
                    asunto: asunto.replace(/^((re|rv|fw|fwd|erantz)\s*:\s*)+/i, ""),
                    message_id_raiz: refs[0] ?? messageId,
                    ultimo_message_id: messageId,
                    ultimo_mensaje_en: fechaISO,
                  });
                  hilosCambiados.add(centro);
                } else if (fechaISO && (!h.ultimo_mensaje_en || fechaISO > h.ultimo_mensaje_en)) {
                  h.ultimo_message_id = messageId;
                  h.ultimo_mensaje_en = fechaISO;
                  hilosCambiados.add(centro);
                }
              }
              if (pendientes.length >= 25) await volcar();
            }
            await volcar();
          }
          if (uids.length === 0) await volcar();
        } finally {
          // Lo que esté en cola se guarda aunque se acabe el tiempo.
          if (pendientes.length || pendientesMagia.length || pendientesCorreo.length || hilosCambiados.size) await volcar().catch(() => {});
        }
      } finally {
        lock.release();
      }
    }
  } finally {
    await cliente.logout().catch(() => {});
  }

  // Huérfanos: con los hilos de Enviados ya leídos, muchos se pueden asociar solos.
  const { data: huerfanos } = await supabase.from("charlas_mensajes").select("id, referencias, in_reply_to, de").eq("estado", "pendiente_asignar");
  for (const h of huerfanos ?? []) {
    const refs = [h.in_reply_to, ...(h.referencias ?? [])].filter(Boolean) as string[];
    let centro = refs.map((r) => conocidos.porId.get(r)).find(Boolean) ?? null;
    let por = "hilo";
    if (!centro) ({ centro, por } = asociar(indice, [h.de ?? ""]) as { centro: string | null; por: string });
    if (centro) {
      await supabase.from("charlas_mensajes").update({ centro_id: centro, estado: "nuevo", match_por: por }).eq("id", h.id);
      resumen.huerfanos_asociados++;
    }
  }
  return resumen;
}

// ---------------------------------------------------------------------------
// Envío
// ---------------------------------------------------------------------------
export interface Envio {
  para: string;
  asunto: string;
  texto: string;
  inReplyTo?: string | null;
  referencias?: string[];
  dossier?: "es" | "eu" | null;
  prueba?: boolean;
}

export async function enviarCorreo(e: Envio): Promise<{ messageId: string; para: string; smtp: string }> {
  const { user, pass } = credenciales();
  const remitente = String(await config("remitente", `Alain Zulaika <${user}>`));
  const messageId = `${randomUUID()}@alainzulaika.com`;

  const adjuntos = [];
  if (e.dossier) {
    const d = DOSSIER[e.dossier];
    adjuntos.push({ filename: d.nombre, content: await readFile(join(process.cwd(), "assets/charlas", d.archivo)), contentType: "application/pdf" });
  }

  // En modo prueba el correo va al buzón de pruebas (config `prueba_destinatario`)
  // o, si no hay, al propio alain@.
  const para = e.prueba ? String(await config("prueba_destinatario", user)) || user : e.para;
  const opciones = {
    from: remitente,
    to: para,
    subject: e.prueba ? `[PRUEBA → ${e.para}] ${e.asunto}` : e.asunto,
    ...cuerpoCorreo(e.texto),
    messageId: `<${messageId}>`,
    inReplyTo: !e.prueba && e.inReplyTo ? `<${e.inReplyTo}>` : undefined,
    references: !e.prueba && e.referencias?.length ? e.referencias.map((r) => `<${r}>`).join(" ") : undefined,
    attachments: adjuntos,
  };

  // Se compone una vez: lo que sale por SMTP y la copia de Enviados son el mismo mensaje.
  const crudo: Buffer = await new MailComposer(opciones).compile().build();

  const transporte = nodemailer.createTransport({ host: SMTP_HOST, port: 465, secure: true, auth: { user, pass } });
  const info = await transporte.sendMail({ envelope: { from: user, to: [para] }, raw: crudo });

  if (!e.prueba) {
    // Copia en Enviados para que el hilo se vea completo en Mail del Mac.
    const cliente = new ImapFlow({ host: IMAP_HOST, port: 993, secure: true, auth: { user, pass }, logger: false });
    let paso = "connect";
    try {
      await cliente.connect();
      paso = "list";
      const carpetas = await cliente.list();
      const enviados = carpetaEnviados(carpetas);
      let copiado = false;
      let marcado = false;
      let errorMarcar: string | null = null;
      // Primero marcar el original como leído/respondido: no depende de la copia.
      paso = "marcar";
      if (e.inReplyTo) marcado = await marcarRespondido(cliente, e.inReplyTo).catch((x: Error & { responseText?: string }) => ((errorMarcar = x.responseText ?? x.message), false));
      if (enviados) {
        paso = `append ${enviados}`;
        await cliente.append(enviados, crlf(crudo), ["\\Seen"]);
        copiado = true;
      }
      await diag("diag_enviados", { ok: true, carpeta: enviados, carpetas: carpetas.map((c) => `${c.path}${c.specialUse ? ` [${c.specialUse}]` : ""}`), copiado, marcado, errorMarcar, para });
    } catch (err) {
      // La copia en Enviados es una comodidad: si falla, el correo ya ha salido.
      const x = err as Error & { responseText?: string; serverResponseCode?: string; code?: string };
      await diag("diag_enviados", { ok: false, paso, error: x.message, detalle: x.responseText ?? null, codigo: x.serverResponseCode ?? x.code ?? null, para });
    } finally {
      await cliente.logout().catch(() => {});
    }
  }

  return { messageId, para, smtp: String(info.response ?? "") };
}

// ---------------------------------------------------------------------------
// Reposición única (2-11-2026): hasta hoy la copia en Enviados no se hacía,
// porque Arsys no marca su carpeta "Sent" como especial. Se reponen las
// respuestas enviadas desde el panel y se marcan como leídos y respondidos
// los correos a los que contestaban. Corre una vez (config
// `reponer_enviados` = true) desde el cron y se apaga sola.
// ---------------------------------------------------------------------------
export async function reponerEnviados(opciones: { presupuestoMs: number }): Promise<{ repuestos: number; marcados: number; pendientes: number } | null> {
  if ((await config("reponer_enviados", false)) !== true) return null;
  const inicio = Date.now();
  const supabase = supabaseCharlas();
  const { user, pass } = credenciales();
  const remitente = String(await config("remitente", `Alain Zulaika <${user}>`));
  const { data: salientes } = await supabase
    .from("charlas_mensajes")
    .select("id, message_id, in_reply_to, referencias, para, asunto, texto, fecha, tarea_id")
    .eq("direccion", "saliente")
    .not("tarea_id", "is", null)
    .neq("tipo_salida", "prueba")
    .order("fecha");
  const res = { repuestos: 0, marcados: 0, pendientes: 0 };
  const cliente = new ImapFlow({ host: IMAP_HOST, port: 993, secure: true, auth: { user, pass }, logger: false });
  await cliente.connect();
  try {
    const enviados = carpetaEnviados(await cliente.list());
    if (!enviados) return res;
    const lista = salientes ?? [];
    let i = 0;
    for (; i < lista.length; i++) {
      if (Date.now() - inicio > opciones.presupuestoMs) break;
      const m = lista[i];
      if (!m.message_id) continue;
      const id = `<${String(m.message_id).replace(/^<|>$/g, "")}>`;
      const lock = await cliente.getMailboxLock(enviados);
      let ya: number[] = [];
      try {
        ya = await buscarPorMessageId(cliente, id);
      } finally {
        lock.release();
      }
      if (!ya.length) {
        const crudo: Buffer = await new MailComposer({
          from: remitente,
          to: (m.para ?? []).join(", "),
          subject: m.asunto ?? "",
          ...cuerpoCorreo(m.texto ?? ""),
          date: m.fecha ? new Date(m.fecha) : new Date(),
          messageId: id,
          inReplyTo: m.in_reply_to ? `<${String(m.in_reply_to).replace(/^<|>$/g, "")}>` : undefined,
          references: (m.referencias ?? []).map((r: string) => `<${r.replace(/^<|>$/g, "")}>`).join(" ") || undefined,
        })
          .compile()
          .build();
        await cliente.append(enviados, crlf(crudo), ["\\Seen"], m.fecha ? new Date(m.fecha) : undefined);
        res.repuestos++;
      }
      if (m.in_reply_to) {
        await marcarRespondido(cliente, String(m.in_reply_to)).then((ok) => ok && res.marcados++, () => null);
      }
    }
    res.pendientes = lista.length - i;
    await diag("diag_reposicion", { ...res, carpeta: enviados, total: lista.length });
    if (res.pendientes === 0) await supabase.from("charlas_config").upsert({ clave: "reponer_enviados", valor: false, actualizado_en: new Date().toISOString() });
  } catch (err) {
    const x = err as Error & { responseText?: string; serverResponseCode?: string };
    await diag("diag_reposicion", { ...res, error: x.message, detalle: x.responseText ?? null, codigo: x.serverResponseCode ?? null });
    throw err;
  } finally {
    await cliente.logout().catch(() => {});
  }
  return res;
}
