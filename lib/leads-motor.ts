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
  return { tipo: "recordatorio", conMensaje: false, cambios: { fecha_proxima_accion: sumar(h, 3) }, nota: pa ? `La ficha dice: «${pa}»` : "La ficha no dice qué toca: decide desde aquí (aplazar, cambiar estado o descartar)." };
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
    contexto: { programada: true, estado_ficha: f.estado, resumen: etiquetaLead(d.tipo), clasificacion: d.tipo, redaccion: "plantilla", instagram, fecha_ficha: f.fecha_proxima_accion },
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
  for (const t of (data ?? []) as unknown as { id: string; contexto: { estado_ficha?: string; restaurada?: boolean } | null; ficha: { estado: string; fecha_proxima_accion: string | null } | null }[]) {
    if (!t.ficha || t.contexto?.restaurada) continue;
    const cambioEstado = t.contexto?.estado_ficha && t.contexto.estado_ficha !== t.ficha.estado;
    const yaNoToca = !t.ficha.fecha_proxima_accion || t.ficha.fecha_proxima_accion > h;
    if (cambioEstado || yaNoToca) {
      await sb.from("crm_tareas").update({ estado: "descartada", motivo: cambioEstado ? `Cerrada sola: la ficha está en «${t.ficha.estado}»` : "Cerrada sola: la ficha ya no tiene esta acción para hoy", resuelto_en: new Date().toISOString(), resuelto_por: "sistema" }).eq("id", t.id);
      n++;
    }
  }
  return n;
}
