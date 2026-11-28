// Correo en el panel · adelanto de F1 (28-11-2026). Diseño: vault → «Sistema ·
// Arquitectura v4 — bandeja general de correo» y «2026-11-28 Encargo — correo
// en el panel…».
//
// Qué hace (todo aparte del lector de charlas y magia, que NO se toca):
//   1. Trae el cuerpo (con BODY.PEEK, sin marcar nada) de lo ya apuntado en
//      correo_entrada que se va a mostrar. Si el correo es de una vía, copia el
//      texto que ya guardó charlas o magia.
//   2. Lo clasifica: reglas y detección determinista primero; Haiku solo para
//      lo que quede, con tope diario (charlas_config.general_tope_dia_usd).
//   3. Cierra solo las tarjetas cuando ve la respuesta de Alain en Enviados.
//   4. Prepara los datos de Correo › Por revisar.
//
// Regla de oro: nada de aquí puede romper el cron. Todo devuelve en vez de lanzar.

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { supabaseCharlas } from "./charlas";
import { llamarClaude } from "./charlas-ia";
import { quitarCita } from "./charlas-correo";
import { BUZONES_EXTRA, configBuzon } from "./correo-general";

const IMAP_HOST = "imap.serviciodecorreo.es";
const limpiarId = (id: string | null | undefined) => (id ?? "").trim().replace(/^<|>$/g, "");

export const TIPOS = ["solicitud", "conversacion", "newsletter", "testimonio", "tramite", "aviso", "ruido"] as const;
export type Tipo = (typeof TIPOS)[number];

export interface FilaCorreo {
  id: string;
  buzon: string;
  carpeta: string;
  uid: number | null;
  message_id: string;
  in_reply_to: string | null;
  referencias: string[] | null;
  de: string | null;
  de_nombre: string | null;
  dominio: string | null;
  para: string[] | null;
  asunto: string | null;
  fecha: string | null;
  masivo: boolean;
  tratamiento: string;
  categoria: string;
  clasificado_por: string | null;
  via: string | null;
  via_ref: string | null;
  estado: string;
  texto: string | null;
  tipo: Tipo | null;
  etiquetas: string[];
  procesado_en: string | null;
}

async function configValor<T>(clave: string, defecto: T): Promise<T> {
  const { data } = await supabaseCharlas().from("charlas_config").select("valor").eq("clave", clave).maybeSingle();
  return (data?.valor as T) ?? defecto;
}

const hoyMadrid = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

// ---------------------------------------------------------------------------
// Detección determinista (sin IA)
// ---------------------------------------------------------------------------
const RE_AUTORRESPUESTA = /no se consideran v[aá]lidas?|respuesta autom[aá]tica|autorrespuesta|erantzun automatikoa|fuera de(?: la)? oficina|out of office|mensaje autom[aá]tico/i;
const RE_ALTA_SEDE = /sede electr[oó]nica/i;

/** ¿El buzón o el destinatario es el de la newsletter? */
function esDeNewsletter(f: Pick<FilaCorreo, "buzon" | "para">): boolean {
  if (f.buzon === "newsletter" || f.buzon === "newsletter_niala") return true;
  return (f.para ?? []).some((p) => p === "newsletter@alainzulaika.com" || p === "newsletter@niala.es");
}

/** Frases que acaban en «?» (en el estilo de Alain, «??»), sin el «¿». */
export function preguntasDe(texto: string, max = 2): string[] {
  const limpio = texto.replace(/\r/g, "").replace(/^>+\s?/gm, "").replace(/\s+/g, " ");
  const frases = limpio.split(/(?<=[.!?])\s+/).map((s) => s.trim());
  const qs = frases.filter((s) => /\?\s*$/.test(s) && s.length > 6 && s.length < 400).map((s) => s.replace(/\?+\s*$/, "?").replace(/^¿/, ""));
  return qs.slice(-max);
}

/** Texto citado de una respuesta (lo que viene después de «escribió:» o con «>»). */
export function textoCitado(completo: string): string {
  const lineas = completo.replace(/\r/g, "").split("\n");
  const corte = lineas.findIndex((l) => /^(El|On|Le|Am)\s.+(escribió|wrote|a écrit|schrieb)\s*:\s*$/i.test(l.trim()) || /(idatzi zuen|idatzi du)\s*:\s*$/i.test(l.trim()));
  const citadas = lineas.filter((l) => l.startsWith(">")).map((l) => l.replace(/^>+\s?/, ""));
  return citadas.length ? citadas.join("\n") : corte > 0 ? lineas.slice(corte + 1).join("\n") : "";
}

/** Pregunta del mail de la newsletter al que contesta: primero lo citado, después la campaña enviada. */
async function preguntaOrigen(f: FilaCorreo, completo: string): Promise<{ pregunta: string | null; asunto: string | null }> {
  const sb = supabaseCharlas();
  const limpioAsunto = (f.asunto ?? "").replace(/^((re|rv|fw|fwd|erantz)\s*:\s*)+/i, "").trim();
  const citado = textoCitado(completo);
  const q1 = citado ? preguntasDe(citado, 2) : [];
  let asunto: string | null = limpioAsunto || null;
  if (q1.length) return { pregunta: q1.join(" "), asunto };
  try {
    const fecha = f.fecha ? new Date(f.fecha) : new Date();
    const desde = new Date(fecha.getTime() - 12 * 86400000).toISOString();
    const { data } = await sb
      .from("newsletter_campanas")
      .select("subject_es, subject_eu, body_es, body_eu, enviado_en")
      .eq("estado", "enviado")
      .gte("enviado_en", desde)
      .lte("enviado_en", fecha.toISOString())
      .order("enviado_en", { ascending: false })
      .limit(8);
    const lista = data ?? [];
    const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    const igual = lista.find((c) => limpioAsunto && (norm(c.subject_es) === norm(limpioAsunto) || norm(c.subject_eu) === norm(limpioAsunto)));
    const elegida = igual ?? lista[0];
    if (elegida) {
      const eu = !!igual && norm(elegida.subject_eu) === norm(limpioAsunto);
      const cuerpo = (eu ? elegida.body_eu : elegida.body_es) ?? elegida.body_es ?? elegida.body_eu ?? "";
      asunto = (eu ? elegida.subject_eu : elegida.subject_es) ?? asunto;
      const qs = preguntasDe(cuerpo.slice(-1500), 2);
      return { pregunta: qs.length ? qs.join(" ") : null, asunto };
    }
  } catch {
    /* sin campañas: se queda sin pregunta */
  }
  return { pregunta: null, asunto };
}

interface Deteccion {
  tipo?: Tipo;
  etiquetas: string[];
  pendiente?: { titulo: string; fecha: string | null; frase: string | null };
  sinIA?: boolean;
}

/** Lo que se resuelve sin IA. `sinIA` = ya está decidido, no hace falta Haiku. */
export function detectar(f: FilaCorreo, texto: string, categoriaRegla: string | null): Deteccion {
  const d: Deteccion = { etiquetas: [] };
  const cabeza = `${f.asunto ?? ""}\n${texto.slice(0, 1500)}`;
  if (RE_AUTORRESPUESTA.test(cabeza)) {
    d.tipo = "aviso";
    d.sinIA = true;
    if (/no se consideran v[aá]lidas?|solicitudes? .*por (correo|e-?mail)/i.test(cabeza) || RE_ALTA_SEDE.test(cabeza)) d.etiquetas.push("autorrespuesta_ayto");
    else d.etiquetas.push("autorrespuesta");
    return d;
  }
  if (esDeNewsletter(f) && !f.masivo) {
    d.tipo = "newsletter";
    d.etiquetas.push("privado");
  }
  // Trámite de Hacienda y similares: «certificado … disponible» → pendiente sin IA.
  if (categoriaRegla === "tramite" || f.categoria === "tramite") {
    d.tipo = d.tipo ?? "tramite";
    if (/certificad/i.test(cabeza) && /(disponible|descarg)/i.test(cabeza)) {
      const num = cabeza.match(/\b\d{4}-\d{5,9}\b/)?.[0];
      d.pendiente = { titulo: `Descargar y guardar el certificado${num ? ` ${num}` : ""}`, fecha: null, frase: (cabeza.match(/[^.\n]*certificad[^.\n]*\./i)?.[0] ?? "").trim().slice(0, 240) || null };
    }
  }
  return d;
}

// ---------------------------------------------------------------------------
// Haiku, solo para lo que no resuelven las reglas
// ---------------------------------------------------------------------------
interface ResultadoIA {
  tipo: Tipo;
  pide_respuesta: boolean;
  resumen: string | null;
  idioma: string | null;
  pendiente: { titulo: string; fecha: string | null; frase: string | null } | null;
  accion_ficha: "rechazo" | "ampa" | "pide_documento" | null;
  accion_dato: string | null;
}

const SISTEMA_IA = `Clasificas correos que llegan a Alain Zulaika (mago profesional «Niala», charlas sobre atención en centros educativos, entrenamiento personal online «Entrenatzaile»). Lees el remitente, el asunto y el comienzo del cuerpo. Devuelves SOLO un JSON, sin texto alrededor:
{"tipo":"solicitud|conversacion|newsletter|testimonio|tramite|aviso|ruido","pide_respuesta":true,"resumen":"una línea en castellano","idioma":"es|eu|otro","pendiente":null,"accion_ficha":null,"accion_dato":null}
Criterios de «tipo»:
- solicitud: alguien nuevo pide un show, charla, taller, presupuesto o entrenamiento.
- conversacion: continúa un asunto con un centro, cliente, organizador o colaborador.
- newsletter: un suscriptor contesta al mail de la newsletter.
- testimonio: responde a las preguntas de testimonio de Alain (qué esperaba y qué encontró, qué quedó, a quién la recomendaría…) o valora lo que hizo Alain.
- tramite: papeles, certificados, facturas, plazos, formularios de una administración o de un proveedor.
- aviso: confirmaciones, notificaciones, autorrespuestas, nada que contestar.
- ruido: promociones o spam.
«pendiente»: si hay algo que Alain deba hacer (con o sin fecha) pon {"titulo":"verbo en infinitivo y corto","fecha":"AAAA-MM-DD o null","frase":"la frase del correo de la que sale"}; si no, null. La fecha solo si el correo la dice; si es dudosa, null. Si es una solicitud de presupuesto, el pendiente es «Preparar presupuesto para <quién>» (no lo redactas).
«accion_ficha», solo cuando encaje: "rechazo" (el centro o ayuntamiento dice que no, que ya están cubiertos o que no les interesa; en accion_dato, el motivo en una frase corta) · "ampa" (pasan el correo del AMPA o de la asociación de familias; en accion_dato, ese email) · "pide_documento" (piden un proyecto, propuesta o documento por escrito; en accion_dato, qué piden). Si no encaja, null en los dos.
No inventes datos que no estén en el correo.`;

async function gastoIAHoy(): Promise<number> {
  const desde = `${hoyMadrid()}T00:00:00`;
  const { data } = await supabaseCharlas().from("charlas_ia_uso").select("coste_usd").eq("proposito", "correo_general").gte("creado_en", new Date(new Date(desde).getTime() - 3600000).toISOString());
  return (data ?? []).reduce((s, r) => s + (Number(r.coste_usd) || 0), 0);
}

function extraerJSON(t: string): Record<string, unknown> | null {
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ES_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function clasificarConIA(f: FilaCorreo, texto: string, contexto: string): Promise<ResultadoIA | null> {
  try {
    const usuario = `Hoy es ${hoyMadrid()}.\nDe: ${f.de_nombre ?? ""} <${f.de}>\nAsunto: ${f.asunto ?? ""}\nRecibido en: ${f.buzon}${contexto}\n\n${texto.slice(0, 3000)}`;
    const r = await llamarClaude({ system: [{ type: "text", text: SISTEMA_IA }], usuario, maxTokens: 500, proposito: "correo_general", modelo: "claude-haiku-5-5" });
    const j = extraerJSON(r);
    if (!j) return null;
    const tipo = TIPOS.includes(j.tipo as Tipo) ? (j.tipo as Tipo) : "conversacion";
    const p = j.pendiente as Record<string, unknown> | null;
    const accion = ["rechazo", "ampa", "pide_documento"].includes(String(j.accion_ficha)) ? (j.accion_ficha as ResultadoIA["accion_ficha"]) : null;
    let dato = typeof j.accion_dato === "string" && j.accion_dato.trim() ? j.accion_dato.trim().slice(0, 300) : null;
    if (accion === "ampa") {
      const em = (dato ?? texto).match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
      dato = em && ES_EMAIL.test(em[0]) ? em[0].toLowerCase() : null;
    }
    return {
      tipo,
      pide_respuesta: j.pide_respuesta !== false,
      resumen: typeof j.resumen === "string" ? j.resumen.slice(0, 240) : null,
      idioma: typeof j.idioma === "string" ? j.idioma.slice(0, 8) : null,
      pendiente: p && typeof p.titulo === "string" && p.titulo.trim() ? { titulo: p.titulo.trim().slice(0, 160), fecha: typeof p.fecha === "string" && ES_FECHA.test(p.fecha) ? p.fecha : null, frase: typeof p.frase === "string" ? p.frase.slice(0, 240) : null } : null,
      accion_ficha: accion && (accion !== "ampa" || dato) ? accion : null,
      accion_dato: dato,
    };
  } catch {
    return null; // tope de IA alcanzado, red caída…: la tarjeta sale sin clasificar
  }
}

// ---------------------------------------------------------------------------
// IMAP: cuerpos (PEEK) y respuestas en Enviados
// ---------------------------------------------------------------------------
function credencialesBuzon(buzon: string): { host: string; user: string; pass: string } | null {
  if (buzon === "alain") {
    const user = process.env.CHARLAS_MAIL_USER;
    const pass = process.env.CHARLAS_MAIL_PASS;
    return user && pass ? { host: IMAP_HOST, user, pass } : null;
  }
  const b = BUZONES_EXTRA.find((x) => x.id === buzon);
  if (!b) return null;
  const c = configBuzon(b);
  return c.pass ? { host: c.host, user: c.user, pass: c.pass } : null;
}

async function traerCuerpos(filas: FilaCorreo[], hasta: number): Promise<Map<string, string>> {
  const salida = new Map<string, string>();
  const porBuzon = new Map<string, FilaCorreo[]>();
  for (const f of filas) porBuzon.set(f.buzon, [...(porBuzon.get(f.buzon) ?? []), f]);
  for (const [buzon, lista] of porBuzon) {
    const cred = credencialesBuzon(buzon);
    if (!cred || Date.now() > hasta) continue;
    const cliente = new ImapFlow({ host: cred.host, port: 993, secure: true, auth: { user: cred.user, pass: cred.pass }, logger: false });
    try {
      await cliente.connect();
      for (const carpeta of [...new Set(lista.map((f) => f.carpeta || "INBOX"))]) {
        const lock = await cliente.getMailboxLock(carpeta);
        try {
          for (const f of lista.filter((x) => (x.carpeta || "INBOX") === carpeta)) {
            if (Date.now() > hasta) break;
            let uid = f.uid;
            // El UID puede haber cambiado si el servidor reinició UIDVALIDITY: se comprueba el Message-ID.
            let msg = uid ? await cliente.fetchOne(String(uid), { source: true, envelope: true }, { uid: true }).catch(() => null) : null;
            const ok = msg && msg.envelope && (f.message_id.startsWith("sin-id-") || limpiarId(msg.envelope.messageId) === f.message_id);
            if (!ok && !f.message_id.startsWith("sin-id-")) {
              const hallados = ((await cliente.search({ header: { "message-id": f.message_id } }, { uid: true }).catch(() => [])) || []) as number[];
              uid = hallados[0] ?? null;
              msg = uid ? await cliente.fetchOne(String(uid), { source: true, envelope: true }, { uid: true }).catch(() => null) : null;
            }
            if (!msg || !msg.source) continue;
            const p = await simpleParser(msg.source);
            const texto = p.text ?? (p.html ? String(p.html).replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n") : "");
            salida.set(f.id, texto);
          }
        } finally {
          lock.release();
        }
      }
    } catch {
      /* este buzón falla: las demás pasadas lo reintentan */
    } finally {
      await cliente.logout().catch(() => {});
    }
  }
  return salida;
}

/** Texto que ya guardaron charlas o magia para esos Message-ID (evita ir al buzón). */
async function textosDeVias(filas: FilaCorreo[]): Promise<Map<string, string>> {
  const sb = supabaseCharlas();
  const salida = new Map<string, string>();
  const ids = filas.filter((f) => f.via).map((f) => f.message_id);
  if (!ids.length) return salida;
  for (const [tabla] of [["charlas_mensajes"], ["crm_mensajes"]] as const) {
    const { data } = await sb.from(tabla).select("message_id, texto").in("message_id", ids).not("texto", "is", null);
    for (const r of data ?? []) if (r.texto) salida.set(r.message_id as string, r.texto as string);
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Pasada principal
// ---------------------------------------------------------------------------
export interface ResumenPasada {
  procesadas: number;
  con_texto: number;
  con_ia: number;
  cerradas_por_enviados: number;
  purgadas: number;
  error?: string;
}

/** Línea de Registro en una ficha de charlas (no repite la misma línea el mismo día). */
export async function lineaRegistro(centroId: string, canal: string, texto: string, orden = 620): Promise<void> {
  const sb = supabaseCharlas();
  const fecha = hoyMadrid();
  const { data: ya } = await sb.from("charlas_interacciones").select("id").eq("centro_id", centroId).eq("fecha", fecha).eq("texto", texto).limit(1);
  if (ya?.length) return;
  await sb.from("charlas_interacciones").insert({ centro_id: centroId, fecha, canal, texto, orden, origen: "panel" });
}

export async function procesarCorreo(opciones: { presupuestoMs: number; ia?: boolean }): Promise<ResumenPasada | null> {
  const inicio = Date.now();
  const hasta = inicio + opciones.presupuestoMs;
  const sb = supabaseCharlas();
  const res: ResumenPasada = { procesadas: 0, con_texto: 0, con_ia: 0, cerradas_por_enviados: 0, purgadas: 0 };
  try {
    const dias = Number(await configValor("correo_panel_dias", 7));
    const desde = new Date(Date.now() - dias * 86400000).toISOString();
    const { data, error } = await sb
      .from("correo_entrada")
      .select("id,buzon,carpeta,uid,message_id,in_reply_to,referencias,de,de_nombre,dominio,para,asunto,fecha,masivo,tratamiento,categoria,clasificado_por,via,via_ref,estado,texto,tipo,etiquetas,procesado_en")
      .eq("direccion", "entrante")
      .neq("estado", "cerrado")
      .is("procesado_en", null)
      .gte("fecha", desde)
      .order("fecha", { ascending: false })
      .limit(30);
    if (error) return null; // SQL sin ejecutar: se queda en silencio
    const filas = (data ?? []) as FilaCorreo[];

    const { data: reglasData } = await sb.from("correo_remitentes").select("patron, categoria").eq("creado_por", "alain");
    const reglas = new Map((reglasData ?? []).map((r) => [String(r.patron).toLowerCase(), r.categoria as string | null]));
    const categoriaRegla = (de: string | null) => (de ? reglas.get(de.toLowerCase()) ?? reglas.get("@" + de.split("@")[1]) ?? null : null);

    // 1) ¿A quién hay que leerle el cuerpo?
    const necesita = (f: FilaCorreo) => !["solo_cabecera", "silenciado"].includes(f.tratamiento) && !(f.masivo && !f.via && !categoriaRegla(f.de) && f.categoria === "aviso");
    const porLeer = filas.filter((f) => !f.texto && necesita(f));
    const deVias = await textosDeVias(porLeer);
    const aImap = porLeer.filter((f) => !deVias.has(f.message_id)).slice(0, 12);
    const deImap = aImap.length ? await traerCuerpos(aImap, hasta - 4000) : new Map<string, string>();

    // 2) Clasificar
    let llamadasIA = 0;
    const tope = Number(await configValor("general_tope_dia_usd", 1));
    let gastado = opciones.ia === false ? tope : await gastoIAHoy();
    for (const f of filas) {
      if (Date.now() > hasta - 2000) break;
      const completo = f.texto ?? deVias.get(f.message_id) ?? deImap.get(f.id) ?? null;
      const debiaLeerse = necesita(f);
      // Si había que leerlo y no se ha podido traer, se reintenta en la pasada siguiente.
      if (debiaLeerse && completo == null) continue;
      const texto = completo ? quitarCita(completo).slice(0, 8000) : "";
      const cambios: Record<string, unknown> = { procesado_en: new Date().toISOString() };
      if (completo != null && !f.texto) {
        cambios.texto = texto || "(sin texto)";
        cambios.texto_en = new Date().toISOString();
        res.con_texto++;
      }
      const etiquetas = new Set<string>(f.etiquetas ?? []);
      let tipo: Tipo | null = f.tipo;

      if (!debiaLeerse) {
        tipo = f.categoria === "ruido" ? "ruido" : "aviso";
        if (["solo_cabecera"].includes(f.tratamiento) && !f.masivo) etiquetas.add("sin_abrir");
      } else {
        const catRegla = categoriaRegla(f.de);
        const det = detectar(f, texto, catRegla);
        det.etiquetas.forEach((e) => etiquetas.add(e));
        let ia: ResultadoIA | null = null;
        // Haiku para todo lo que no esté ya decidido sin IA (resumen, pendiente y acción de ficha).
        const quiereIA = !det.sinIA && !(det.tipo === "tramite" && det.pendiente);
        if (quiereIA && gastado < tope && llamadasIA < 6 && opciones.ia !== false) {
          const centro = f.via === "charlas" && f.via_ref ? (await sb.from("charlas_centros").select("nombre, tipo").eq("id", f.via_ref).maybeSingle()).data : null;
          const ctx = centro ? `\nEl remitente tiene ficha de charlas: ${centro.nombre} (${centro.tipo ?? "centro"}).` : f.via === "magia" ? "\nEl remitente tiene ficha de magia." : "";
          ia = await clasificarConIA(f, texto, ctx);
          llamadasIA++;
          gastado += 0.0005;
          if (ia) res.con_ia++;
        }
        tipo = det.tipo === "newsletter" || (det.tipo && det.sinIA) ? det.tipo : ia?.tipo ?? det.tipo ?? tipo ?? null;
        // Un correo de la newsletter que Haiku ve como testimonio sigue siendo un testimonio.
        if (det.tipo === "newsletter" && ia?.tipo === "testimonio") tipo = "testimonio";
        if (ia) {
          cambios.pide_respuesta = ia.pide_respuesta;
          cambios.resumen = ia.resumen;
          cambios.idioma = ia.idioma;
          cambios.accion_ficha = ia.accion_ficha;
          cambios.accion_dato = ia.accion_dato;
        }
        const pend = det.pendiente ?? ia?.pendiente ?? null;
        if (pend) cambios.pendiente_sugerido = pend;
        if (tipo === "newsletter" && completo) {
          const o = await preguntaOrigen(f, completo);
          cambios.pregunta_origen = o.pregunta;
          cambios.newsletter_asunto = o.asunto;
          etiquetas.add("privado");
        }
        cambios.clasificado_por = f.clasificado_por ?? (ia ? "ia" : f.clasificado_por);
        // Autorrespuesta de un ayuntamiento: no mueve la ficha; solo una línea en su Registro.
        if (etiquetas.has("autorrespuesta_ayto") && f.via === "charlas" && f.via_ref) {
          await lineaRegistro(f.via_ref, "Sistema", `Autorrespuesta del ayuntamiento (${f.de}): dice que no vale la solicitud por correo y manda a la sede electrónica. No cuenta como respuesta ni cambia el estado.`, 615).catch(() => null);
        }
      }
      cambios.tipo = tipo;
      cambios.etiquetas = [...etiquetas];
      const { error: e2 } = await sb.from("correo_entrada").update(cambios).eq("id", f.id);
      if (!e2) res.procesadas++;
    }
    // Lo que se queda sin tipo por falta de IA (tope o red) se reintenta: procesado_en vuelve a null.
    await sb.from("correo_entrada").update({ procesado_en: null }).is("tipo", null).not("procesado_en", "is", null).neq("estado", "cerrado").gte("fecha", desde).neq("categoria", "ruido");

    // 3) Retención (Arquitectura v4 §3): «solo fecha» 30 días, «completo» 180.
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const d180 = new Date(Date.now() - 180 * 86400000).toISOString();
    const a = await sb.from("correo_entrada").update({ texto: null }).eq("tratamiento", "solo_fecha").not("texto", "is", null).lt("fecha", d30).select("id");
    const b = await sb.from("correo_entrada").update({ texto: null }).neq("tratamiento", "solo_fecha").not("texto", "is", null).lt("fecha", d180).select("id");
    res.purgadas = (a.data?.length ?? 0) + (b.data?.length ?? 0);

    // 4) Cierre automático por respuesta en Enviados
    if (Date.now() < hasta - 3000) res.cerradas_por_enviados = await cerrarPorEnviados(hasta);
    return res;
  } catch (e) {
    res.error = (e as Error).message;
    return res;
  }
}

/** Cierra las tarjetas cuyo correo ya tiene respuesta de Alain en Enviados (solo cabeceras; nunca marca nada). */
async function cerrarPorEnviados(hasta: number): Promise<number> {
  const sb = supabaseCharlas();
  const { data } = await sb
    .from("correo_entrada")
    .select("id, message_id, de, asunto, fecha, tipo, categoria")
    .eq("direccion", "entrante")
    .eq("buzon", "alain")
    .neq("estado", "cerrado")
    .not("tipo", "in", "(aviso,ruido)")
    .not("fecha", "is", null)
    .order("fecha", { ascending: true })
    .limit(200);
  const abiertas = (data ?? []).filter((f) => f.categoria !== "aviso" && f.categoria !== "ruido");
  if (!abiertas.length) return 0;
  const cred = credencialesBuzon("alain");
  if (!cred) return 0;
  const cliente = new ImapFlow({ host: cred.host, port: 993, secure: true, auth: { user: cred.user, pass: cred.pass }, logger: false });
  let cerradas = 0;
  try {
    await cliente.connect();
    const carpetas = await cliente.list();
    const enviados =
      carpetas.find((c) => c.specialUse === "\\Sent")?.path ?? carpetas.find((c) => /^(INBOX[./])?(Sent|Enviados|Elementos enviados|Sent Items|Sent Messages)$/i.test(c.path))?.path ?? null;
    if (!enviados) return 0;
    const lock = await cliente.getMailboxLock(enviados);
    try {
      const desde = new Date(new Date(abiertas[0].fecha as string).getTime() - 3600000);
      const uids = ((await cliente.search({ since: desde }, { uid: true })) || []) as number[];
      if (!uids.length) return 0;
      const idsRespondidos = new Set<string>();
      const destinatarios: { para: string[]; fecha: number; asunto: string }[] = [];
      for (let i = 0; i < uids.length; i += 100) {
        if (Date.now() > hasta) break;
        const tanda = uids.slice(i, i + 100);
        const msgs = await cliente.fetchAll(tanda.join(","), { uid: true, envelope: true, headers: ["references", "in-reply-to"] }, { uid: true });
        for (const m of msgs) {
          const env = m.envelope ?? {};
          if (env.inReplyTo) idsRespondidos.add(limpiarId(env.inReplyTo));
          const refs = String(m.headers ?? "").replace(/\r?\n[ \t]+/g, " ").match(/^references:\s*(.*)$/im)?.[1] ?? "";
          for (const r of refs.matchAll(/<([^>]+)>/g)) idsRespondidos.add(r[1].trim());
          destinatarios.push({ para: [...(env.to ?? []), ...(env.cc ?? [])].map((a) => (a.address ?? "").toLowerCase()), fecha: env.date ? new Date(env.date).getTime() : 0, asunto: (env.subject ?? "").replace(/^((re|rv|fw|fwd|erantz)\s*:\s*)+/i, "").trim().toLowerCase() });
        }
      }
      for (const f of abiertas) {
        const asunto = (f.asunto ?? "").replace(/^((re|rv|fw|fwd|erantz)\s*:\s*)+/i, "").trim().toLowerCase();
        const porHilo = idsRespondidos.has(f.message_id);
        const porDestino = !!f.de && !!asunto && destinatarios.some((d) => d.para.includes((f.de as string).toLowerCase()) && d.fecha > new Date(f.fecha as string).getTime() && d.asunto === asunto);
        if (!porHilo && !porDestino) continue;
        const { error } = await sb.from("correo_entrada").update({ estado: "cerrado", cerrado_en: new Date().toISOString(), cerrado_motivo: "respondido en Mail" }).eq("id", f.id);
        if (!error) cerradas++;
      }
    } finally {
      lock.release();
    }
  } catch {
    /* sin acceso a Enviados: las tarjetas siguen abiertas */
  } finally {
    await cliente.logout().catch(() => {});
  }
  return cerradas;
}

// ---------------------------------------------------------------------------
// Datos del panel
// ---------------------------------------------------------------------------
export async function panelPorRevisar() {
  const sb = supabaseCharlas();
  const dias = Number(await configValor("correo_panel_dias", 7));
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const { data, error } = await sb
    .from("correo_entrada")
    .select("id,buzon,message_id,de,de_nombre,dominio,asunto,fecha,masivo,tratamiento,categoria,via,via_ref,estado,texto,tipo,etiquetas,pide_respuesta,idioma,resumen,pendiente_sugerido,accion_ficha,accion_dato,pregunta_origen,newsletter_asunto,procesado_en")
    .eq("direccion", "entrante")
    .neq("estado", "cerrado")
    .gte("fecha", desde)
    .neq("tratamiento", "silenciado")
    .order("fecha", { ascending: false })
    .limit(400);
  if (error) return { listo: false as const, error: error.message };
  const filas = data ?? [];

  const ids = filas.map((f) => f.id as string);
  const mids = filas.map((f) => f.message_id as string);
  const [tes, resp, pend, hechos] = await Promise.all([
    mids.length ? sb.from("testimonios").select("message_id").in("message_id", mids) : Promise.resolve({ data: [] as { message_id: string }[] }),
    mids.length ? sb.from("correo_respuestas_news").select("message_id").in("message_id", mids) : Promise.resolve({ data: [] as { message_id: string }[] }),
    sb.from("correo_pendientes").select("*").eq("estado", "abierto").order("fecha_limite", { ascending: true, nullsFirst: false }).order("creado_en"),
    sb.from("correo_pendientes").select("*").eq("estado", "hecho").gte("hecho_en", new Date(Date.now() - 30 * 86400000).toISOString()).order("hecho_en", { ascending: false }).limit(50),
  ]);
  const conTestimonio = new Set((tes.data ?? []).map((r) => r.message_id));
  const conRespuesta = new Set((resp.data ?? []).map((r) => r.message_id));

  const centroIds = [...new Set(filas.filter((f) => f.via === "charlas" && f.via_ref).map((f) => f.via_ref as string))];
  const fichas = new Map<string, Record<string, unknown>>();
  if (centroIds.length) {
    const { data: cs } = await sb.from("charlas_centros").select("id, nombre, tipo, estado, ampa_email, etiquetas, motivo_rechazo").in("id", centroIds);
    for (const c of cs ?? []) fichas.set(c.id as string, c);
  }

  const tarjetas = filas.map((f) => ({
    id: f.id,
    buzon: f.buzon,
    message_id: f.message_id,
    de: f.de,
    de_nombre: f.de_nombre,
    asunto: f.asunto,
    fecha: f.fecha,
    tipo: (f.tipo as string | null) ?? (f.categoria === "aviso" || f.categoria === "ruido" ? f.categoria : null),
    categoria: f.categoria,
    via: f.via,
    etiquetas: f.etiquetas ?? [],
    pide_respuesta: f.pide_respuesta,
    idioma: f.idioma,
    resumen: f.resumen,
    texto: f.texto ? String(f.texto).slice(0, 6000) : null,
    sin_abrir: f.tratamiento === "solo_cabecera",
    pendiente_sugerido: f.pendiente_sugerido,
    accion_ficha: f.accion_ficha,
    accion_dato: f.accion_dato,
    pregunta_origen: f.pregunta_origen,
    newsletter_asunto: f.newsletter_asunto,
    testimonio_guardado: conTestimonio.has(f.message_id),
    respuesta_guardada: conRespuesta.has(f.message_id),
    ficha: f.via === "charlas" && f.via_ref ? fichas.get(f.via_ref as string) ?? null : null,
    via_ref: f.via_ref,
  }));
  void ids;
  return { listo: true as const, dias, tarjetas, pendientes: pend.data ?? [], hechos: hechos.data ?? [] };
}
