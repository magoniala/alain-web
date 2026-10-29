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
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { supabaseCharlas } from "./charlas";

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
}

async function construirIndice(): Promise<Indice> {
  const supabase = supabaseCharlas();
  const porEmail = new Map<string, string>();
  const dominios = new Map<string, Set<string>>();
  const anotar = (email: string | null, centro: string) => {
    const e = norm(email);
    if (!e.includes("@")) return;
    porEmail.set(e, centro);
    const d = dominio(e);
    if (!dominios.has(d)) dominios.set(d, new Set());
    dominios.get(d)!.add(centro);
  };

  for (let desde = 0; ; desde += 1000) {
    const { data } = await supabase.from("charlas_centros").select("id, responsable_email, email_centro, ampa_email").range(desde, desde + 999);
    for (const c of data ?? []) {
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
  return { porEmail, porDominio };
}

async function centroPorHilo(ids: string[]): Promise<string | null> {
  if (!ids.length) return null;
  const supabase = supabaseCharlas();
  const { data } = await supabase.from("charlas_mensajes").select("centro_id").in("message_id", ids).not("centro_id", "is", null).limit(1);
  if (data?.[0]?.centro_id) return data[0].centro_id;
  const { data: d2 } = await supabase.from("charlas_mensajes").select("centro_id").overlaps("referencias", ids).not("centro_id", "is", null).limit(1);
  return d2?.[0]?.centro_id ?? null;
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
  return { centro: null, por: null };
}

// Asuntos propios de la campaña: un correo sin centro pero con uno de estos
// asuntos se guarda como "pendiente de asignar" en vez de descartarse.
const ASUNTO_CHARLAS = /(calendario de actividades|jardueren egutegia|egutegia|charlas? sobre (la )?atenci|arreta|hitzaldi|dossier|dosierra|magia.*atenci)/i;

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------
export interface ResumenLectura {
  carpetas: Record<string, { revisados: number; asociados: number; pendientes_asignar: number; nuevos_uid: number }>;
  respondidos_desde_mail: number;
  /** true si se han leído todas las carpetas hasta el final (sin cortar por tiempo). */
  al_dia: boolean;
  error?: string;
}

export async function leerBuzon(opciones: { presupuestoMs: number }): Promise<ResumenLectura> {
  const inicio = Date.now();
  const supabase = supabaseCharlas();
  const resumen: ResumenLectura = { carpetas: {}, respondidos_desde_mail: 0, al_dia: true };
  const diasInicial = Number(await config("lectura_inicial_dias", 10));
  const diasHistoricoEnviados = Number(await config("enviados_historico_dias", 75));
  const indice = await construirIndice();

  const cliente = new ImapFlow({ host: IMAP_HOST, port: 993, secure: true, auth: credenciales(), logger: false });
  await cliente.connect();
  try {
    const carpetas = await cliente.list();
    const enviados =
      carpetas.find((c) => c.specialUse === "\\Sent")?.path ??
      carpetas.find((c) => /^(INBOX[./])?(Sent|Enviados|Elementos enviados|Sent Items|Sent Messages)$/i.test(c.path))?.path ??
      null;

    const trabajo: { carpeta: string; direccion: "entrante" | "saliente"; dias: number }[] = [{ carpeta: "INBOX", direccion: "entrante", dias: diasInicial }];
    if (enviados) trabajo.push({ carpeta: enviados, direccion: "saliente", dias: diasHistoricoEnviados });

    for (const t of trabajo) {
      if (Date.now() - inicio > opciones.presupuestoMs) {
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
        if (!est || est.uidvalidity !== uidvalidity) {
          const desde = new Date(Date.now() - t.dias * 86400000);
          uids = ((await cliente.search({ since: desde }, { uid: true })) || []) as number[];
        } else {
          const r = (await cliente.search({ uid: `${Number(est.ultimo_uid) + 1}:*` }, { uid: true })) || [];
          uids = (r as number[]).filter((u) => u > Number(est.ultimo_uid));
        }
        uids.sort((a, b) => a - b);
        stats.nuevos_uid = uids.length;
        let ultimo = est && est.uidvalidity === uidvalidity ? Number(est.ultimo_uid) : 0;

        // Por tandas de 100: cabeceras primero, cuerpo solo si se asocia.
        for (let i = 0; i < uids.length; i += 100) {
          if (Date.now() - inicio > opciones.presupuestoMs) {
            resumen.al_dia = false;
            break;
          }
          const tanda = uids.slice(i, i + 100);
          const cabeceras: FetchMessageObject[] = await cliente.fetchAll(tanda.join(","), { uid: true, envelope: true, headers: ["references"] }, { uid: true });

          for (const m of cabeceras) {
            stats.revisados++;
            const env = m.envelope ?? {};
            const messageId = limpiarId(env.messageId);
            const refs = [...new Set([limpiarId(env.inReplyTo), ...idsDeReferencias(m.headers)].filter(Boolean))];
            const de = norm(env.from?.[0]?.address);
            const destinos = [...(env.to ?? []), ...(env.cc ?? [])].map((a) => norm(a.address)).filter(Boolean);
            const contraparte = t.direccion === "entrante" ? [de, ...(env.replyTo ?? []).map((a) => norm(a.address))] : destinos.filter((d) => !PROPIOS.has(d));

            let { centro, por } = { centro: await centroPorHilo(refs), por: "hilo" as string | null };
            if (!centro) ({ centro, por } = asociar(indice, contraparte));
            const asunto = env.subject ?? "";
            const pendiente = !centro && t.direccion === "entrante" && refs.length > 0 && ASUNTO_CHARLAS.test(asunto);
            if (!centro && !pendiente) continue;

            // Descargar y parsear solo lo asociado. En el histórico de
            // enviados (primera lectura) basta con las cabeceras: sirven
            // para reconocer los hilos.
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

            const fila = {
              centro_id: centro,
              direccion: t.direccion,
              message_id: messageId || `sin-id-${t.carpeta}-${uidvalidity}-${m.uid}`,
              in_reply_to: limpiarId(env.inReplyTo) || null,
              referencias: refs,
              de: env.from?.[0]?.address ?? null,
              para: destinos,
              asunto,
              texto,
              html,
              fecha: fecha?.toISOString() ?? null,
              carpeta: t.carpeta,
              uid: m.uid,
              match_por: centro ? por : null,
              estado: t.direccion === "saliente" ? "procesado" : pendiente ? "pendiente_asignar" : "nuevo",
            };
            const { data: insertado, error } = await supabase
              .from("charlas_mensajes")
              .upsert(fila, { onConflict: "message_id", ignoreDuplicates: true })
              .select("id");
            if (error) throw new Error(`guardar mensaje: ${error.message}`);
            const esNuevo = (insertado?.length ?? 0) > 0;
            if (pendiente) stats.pendientes_asignar++;
            else stats.asociados++;

            if (centro) await actualizarHilo(centro, messageId, refs, asunto, fila.fecha);

            // Si Alain ha contestado desde Mail, la tarea abierta de ese centro ya no hace falta.
            if (esNuevo && t.direccion === "saliente" && centro && fila.fecha) {
              const { data: abiertas } = await supabase
                .from("charlas_tareas")
                .update({ estado: "descartada", motivo: "Respondido desde Mail", resuelto_en: new Date().toISOString(), resuelto_por: "alain" })
                .eq("centro_id", centro)
                .in("estado", ["revisar", "pendiente"])
                .lt("creado_en", fila.fecha)
                .select("id");
              resumen.respondidos_desde_mail += abiertas?.length ?? 0;
            }
          }
          ultimo = Math.max(ultimo, ...tanda);
          await supabase.from("charlas_imap_estado").upsert({ carpeta: t.carpeta, uidvalidity, ultimo_uid: ultimo, ultima_lectura: new Date().toISOString() });
        }
        if (uids.length === 0) {
          await supabase.from("charlas_imap_estado").upsert({ carpeta: t.carpeta, uidvalidity, ultimo_uid: ultimo, ultima_lectura: new Date().toISOString() });
        }
      } finally {
        lock.release();
      }
    }
  } finally {
    await cliente.logout().catch(() => {});
  }
  return resumen;
}

async function actualizarHilo(centro: string, messageId: string, refs: string[], asunto: string, fecha: string | null) {
  const supabase = supabaseCharlas();
  const { data: h } = await supabase.from("charlas_hilos").select("*").eq("centro_id", centro).eq("canal", "principal").maybeSingle();
  if (!h) {
    await supabase.from("charlas_hilos").insert({
      centro_id: centro,
      canal: "principal",
      asunto: asunto.replace(/^((re|rv|fw|fwd|erantz)\s*:\s*)+/i, ""),
      message_id_raiz: refs[0] ?? messageId,
      ultimo_message_id: messageId,
      ultimo_mensaje_en: fecha,
    });
  } else if (fecha && (!h.ultimo_mensaje_en || fecha > h.ultimo_mensaje_en)) {
    await supabase.from("charlas_hilos").update({ ultimo_message_id: messageId, ultimo_mensaje_en: fecha }).eq("id", h.id);
  }
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

export async function enviarCorreo(e: Envio): Promise<{ messageId: string; para: string }> {
  const { user, pass } = credenciales();
  const remitente = String(await config("remitente", `Alain Zulaika <${user}>`));
  const messageId = `${randomUUID()}@alainzulaika.com`;

  const adjuntos = [];
  if (e.dossier) {
    const d = DOSSIER[e.dossier];
    adjuntos.push({ filename: d.nombre, content: await readFile(join(process.cwd(), "assets/charlas", d.archivo)), contentType: "application/pdf" });
  }

  const para = e.prueba ? user : e.para;
  const opciones = {
    from: remitente,
    to: para,
    subject: e.prueba ? `[PRUEBA → ${e.para}] ${e.asunto}` : e.asunto,
    text: e.texto,
    messageId: `<${messageId}>`,
    inReplyTo: !e.prueba && e.inReplyTo ? `<${e.inReplyTo}>` : undefined,
    references: !e.prueba && e.referencias?.length ? e.referencias.map((r) => `<${r}>`).join(" ") : undefined,
    attachments: adjuntos,
  };

  // Se compone una vez: lo que sale por SMTP y la copia de Enviados son el mismo mensaje.
  const crudo: Buffer = await new MailComposer(opciones).compile().build();

  const transporte = nodemailer.createTransport({ host: SMTP_HOST, port: 465, secure: true, auth: { user, pass } });
  await transporte.sendMail({ envelope: { from: user, to: [para] }, raw: crudo });

  if (!e.prueba) {
    // Copia en Enviados para que el hilo se vea completo en Mail del Mac.
    const cliente = new ImapFlow({ host: IMAP_HOST, port: 993, secure: true, auth: { user, pass }, logger: false });
    try {
      await cliente.connect();
      const carpetas = await cliente.list();
      const enviados = carpetas.find((c) => c.specialUse === "\\Sent")?.path;
      if (enviados) await cliente.append(enviados, crudo, ["\\Seen"]);
    } catch {
      // La copia en Enviados es una comodidad: si falla, el correo ya ha salido.
    } finally {
      await cliente.logout().catch(() => {});
    }
  }

  return { messageId, para };
}
