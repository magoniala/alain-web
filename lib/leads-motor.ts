// Motor del carril de LEADS de Entrenatzaile (crm_fichas, carril "entrenatzaile"), 23-11-2026.
//
// Diseño y decisiones de Alain: vault, «01 - PROYECTOS/🤖 Sistema automático/
// 2026-11-20 Encargo — leads de Entrenatzaile y check-ins en admin.md» (Resultado).
// Reglas: «Vías/Entrenatzaile/Guiones/00 Flujo leads.md».
//
// Cada pasada mira las fichas con fecha_proxima_accion <= hoy y sin tarjeta
// abierta, y según el estado:
//   · 1 Escrito          → tarjeta «Seguimiento» (mismo hilo) · al enviar: 2, fecha D9
//   · 2 Seguimiento env. → SOLO (decisión 5): 9 Aparcado con check-in el D30
//   · 4 Propuesta        → si la ventana cerró hace más de 1 día: SOLO a 9 con check-in +30; si no, recordatorio
//   · 9 Aparcado         → «Check-in» si la próxima acción lo dice; si no («solo mirar»), recordatorio
//   · resto (3, 5, 6, 7, 8 con fecha) → recordatorio sin mensaje con la próxima acción tal cual
//   · 0 Por escribir     → nada todavía (las altas automáticas van antes de la próxima tirada)
// Los borradores salen de la plantilla del guion (sin IA por ahora). Nada se envía solo.
// Interruptor: charlas_config.leads_modo = apagado | prueba | activo (en prueba los
// correos solo le llegan a Alain; ver lib/crm-envio.ts).

import { tarjetaYaCreada } from "@/lib/cron-cierre";
import { supabaseCharlas } from "./charlas";
import { telefonoWa } from "./crm-motor";
import { llamadaDe, mensajeConfirmacion, mensajePreparacion, pasoEnviadoEnTexto, pasoQueToca, siguienteTrasPaso, ETIQUETA_PASO, type Faltas, type PasoReserva } from "./leads-guion";

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
const sumar = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const fase = (e: string | null | undefined) => Number(/^(\d)/.exec(e ?? "")?.[1] ?? -1);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FichaLead = { id: string; nombre: string; estado: string; email: string | null; telefono: string | null; canal: string | null; proxima_accion: string | null; fecha_proxima_accion: string | null; mails_enviados: number; datos: Record<string, any> | null };

export type TipoLead = "check_in" | "seguimiento" | "recordatorio" | "aparcar";
export interface DecisionLead {
  tipo: TipoLead;
  /** true: se aplica solo, sin tarjeta (decisión 5 de Alain). */
  solo?: boolean;
  conMensaje: boolean;
  cambios: Record<string, unknown>;
  nota?: string;
  /** Por qué no hay mensaje (solo si conMensaje es false): se enseña en la tarjeta en vez de un «Sin mensaje» mudo. */
  motivoSinMensaje?: string;
}

/**
 * Motivo en una línea de por qué una tarjeta no trae mensaje. Nunca «Sin mensaje» a secas.
 * (La tarjeta del panel repite esta lógica con los datos de la ficha para las tarjetas ya creadas: LeadsTab.tsx.)
 */
export function motivoSinMensaje(f: Pick<FichaLead, "estado" | "proxima_accion">): string {
  const fa = fase(f.estado);
  const pa = (f.proxima_accion ?? "").trim();
  if (fa === 8) return "nada que enviar, cerrar o aplazar";
  if (fa === 7) return "es cliente: nada que enviar desde aquí, cierra o aplaza";
  if (fa === 9) return "aparcado: nada que enviar, cierra o aplaza";
  if (fa === 5) return pa ? `Hoja de Ruta reservada, ahora no hay mensaje del guion que enviar («${pa.length > 90 ? `${pa.slice(0, 90)}…` : pa}»)` : "Hoja de Ruta reservada, pero no encuentro la fecha de la llamada: míralo en la ficha";
  if (/esper/i.test(pa)) return `espera su respuesta («${pa.length > 90 ? `${pa.slice(0, 90)}…` : pa}»)`;
  return pa ? `no hay mensaje para este paso («${pa.length > 90 ? `${pa.slice(0, 90)}…` : pa}»): decide desde aquí` : "la ficha no dice qué toca: decide desde aquí (aplazar, cambiar estado o descartar)";
}

const CHECKIN_SIGUIENTE = "Sin acción: sigue en el diario. Si contesta a cualquier mensaje, vuelve a 3 En conversación";

export function decidirLead(f: FichaLead, h = hoy()): DecisionLead | null {
  const fa = fase(f.estado);
  const pa = f.proxima_accion ?? "";
  const entrada = (f.datos?.fecha_entrada as string | undefined) ?? null;
  if (fa === 0) return null;
  if (fa === 1) {
    return { tipo: "seguimiento", conMensaje: true, cambios: { estado: "2 Seguimiento enviado", proxima_accion: "Si no contesta: 9 Aparcado y check-in el D30", fecha_proxima_accion: entrada ? sumar(entrada, 9) : sumar(h, 5) } };
  }
  if (fa === 2) {
    const d30 = entrada ? sumar(entrada, 30) : sumar(h, 21);
    return { tipo: "aparcar", solo: true, conMensaje: false, cambios: { estado: "9 Aparcado", proxima_accion: "Check-in de una línea por el mismo canal e hilo ([[Leads · Check-in]])", fecha_proxima_accion: d30 > h ? d30 : sumar(h, 7) }, nota: "Sin respuesta al seguimiento (D9): aparcado solo, check-in el D30" };
  }
  if (fa === 4) {
    const ventana = (f.datos?.ventana_hasta as string | undefined) ?? null;
    if (ventana && sumar(ventana, 1) < h) {
      return { tipo: "aparcar", solo: true, conMensaje: false, cambios: { estado: "9 Aparcado", proxima_accion: "Check-in de una línea por el mismo canal e hilo ([[Leads · Check-in]])", fecha_proxima_accion: sumar(h, 30) }, nota: "Ventana gratuita cerrada sin respuesta a la propuesta: aparcado solo, check-in a +30" };
    }
  }
  if (fa === 9 && /check-?in/i.test(pa)) {
    return { tipo: "check_in", conMensaje: true, cambios: { estado: "9 Aparcado", proxima_accion: CHECKIN_SIGUIENTE, fecha_proxima_accion: null } };
  }
  return { tipo: "recordatorio", conMensaje: false, cambios: { fecha_proxima_accion: sumar(h, 3) }, nota: pa ? `La ficha dice: «${pa}»` : "La ficha no dice qué toca: decide desde aquí (aplazar, cambiar estado o descartar).", motivoSinMensaje: motivoSinMensaje(f) };
}

/** Canal y destinatario: WhatsApp solo si escribió él o dio permiso (regla del Flujo); Instagram, a mano. */
export function canalLead(f: FichaLead): { canal: "mail" | "whatsapp" | "ninguno"; destinatario: string | null; instagram: boolean } {
  const pref = (f.canal ?? "").toLowerCase();
  const si = (v: unknown) => /^s[ií]/i.test(String(v ?? ""));
  const tel = telefonoWa(f.telefono);
  const mail = (f.email ?? "").split(/[\/;,\s]+/).find((e) => e.includes("@")) ?? null;
  const waPermitido = si(f.datos?.escribio_wa) || si(f.datos?.whatsapp_consent);
  if (/insta/.test(pref)) return { canal: "ninguno", destinatario: null, instagram: true };
  if (/whats/.test(pref) && tel && waPermitido) return { canal: "whatsapp", destinatario: tel, instagram: false };
  if (mail) return { canal: "mail", destinatario: mail, instagram: false };
  if (tel && waPermitido) return { canal: "whatsapp", destinatario: tel, instagram: false };
  return { canal: "ninguno", destinatario: null, instagram: false };
}

const nombrePila = (n: string) => (n.trim().split(/\s+/)[0] || n).replace(/^./, (c) => c.toUpperCase());
/** Mayúscula al principio y tras cada «¿». */
const mayuscula = (s: string) => s.trim().replace(/(^|¿)\s*([a-záéíóúñ])/gi, (m, _a: string, c: string) => m.replace(c, c.toUpperCase()));

/**
 * Borrador de la plantilla del guion ([[Leads · Check-in]], [[Leads · Seguimiento]]).
 * Si la próxima acción ya trae la pregunta («Check-in por mail: ¿qué tal con el fisio?»), se usa esa.
 */
export function borradorLead(f: FichaLead, tipo: TipoLead, canal: "mail" | "whatsapp" | "ninguno"): { texto: string; nota: string } {
  const nombre = nombrePila(f.nombre);
  const pregunta = /(¿[^¿]*\?)(\s*¿[^¿]*\?)*/.exec(f.proxima_accion ?? "")?.[0]?.trim() ?? null;
  const firma = canal === "mail" ? "\n\nAlain" : "";
  if (tipo === "seguimiento") {
    return {
      texto: `Hola ${nombre},\n\nTe lo pongo más fácil: ${pregunta ? mayuscula(pregunta) : "[pregunta de elegir entre dos, sobre lo que escribió]"}\n\nCon una palabra me vale.${firma}`,
      nota: pregunta ? "Plantilla del Seguimiento con la pregunta de la ficha." : "Plantilla del Seguimiento: escribe la pregunta de elegir entre dos (ejemplos en Leads · Seguimiento).",
    };
  }
  const respuesta = String(f.datos?.respuesta ?? "").trim().replace(/^["“«]+|["”»]+$/g, "").replace(/[.\s]+$/, "");
  // Su respuesta del formulario citada tal cual (no se parafrasea: con frases sueltas sale mal); Alain la retoca.
  const cuerpo = pregunta ? mayuscula(pregunta) : respuesta ? `Hace unas semanas me escribiste por lo de "${respuesta.charAt(0).toLowerCase()}${respuesta.slice(1)}". ¿Cómo va eso?` : "Hace unas semanas me escribiste por [lo que escribió]. ¿Cómo va eso?";
  return {
    texto: `Hola ${nombre},\n\n${cuerpo}\n\nCon una línea me vale.${firma}`,
    nota: pregunta ? "Plantilla del Check-in con la pregunta de la ficha." : "Plantilla del Check-in con su respuesta del formulario tal cual: retócala con su caso (despliega «Su caso»).",
  };
}

export interface ResumenMotorLeads {
  modo: string;
  revisados: number;
  creadas: number;
  solos: number;
  ya_abiertas: number;
  errores: string[];
}

export async function tareasPorFechaLeads(opciones: { presupuestoMs: number }): Promise<ResumenMotorLeads> {
  const inicio = Date.now();
  const sb = supabaseCharlas();
  const { data: cfg } = await sb.from("charlas_config").select("valor").eq("clave", "leads_modo").maybeSingle();
  const modo = String(cfg?.valor ?? "apagado");
  const res: ResumenMotorLeads = { modo, revisados: 0, creadas: 0, solos: 0, ya_abiertas: 0, errores: [] };
  if (modo !== "prueba" && modo !== "activo") return res;
  const h = hoy();
  // Primero los pasos de las reservas de Hoja de Ruta (Mensaje 2 y 3 del guion): no dependen de que alguien escriba la próxima acción.
  try {
    res.creadas += await pasosReservaHojaRuta({ presupuestoMs: Math.max(0, opciones.presupuestoMs - (Date.now() - inicio)) });
  } catch (e) {
    res.errores.push(`Hoja de Ruta (pasos de la reserva): ${(e as Error).message}`);
  }
  const { data: fichas } = await sb.from("crm_fichas").select("id, nombre, estado, email, telefono, canal, proxima_accion, fecha_proxima_accion, mails_enviados, datos").eq("carril", "entrenatzaile").lte("fecha_proxima_accion", h).order("fecha_proxima_accion");
  const { data: abiertas } = await sb.from("crm_tareas").select("ficha_id").eq("carril", "entrenatzaile").in("estado", ["revisar", "pendiente", "aprobada"]);
  const conTarea = new Set((abiertas ?? []).map((t) => t.ficha_id as string));
  for (const f of (fichas ?? []) as FichaLead[]) {
    if (Date.now() - inicio > opciones.presupuestoMs) break;
    if (conTarea.has(f.id)) {
      res.ya_abiertas++;
      continue;
    }
    res.revisados++;
    const d = decidirLead(f, h);
    if (!d) continue;
    try {
      if (d.solo) {
        await aplicarSolo(f, d);
        res.solos++;
      } else if (await crearTareaLead(f, d)) res.creadas++;
    } catch (e) {
      res.errores.push(`${f.nombre}: ${(e as Error).message}`);
    }
  }
  return res;
}

// ---------------------------------------------------------------------------
// Pasos de la reserva de Hoja de Ruta (28-11-2026). Una ficha en «5 Hoja de Ruta reservada» con una
// reserva con fecha genera sola las tarjetas del guion «Leads · Hoja de Ruta reservada»:
//   · Mensaje 2 (preparación): desde 3 días antes de la llamada y, como tarde, la víspera.
//   · Mensaje 3 (confirmación): desde 24 h antes de la llamada (el corte).
// El Mensaje 1 (al reservar) lo sigue llevando el bloque «WhatsApp de confirmación» de la pestaña Hoja de Ruta.
// Mensajes 4 y 5 (no aparece / cierre): las plantillas están en lib/leads-guion.ts, pero todavía no se generan solos.
// Nunca se envía nada solo: la tarjeta trae el texto, Alain lo copia/abre WhatsApp y marca «enviado».
// ---------------------------------------------------------------------------
const ABIERTAS = ["revisar", "pendiente", "aprobada"];

type FichaReserva = FichaLead & { cuerpo_despues: string | null };
interface ReservaLead { id: string; hueco: string; creado_en: string; telefono: string | null }

async function reservaDeFicha(f: FichaLead): Promise<ReservaLead | null> {
  const sb = supabaseCharlas();
  const correos = (f.email ?? "").split(/[\/;,\s]+/).filter((e) => e.includes("@"));
  const tel9 = (f.telefono ?? "").replace(/\D/g, "").slice(-9);
  const filtros: string[] = [...correos.map((e) => `email.ilike.${e}`), ...(tel9.length === 9 ? [`telefono.ilike.%${tel9}%`] : [])];
  if (!filtros.length) return null;
  const { data } = await sb
    .from("hoja_ruta_reservas")
    .select("id, hueco, creado_en, telefono, tipo")
    .or(filtros.join(","))
    .not("hueco", "is", null)
    .is("cancelada_en", null)
    .order("hueco", { ascending: true })
    .limit(10);
  const desde = Date.now() - 12 * 3600 * 1000;
  const r = ((data ?? []) as (ReservaLead & { tipo: string | null })[]).find((x) => x.tipo !== "infoproductos" && new Date(x.hueco).getTime() >= desde);
  return r ?? null;
}

/** ¿Falta el PAR-Q+ o el peso en ayunas? Ante la duda (no se encuentra) se da por faltante: la línea se puede borrar, un olvido no. */
async function faltasDeFicha(f: FichaReserva, textos: string): Promise<Faltas> {
  const sb = supabaseCharlas();
  const correos = (f.email ?? "").split(/[\/;,\s]+/).filter((e) => e.includes("@"));
  const tel9 = (f.telefono ?? "").replace(/\D/g, "").slice(-9);
  const filtros = [...correos.map((e) => `email.ilike.${e}`), ...(tel9.length === 9 ? [`telefono.ilike.%${tel9}%`] : [])];
  let parq = true;
  if (filtros.length) {
    const { data } = await sb.from("parq_respuestas").select("id").or(filtros.join(",")).limit(1);
    if (data && data.length) parq = false;
  }
  const dato = f.datos?.peso_ayunas;
  const peso = !(dato !== undefined && dato !== null && String(dato).trim() !== "") && !/peso en ayunas[^\n]{0,60}\b(recibido|\d{2,3}[.,]?\d?\s*kg)\b|\b\d{2,3}[.,]\d\s*kg\b/i.test(textos);
  return { parq, peso };
}

async function pasosReservaHojaRuta(opciones: { presupuestoMs: number }): Promise<number> {
  const inicio = Date.now();
  const sb = supabaseCharlas();
  const ahora = new Date();
  const h = hoy();
  const { data: fichas } = await sb.from("crm_fichas").select("id, nombre, estado, email, telefono, canal, proxima_accion, fecha_proxima_accion, mails_enviados, datos, cuerpo_despues").eq("carril", "entrenatzaile").like("estado", "5%");
  let creadas = 0;
  for (const f of (fichas ?? []) as FichaReserva[]) {
    if (Date.now() - inicio > opciones.presupuestoMs) break;
    const reserva = await reservaDeFicha(f);
    const l = reserva ? llamadaDe(reserva.hueco) : null;
    if (!reserva || !l) continue;
    const { data: tareas } = await sb.from("crm_tareas").select("id, tipo, estado, creado_en").eq("ficha_id", f.id).in("tipo", ["hr_preparacion", "hr_confirmacion"]).gte("creado_en", reserva.creado_en);
    const previas = (tareas ?? []) as { id: string; tipo: string; estado: string }[];
    if (previas.some((t) => ABIERTAS.includes(t.estado))) continue;
    const hecha = (tipo: PasoReserva) => previas.some((t) => t.tipo === tipo && ["enviada", "hecha", "descartada"].includes(t.estado));
    const { data: reg } = await sb.from("crm_interacciones").select("texto, canal, fecha").eq("ficha_id", f.id).gte("fecha", reserva.creado_en.slice(0, 10)).order("fecha", { ascending: false }).limit(80);
    const textos = [f.cuerpo_despues ?? "", ...((reg ?? []) as { texto: string | null; canal: string | null }[]).filter((r) => r.canal !== "Recibido").map((r) => r.texto ?? "")].join("\n");
    const enviados = { m2: hecha("hr_preparacion") || pasoEnviadoEnTexto(textos, 2), m3: hecha("hr_confirmacion") || pasoEnviadoEnTexto(textos, 3) };
    const toca = pasoQueToca(l, ahora, enviados);
    if (!toca) continue;
    const tel = telefonoWa(f.telefono) ?? telefonoWa(reserva.telefono);
    const faltas = await faltasDeFicha(f, textos);
    const texto = toca.paso === "hr_preparacion" ? mensajePreparacion(f.nombre, l, faltas) : mensajeConfirmacion(f.nombre, l, faltas, h);
    const vencida = toca.paso === "hr_preparacion" && h >= sumar(l.dia, -1);
    const faltaTxt = [faltas.parq ? "PAR-Q+" : "", faltas.peso ? "peso en ayunas" : ""].filter(Boolean);
    const nota = [`${ETIQUETA_PASO[toca.paso]} · llamada ${l.cuando}`, toca.motivo, faltaTxt.length ? `He puesto la línea de lo que falta (${faltaTxt.join(" y ")}): si ya lo tienes, bórrala.` : "Ya consta PAR-Q+ y peso: sin línea de «me falta»."].join(" · ");
    // La tarjeta genérica «Sin mensaje» de esta ficha ya no sirve: la sustituye el paso.
    await sb.from("crm_tareas").update({ estado: "descartada", motivo: "Sustituida por el paso de la reserva de Hoja de Ruta", resuelto_en: new Date().toISOString(), resuelto_por: "sistema" }).eq("ficha_id", f.id).in("estado", ABIERTAS).eq("tipo", "recordatorio");
    await sb.from("crm_tareas").insert({
      ficha_id: f.id,
      carril: "entrenatzaile",
      tipo: toca.paso,
      canal: tel ? "whatsapp" : "ninguno",
      nivel: "B",
      urgencia: vencida || toca.paso === "hr_confirmacion" ? 2 : 1,
      urgencia_motivo: toca.paso === "hr_confirmacion" ? "Confirmación a 24 h" : vencida ? "Preparación: ya es la víspera" : "Toca preparar la llamada",
      estado: "revisar",
      idioma: "es",
      destinatario: tel,
      borrador_asunto: null,
      borrador_texto: texto,
      cambios_crm: siguienteTrasPaso(toca.paso, l),
      nota_para_alain: tel ? nota : `${nota} · No hay teléfono en la ficha ni en la reserva: copia el texto y mándalo por otra vía.`,
      editado: false,
      contexto: { programada: true, paso_reserva: toca.paso, reserva_id: reserva.id, reserva_hueco: reserva.hueco, estado_ficha: f.estado, resumen: ETIQUETA_PASO[toca.paso], clasificacion: toca.paso, redaccion: "plantilla_guion", instagram: false, fecha_ficha: f.fecha_proxima_accion },
    });
    creadas++;
  }
  return creadas;
}

/** Paso sin mensaje (D9, ventana caducada): se aplica solo y queda en «Últimos cambios» con Deshacer. */
async function aplicarSolo(f: FichaLead, d: DecisionLead) {
  const sb = supabaseCharlas();
  const { data: t } = await sb
    .from("crm_tareas")
    .insert({ ficha_id: f.id, carril: "entrenatzaile", tipo: d.tipo, canal: "ninguno", nivel: "A", urgencia: 1, urgencia_motivo: "Paso automático del flujo", estado: "revisar", cambios_crm: { ...d.cambios, nota: d.nota }, nota_para_alain: d.nota ?? null, contexto: { programada: true, estado_ficha: f.estado, resumen: d.nota } })
    .select("*")
    .single();
  if (!t) throw new Error("no se pudo crear la tarea automática");
  const { aplicarCambios } = await import("./crm-envio");
  const { contextoConDeshacer, tareaPrevia } = await import("./bandeja-deshacer");
  const previa = tareaPrevia(t);
  const huella = await aplicarCambios({ ...t, resuelto_por_sistema: true }, null);
  await sb.from("crm_tareas").update({ estado: "hecha", resuelto_en: new Date().toISOString(), resuelto_por: "sistema", contexto: contextoConDeshacer(t.contexto, { accion: "aplicar", tarea_previa: previa, ...huella }) }).eq("id", t.id);
}

async function crearTareaLead(f: FichaLead, d: DecisionLead): Promise<boolean> {
  const sb = supabaseCharlas();
  const { canal, destinatario, instagram } = canalLead(f);
  if (await tarjetaYaCreada("crm_tareas", "ficha_id", f.id, [d.tipo], null)) return false;
  // Si Alain acaba de descartar una del mismo tipo, no vuelve a salir al pasar el cron (28-11: Cristina, 8 Perdido, volvía a salir
  // tras cada «Descartar» porque la ficha sigue con su fecha vencida). 3 días en general; 7 en Cliente, Perdido y Aparcado.
  const dias = fase(f.estado) >= 7 ? 7 : 3;
  const { data: descartada } = await sb.from("crm_tareas").select("id").eq("ficha_id", f.id).eq("tipo", d.tipo).eq("estado", "descartada").eq("resuelto_por", "alain").gte("resuelto_en", new Date(Date.now() - dias * 86400000).toISOString()).limit(1);
  if (descartada && descartada.length) return false;
  const conMensaje = d.conMensaje && (canal !== "ninguno" || instagram);
  const b = conMensaje ? borradorLead(f, d.tipo, canal) : null;
  const vencida = (f.fecha_proxima_accion ?? hoy()) < hoy();
  const notaCanal = conMensaje && instagram ? "Por Instagram: copia el texto y mándalo desde la app." : d.conMensaje && !conMensaje ? "No hay canal válido (sin email y sin permiso de WhatsApp): decide desde la ficha." : null;
  await sb.from("crm_tareas").insert({
    ficha_id: f.id,
    carril: "entrenatzaile",
    tipo: d.tipo,
    canal: conMensaje ? (instagram ? "ninguno" : canal) : "ninguno",
    nivel: "B",
    urgencia: vencida ? 2 : 1,
    urgencia_motivo: vencida ? "Vencida" : "Toca hoy",
    estado: "revisar",
    idioma: "es",
    destinatario: conMensaje ? destinatario : null,
    borrador_asunto: null,
    borrador_texto: b?.texto ?? null,
    cambios_crm: d.cambios,
    nota_para_alain: [d.nota, b?.nota, notaCanal].filter(Boolean).join(" · ") || null,
    editado: false,
    contexto: { programada: true, estado_ficha: f.estado, resumen: etiquetaLead(d.tipo), clasificacion: d.tipo, redaccion: "plantilla", instagram, fecha_ficha: f.fecha_proxima_accion, ...(!conMensaje ? { motivo_sin_mensaje: d.motivoSinMensaje ?? (d.conMensaje ? "no hay canal válido (sin email y sin permiso de WhatsApp): decide desde la ficha" : motivoSinMensaje(f)) } : {}) },
  });
  return true;
}

export function etiquetaLead(tipo: string): string {
  return ({ check_in: "Check-in", seguimiento: "Seguimiento", recordatorio: "Recordatorio", aparcar: "Aparcar", ha_contestado: "Ha contestado" } as Record<string, string>)[tipo] ?? tipo.replace(/_/g, " ");
}

/** Tarjetas de leads que ya no tocan (la ficha cambió de fecha o de estado desde fuera): se cierran solas. */
export async function cerrarTareasObsoletasLeads(): Promise<number> {
  const sb = supabaseCharlas();
  const h = hoy();
  const { data } = await sb.from("crm_tareas").select("id, contexto, ficha:crm_fichas(estado, fecha_proxima_accion)").eq("carril", "entrenatzaile").eq("estado", "revisar").eq("contexto->>programada", "true");
  let n = 0;
  for (const t of (data ?? []) as unknown as { id: string; contexto: { estado_ficha?: string; restaurada?: boolean; paso_reserva?: string } | null; ficha: { estado: string; fecha_proxima_accion: string | null } | null }[]) {
    if (!t.ficha || t.contexto?.restaurada) continue;
    const cambioEstado = t.contexto?.estado_ficha && t.contexto.estado_ficha !== t.ficha.estado;
    // Los pasos de la reserva (Mensaje 2/3) los marca la fecha de la llamada, no la de la ficha: solo caducan si cambia el estado.
    const yaNoToca = !t.contexto?.paso_reserva && (!t.ficha.fecha_proxima_accion || t.ficha.fecha_proxima_accion > h);
    if (cambioEstado || yaNoToca) {
      await sb.from("crm_tareas").update({ estado: "descartada", motivo: cambioEstado ? `Cerrada sola: la ficha está en «${t.ficha.estado}»` : "Cerrada sola: la ficha ya no tiene esta acción para hoy", resuelto_en: new Date().toISOString(), resuelto_por: "sistema" }).eq("id", t.id);
      n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Correos de leads (paso 8): el lector de alain@ ya los guarda en crm_mensajes con su
// ficha (lib/charlas-correo.ts, índice de fichas). Aquí se procesan sin IA: el Flujo
// dice que si contesta a cualquier correo vuelve a 3 En conversación; sale la tarjeta
// «Te ha escrito» y la pasada de IA le prepara el borrador de respuesta.
// ---------------------------------------------------------------------------
const VUELVE_A_3 = new Set([0, 1, 2, 3, 4, 9]);

export async function procesarPendientesLeads(opciones: { presupuestoMs: number }): Promise<{ procesados: number; errores: string[] }> {
  const inicio = Date.now();
  const sb = supabaseCharlas();
  const res = { procesados: 0, errores: [] as string[] };
  const { data } = await sb.from("crm_mensajes").select("id, ficha_id, de, asunto, fecha, texto, ficha:crm_fichas!inner(carril, estado, datos)").eq("direccion", "entrante").eq("estado", "nuevo").eq("ficha.carril", "entrenatzaile").order("fecha").limit(10);
  for (const m of (data ?? []) as unknown as { id: string; ficha_id: string; de: string | null; asunto: string | null; fecha: string | null; texto: string | null; ficha: { estado: string; datos: Record<string, unknown> | null } }[]) {
    if (Date.now() - inicio > opciones.presupuestoMs) break;
    try {
      const h = hoy();
      const pasaA3 = VUELVE_A_3.has(fase(m.ficha.estado));
      const cambiosFicha: Record<string, unknown> = { fecha_proxima_accion: h, proxima_accion: "Contestar su correo (menos de 24 h)", datos: { ...(m.ficha.datos ?? {}), respondio: "sí" }, actualizado_por: "sistema" };
      if (pasaA3) cambiosFicha.estado = "3 En conversación";
      await sb.from("crm_fichas").update(cambiosFicha).eq("id", m.ficha_id);
      const resumen = `${(m.texto ?? "").replace(/\s+/g, " ").trim().slice(0, 220)}${(m.texto ?? "").length > 220 ? "…" : ""}`;
      await sb.from("crm_interacciones").insert({ ficha_id: m.ficha_id, fecha: (m.fecha ?? new Date().toISOString()).slice(0, 10), canal: "Recibido", texto: `Correo suyo («${m.asunto ?? "sin asunto"}»): ${resumen}${pasaA3 ? " · → 3 En conversación" : ""}`, orden: 500, origen: "sistema", mensaje_id: m.id });
      // Cualquier otra tarjeta abierta (un check-in programado…) ya no toca: ha escrito.
      await sb.from("crm_tareas").update({ estado: "descartada", motivo: "Ha escrito: sustituida por «Te ha escrito»", resuelto_en: new Date().toISOString(), resuelto_por: "sistema" }).eq("ficha_id", m.ficha_id).in("estado", ["revisar", "pendiente"]);
      await sb.from("crm_tareas").insert({
        ficha_id: m.ficha_id,
        carril: "entrenatzaile",
        tipo: "respuesta",
        canal: "mail",
        nivel: "B",
        urgencia: 3,
        urgencia_motivo: "Te ha escrito: contestar en menos de 24 h",
        estado: "revisar",
        idioma: "es",
        mensaje_entrante_id: m.id,
        destinatario: m.de,
        borrador_texto: null,
        cambios_crm: { estado: pasaA3 ? "3 En conversación" : m.ficha.estado, proxima_accion: "Si se enfría 3 días: un mensaje; si sigue sin contestar, 9 Aparcado con check-in a +30", fecha_proxima_accion: sumar(h, 3) },
        nota_para_alain: pasaA3 ? null : `La ficha está en «${m.ficha.estado}»: no se ha movido de estado.`,
        editado: false,
        contexto: { programada: false, estado_ficha: pasaA3 ? "3 En conversación" : m.ficha.estado, resumen: "Te ha escrito", clasificacion: "respuesta", redaccion: "plantilla", fecha_ficha: h },
      });
      await sb.from("crm_mensajes").update({ estado: "procesado", resumen }).eq("id", m.id);
      res.procesados++;
    } catch (e) {
      res.errores.push(`${m.asunto ?? m.id}: ${(e as Error).message}`);
    }
  }
  return res;
}

/**
 * Pasada de IA (paso 6): las tarjetas que salieron con plantilla y que Alain no ha tocado
 * se reescriben con el protocolo y el contexto de la ficha. Solo empieza una llamada si
 * queda margen (cada una tarda unos segundos). Interruptor: charlas_config.leads_ia (por defecto sí).
 */
export async function mejorarBorradoresLeads(opciones: { presupuestoMs: number; limite?: number }): Promise<{ redactadas: number; errores: string[] }> {
  const inicio = Date.now();
  const sb = supabaseCharlas();
  const res = { redactadas: 0, errores: [] as string[] };
  const { data: cfg } = await sb.from("charlas_config").select("valor").eq("clave", "leads_ia").maybeSingle();
  if (cfg?.valor === false) return res;
  const { data } = await sb.from("crm_tareas").select("id, tipo, contexto").eq("carril", "entrenatzaile").eq("estado", "revisar").eq("editado", false).eq("contexto->>redaccion", "plantilla").in("tipo", ["check_in", "seguimiento", "respuesta"]).order("urgencia", { ascending: false }).order("creado_en").limit(opciones.limite ?? 6);
  const { redactarTareaLead } = await import("./leads-ia");
  for (const t of data ?? []) {
    if (opciones.presupuestoMs - (Date.now() - inicio) < 20000) break;
    try {
      await redactarTareaLead(t.id);
      res.redactadas++;
    } catch (e) {
      res.errores.push((e as Error).message);
      // Si falla, la tarjeta se queda con la plantilla (sigue sirviendo) y no se reintenta en bucle.
      await sb.from("crm_tareas").update({ contexto: { ...(t.contexto ?? {}), redaccion: "plantilla_fallo_ia" } }).eq("id", t.id);
    }
  }
  return res;
}
