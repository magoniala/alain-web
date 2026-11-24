// Fase 2 del presupuesto desde el panel: el PDF que sale del chat de
// presupuestos se sube a la ficha (bucket privado `presupuestos` de Supabase
// Storage, carpeta = id de la ficha) y se manda con el mail corto, en el mismo
// hilo que la conversación. Al enviarlo la ficha pasa a «5 Propuesta enviada»
// con la secuencia de la validez ya puesta (aviso el laborable anterior →
// pedir el no el último día → aparcar o liberar; lib/presupuesto-validez).
// «Enviado a mano» hace lo mismo sin mandar nada (Mail del Mac, WhatsApp).
// No toca el espejo del vault: el PDF del vault lo sigue guardando el chat de presupuestos.

import { supabaseCharlas } from "./charlas";
import { enviarCorreo } from "./charlas-correo";
import { extraerNumero, seguimientoAlEnviar } from "./presupuesto-validez";

export const BUCKET_PRESUPUESTOS = "presupuestos";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

function validarFicha(id: unknown): string {
  if (typeof id !== "string" || !UUID.test(id)) throw new Error("Ficha no válida.");
  return id;
}
function validarRuta(ficha: string, ruta: unknown): string {
  if (typeof ruta !== "string" || !ruta.startsWith(`${ficha}/`) || ruta.includes("..")) throw new Error("Ruta de adjunto no válida.");
  return ruta;
}

/** Fecha ISO sumando días laborables (lunes a viernes). */
export function sumarLaborables(desdeISO: string, dias: number): string {
  const d = new Date(`${desdeISO}T12:00:00Z`);
  let n = 0;
  while (n < dias) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return d.toISOString().slice(0, 10);
}

async function asegurarBucket() {
  const sb = supabaseCharlas();
  const { data } = await sb.storage.getBucket(BUCKET_PRESUPUESTOS);
  if (!data) {
    const { error } = await sb.storage.createBucket(BUCKET_PRESUPUESTOS, { public: false });
    if (error && !/exist/i.test(error.message)) throw new Error(error.message);
  }
}

/** URL firmada para subir el PDF directamente a Storage (sin pasar por Vercel, que limita el tamaño). */
export async function urlSubida(fichaId: unknown, nombre: unknown) {
  const ficha = validarFicha(fichaId);
  await asegurarBucket();
  const limpio = String(nombre ?? "presupuesto.pdf").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "presupuesto.pdf";
  const sello = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
  const ruta = `${ficha}/${sello}_${/\.pdf$/i.test(limpio) ? limpio : `${limpio}.pdf`}`;
  const { data, error } = await supabaseCharlas().storage.from(BUCKET_PRESUPUESTOS).createSignedUploadUrl(ruta);
  if (error) throw new Error(error.message);
  return { ruta, url: data.signedUrl };
}

/** Tras subirlo: línea en el Registro para que conste en la ficha (y en el vault, por el espejo del Registro). */
export async function apuntarSubida(fichaId: unknown, rutaIn: unknown) {
  const ficha = validarFicha(fichaId);
  const ruta = validarRuta(ficha, rutaIn);
  await supabaseCharlas().from("crm_interacciones").insert({ ficha_id: ficha, fecha: hoy(), canal: "Sistema", texto: `Presupuesto PDF subido al panel: ${nombreDe(ruta)}`, orden: 610, origen: "panel" });
  return { ok: true };
}

const nombreDe = (ruta: string) => ruta.split("/").pop()!.replace(/^\d{12}_/, "");

/** Adjuntos de la ficha, con enlace firmado de 1 h para abrirlos. */
export async function listarAdjuntos(fichaId: unknown) {
  const ficha = validarFicha(fichaId);
  const sb = supabaseCharlas();
  const { data } = await sb.storage.from(BUCKET_PRESUPUESTOS).list(ficha, { sortBy: { column: "created_at", order: "desc" } });
  const ficheros = (data ?? []).filter((f) => f.name && !f.name.startsWith("."));
  if (!ficheros.length) return [];
  const rutas = ficheros.map((f) => `${ficha}/${f.name}`);
  const { data: firmadas } = await sb.storage.from(BUCKET_PRESUPUESTOS).createSignedUrls(rutas, 3600);
  return ficheros.map((f, i) => ({ ruta: rutas[i], nombre: nombreDe(rutas[i]), subido: f.created_at ?? null, url: firmadas?.[i]?.signedUrl ?? null }));
}

/** Hilo de la ficha: el abierto en crm_hilos o, si no, el último correo real con ella. */
async function hiloFicha(ficha: string) {
  const sb = supabaseCharlas();
  const valido = (id: string | null | undefined) => !!id && !id.startsWith("sin-id-");
  const sinPrefijo = (a: string | null | undefined) => String(a ?? "").replace(/^((re|rv|fw|fwd|erantz)\s*:\s*)+/i, "").trim() || null;
  const { data: h } = await sb.from("crm_hilos").select("ultimo_message_id, message_id_raiz, asunto").eq("ficha_id", ficha).eq("canal", "principal").maybeSingle();
  if (h && valido(h.ultimo_message_id)) return { inReplyTo: h.ultimo_message_id as string, referencias: [...new Set([h.message_id_raiz, h.ultimo_message_id].filter(Boolean) as string[])], asunto: sinPrefijo(h.asunto) };
  const { data: m } = await sb.from("crm_mensajes").select("message_id, referencias, asunto").eq("ficha_id", ficha).or("tipo_salida.is.null,tipo_salida.neq.prueba").not("message_id", "is", null).order("fecha", { ascending: false }).limit(1).maybeSingle();
  if (m && valido(m.message_id)) return { inReplyTo: m.message_id as string, referencias: [...(m.referencias ?? []), m.message_id].slice(-15) as string[], asunto: sinPrefijo(m.asunto) };
  return { inReplyTo: null, referencias: [] as string[], asunto: sinPrefijo(h?.asunto) };
}

/** Lo que el panel necesita para rellenar el formulario de envío. */
export async function datosEnvio(fichaId: unknown) {
  const ficha = validarFicha(fichaId);
  const sb = supabaseCharlas();
  const [{ data: f }, hilo, adjuntos] = await Promise.all([
    sb.from("crm_fichas").select("responsable_email, email").eq("id", ficha).single(),
    hiloFicha(ficha),
    listarAdjuntos(ficha),
  ]);
  return { para: f?.responsable_email || f?.email || "", asunto: hilo.asunto ? `Re: ${hilo.asunto}` : "", adjuntos };
}

/** Envía el mail con el PDF adjunto en el hilo de la ficha y la deja en «5 Propuesta enviada». */
export async function enviarPresupuesto(b: Record<string, unknown>) {
  const ficha = validarFicha(b.ficha);
  const ruta = validarRuta(ficha, b.ruta);
  const para = String(b.para ?? "").trim();
  const asunto = String(b.asunto ?? "").trim();
  const texto = String(b.texto ?? "").trim();
  if (!para.includes("@")) throw new Error("Falta el email del destinatario.");
  if (!asunto) throw new Error("Falta el asunto.");
  if (!texto) throw new Error("Pega el mail que va con el presupuesto.");
  const validez = String(b.validez ?? "");
  const numero = String(b.numero ?? "").trim() || extraerNumero(ruta, texto);
  seguimientoAlEnviar(validez, numero, hoy()); // la validez es obligatoria: se comprueba antes de mandar nada
  const sb = supabaseCharlas();

  const { data: blob, error } = await sb.storage.from(BUCKET_PRESUPUESTOS).download(ruta);
  if (error || !blob) throw new Error(`No se encuentra el PDF: ${error?.message ?? ruta}`);
  const nombre = nombreDe(ruta);
  const { data: cfg } = await sb.from("charlas_config").select("valor").eq("clave", "modo_prueba").maybeSingle();
  const prueba = cfg?.valor !== false;
  const hilo = await hiloFicha(ficha);

  const envio = await enviarCorreo({ para, asunto, texto, inReplyTo: hilo.inReplyTo, referencias: hilo.referencias, dossier: null, adjuntos: [{ filename: nombre, content: Buffer.from(await blob.arrayBuffer()), contentType: "application/pdf" }], prueba });
  if (prueba) return { ok: true, prueba: true, enviado_a: envio.para };

  const ahora = new Date().toISOString();
  await sb.from("crm_mensajes").insert({ ficha_id: ficha, direccion: "saliente", message_id: envio.messageId, in_reply_to: hilo.inReplyTo, referencias: hilo.referencias, de: "alain@alainzulaika.com", para: [para], asunto, texto, fecha: ahora, estado: "procesado", tipo_salida: "presupuesto" });
  await sb.from("crm_hilos").upsert({ ficha_id: ficha, canal: "principal", asunto: asunto.replace(/^((re|rv|fw|fwd|erantz)\s*:\s*)+/i, ""), message_id_raiz: hilo.referencias[0] ?? envio.messageId, ultimo_message_id: envio.messageId, ultimo_mensaje_en: ahora }, { onConflict: "ficha_id,canal" });
  const seg = await dejarEnPropuesta(ficha, { validez, numero, canal: "Mail", detalle: `con el PDF (${nombre})`, para, contarMail: true });
  return { ok: true, prueba: false, enviado_a: envio.para, ...seg };
}

/** Lo enviado fuera del panel (Mail del Mac, WhatsApp…): mismo efecto en la ficha, sin mandar nada. */
export async function presupuestoAMano(b: Record<string, unknown>) {
  const ficha = validarFicha(b.ficha);
  const canal = ["Mail", "WhatsApp"].includes(String(b.canal)) ? String(b.canal) : "Otra vía";
  const validez = String(b.validez ?? "");
  const numero = String(b.numero ?? "").trim() || null;
  seguimientoAlEnviar(validez, numero, hoy()); // valida antes de tocar nada
  const seg = await dejarEnPropuesta(ficha, { validez, numero, canal, detalle: "a mano, fuera del panel", para: null, contarMail: canal === "Mail" });
  return { ok: true, ...seg };
}

/** Ficha → «5 Propuesta enviada» con la secuencia de la validez, línea en el Registro y fuera las tarjetas que ya no tocan. */
async function dejarEnPropuesta(ficha: string, o: { validez: string; numero: string | null; canal: string; detalle: string; para: string | null; contarMail: boolean }) {
  const sb = supabaseCharlas();
  const ahora = new Date().toISOString();
  const s = seguimientoAlEnviar(o.validez, o.numero, hoy());
  const { data: f } = await sb.from("crm_fichas").select("mails_enviados, email").eq("id", ficha).single();
  await sb.from("crm_fichas").update({ estado: "5 Propuesta enviada", fecha_ultimo_contacto: hoy(), ...(o.contarMail ? { mails_enviados: (f?.mails_enviados ?? 0) + 1 } : {}), proxima_accion: s.proxima_accion, fecha_proxima_accion: s.fecha_proxima_accion, enviado: false, actualizado_por: "panel", ...(o.para && f && !f.email ? { email: o.para.toLowerCase() } : {}) }).eq("id", ficha);
  const pasos = s.aviso ? `aviso (MSG 06) el ${s.aviso} · pedir el no (MSG 07) el ${s.pedir_no}` : `sin tiempo para el aviso: pedir el no (MSG 07) el ${s.pedir_no}`;
  await sb.from("crm_interacciones").insert({ ficha_id: ficha, fecha: hoy(), canal: o.canal, texto: `Presupuesto ${o.numero ?? ""} enviado por ${o.canal} ${o.detalle}`.replace(/\s+/g, " ") + ` · → 5 Propuesta enviada · validez hasta ${o.validez} · ${pasos}`, orden: 620, origen: "panel" });
  // Las tarjetas abiertas de esta ficha ya no tocan: acaba de salir el presupuesto.
  await sb.from("crm_tareas").update({ estado: "descartada", motivo: "Presupuesto enviado", resuelto_en: ahora, resuelto_por: "sistema" }).eq("ficha_id", ficha).eq("estado", "revisar").neq("tipo", "llamada_alain");
  return { siguiente: s.fecha_proxima_accion, aviso: s.aviso, pedir_no: s.pedir_no, proxima_accion: s.proxima_accion };
}
