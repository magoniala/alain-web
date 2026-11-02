// Motor de decisión del carril charlas: lo que toca por fecha, sin que
// llegue ningún correo. Es el Flujo (Guiones/00 Flujo charlas) escrito como
// reglas. Cada día, para cada centro activo con fecha_proxima_accion ≤ hoy,
// decide qué acción toca y crea la tarea en la bandeja con su borrador.
//
// Fase 1: todas las tareas quedan en 'revisar'. En fase 2, las de nivel A
// (recordatorios, cierres, acuses, reactivaciones) saldrán solas.
//
// Qué toca según el estado (resumen del Flujo):
//   3 Mail inicial enviado        → recordatorio_1 (Mail 3 R1)  → 3.5, +7 días
//   3.5 recordatorio 1 enviado    → recordatorio_2 (Mail 3 R2)  → sigue en 3.5, "Aparcar si no responde", +7
//   3.5 + "Aparcar…"              → aparcar (sin correo)        → 9 Aparcado, reactivar en enero
//   4 Ha respondido               → dossier (Mail 2)            → 5, +7
//   5 Dossier enviado             → seguimiento_dossier (Mail 4 seguimiento) → sigue en 5, "Mail de cierre…", +7
//   5 + "Mail de cierre…"         → mail_cierre (Mail 4 cierre)  → sigue en 5, "Aparcar…", +7
//   5 + "Aparcar…"                → aparcar                      → 9, reactivar trimestre siguiente
//   9 Aparcado                    → reactivacion (Mail 1 C)      → 3, +7
//   3.9 reenviado - pendiente     → llamada_alain (nivel C, sin correo)
//   6 en conversación             → seguimiento_conversacion (nivel C)
//   bloqueado_por                 → revisar_bloqueo (nivel C, sin correo): +30 días
//   0/1/2                         → llamada_alain (nivel C)
//   1 + 3 intentos + email_centro → mail_b (Mail 1 B al buzón, nivel B)  → 3, +7
//   4 sin nombre de responsable   → llamada_alain (regla de noviembre: sin nombre no hay dossier)
//   7 Ganado / 8 Perdido          → nada
//   Fase 3 · territorios en `mail1_automatico_territorios` (config): estado 0 → mail_1 (A si hay correo
//   directo, B al buzón si no), `mail1_por_dia` al día, sin llamada previa. Ver mail1Automatico().

import { supabaseCharlas, faseDeEstado, puntuarUrgencia } from "./charlas";
import { procesarConIA } from "./charlas-ia";

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
/** Medianoche de hoy en Madrid, en ISO con su desfase (+01:00 en invierno, +02:00 en verano). */
const inicioDiaMadrid = () => {
  const parte = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", timeZoneName: "shortOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const h = Number(/([+-]\d+)/.exec(parte)?.[1] ?? 1);
  return `${hoy()}T00:00:00${h >= 0 ? "+" : "-"}${String(Math.abs(h)).padStart(2, "0")}:00`;
};
const sumar = (iso: string, dias: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

/** Reactivación por defecto cuando se aparca sin fecha del centro: enero o mayo, lo que venga antes. */
function proximaReactivacion(): string {
  const h = hoy();
  const y = Number(h.slice(0, 4));
  const ene = `${y + (h >= `${y}-01-11` ? 1 : 0)}-01-11`;
  const may = `${y}-05-04`;
  return h < may && h >= `${y}-01-11` ? may : ene;
}

interface Centro {
  id: string;
  nombre: string;
  estado: string;
  euskera: string | null;
  responsable: string | null;
  responsable_email: string | null;
  email_centro: string | null;
  proxima_accion: string | null;
  fecha_proxima_accion: string | null;
  bloqueado_por: string | null;
  nivel_autonomia: "A" | "B" | "C";
  mails_enviados: number;
  intentos_llamada: number;
  via?: string | null;
  otros_formatos?: string | null;
}

interface Decision {
  tipo: string;
  nivel: "A" | "B" | "C";
  conCorreo: boolean;
  instrucciones: string;
  cambios: Record<string, unknown>;
  nota?: string;
}

export function decidir(c: Centro): Decision | null {
  const f = faseDeEstado(c.estado);
  const pa = (c.proxima_accion ?? "").toLowerCase();
  const h = hoy();

  if (f === 7 || f === 8) return null;

  if (c.bloqueado_por) {
    return {
      tipo: "revisar_bloqueo",
      nivel: "C",
      conCorreo: false,
      instrucciones: "",
      cambios: { fecha_proxima_accion: sumar(h, 30), proxima_accion: c.proxima_accion ?? `Revisar bloqueo (${c.bloqueado_por})` },
      nota: `Bloqueado por "${c.bloqueado_por}": el disparador es el evento, no la fecha. Si sigue igual, +30 días; si el evento ha ocurrido, escribe tú.`,
    };
  }

  // 1 Llamando con 3 intentos: el Flujo dice Mail B al buzón del centro, con
  // el dossier adjunto desde el primer envío (el objetivo es que lo reenvíen).
  if (f === 1 && c.intentos_llamada >= 3 && c.email_centro) {
    return {
      tipo: "mail_b",
      nivel: "B",
      conCorreo: true,
      instrucciones: "Tres llamadas sin conseguir el contacto. Redacta el Mail 1 B (al buzón del centro, 'a la atención de la persona responsable de actividades') del guion Mail 1 genérico, con el dossier adjunto. Lleva presentación y firma completa (es un primer contacto).",
      cambios: { estado: "3 Mail inicial enviado", via: "generico", proxima_accion: "Recordatorio 1 genérico si no contesta", fecha_proxima_accion: sumar(h, 7) },
    };
  }

  if (f <= 2) {
    return { tipo: "llamada_alain", nivel: "C", conCorreo: false, instrucciones: "", cambios: {}, nota: "Toca llamada a conserjería (guion Llamada conserjería). El sistema no llama." };
  }

  if (c.estado.startsWith("3.9")) {
    return { tipo: "llamada_alain", nivel: "C", conCorreo: false, instrucciones: "", cambios: {}, nota: "Secretaría reenvió el correo hace 7 días: toca la llamada a orientación (guion Llamada tras reenvío). El sistema no llama." };
  }

  if (c.estado.startsWith("3.5")) {
    if (pa.includes("aparcar")) {
      const fecha = proximaReactivacion();
      return { tipo: "aparcar", nivel: "A", conCorreo: false, instrucciones: "", cambios: { estado: "9 Aparcado (con fecha de reactivación)", fecha_proxima_accion: fecha, proxima_accion: "Reactivar (Mail 1 C)" }, nota: "Dos recordatorios sin respuesta: se aparca sin más correos, como dice el Flujo." };
    }
    return {
      tipo: "recordatorio_2",
      nivel: "A",
      conCorreo: true,
      instrucciones: "Redacta el Recordatorio 2 (el último) del guion Mail 3, como respuesta al hilo. Sin dossier.",
      cambios: { proxima_accion: "Aparcar si no hay respuesta (R2 enviado)", fecha_proxima_accion: sumar(h, 7) },
    };
  }

  if (f === 3) {
    return {
      tipo: "recordatorio_1",
      nivel: "A",
      conCorreo: true,
      instrucciones: "Redacta el Recordatorio 1 del guion Mail 3, como respuesta al hilo del Mail 1. Sin dossier.",
      cambios: { estado: "3.5 recordatorio 1 enviado", proxima_accion: "Recordatorio 2 si no hay respuesta", fecha_proxima_accion: sumar(h, 7) },
    };
  }

  // "Esperar X" en la próxima acción: no es un paso del Flujo, es una espera
  // concreta que puso Alain. Se le devuelve como aviso y la IA propone solo si procede.
  if (pa.startsWith("esperar") || pa.startsWith("espera ")) {
    return {
      tipo: "seguimiento_conversacion",
      nivel: "C",
      conCorreo: true,
      instrucciones: `La ficha dice: "${c.proxima_accion}". Ha llegado la fecha. Si procede un recordatorio suave de eso, redáctalo corto; si no procede escribir (p. ej. están decidiendo y no hay que meter prisa), responder = false y propón solo mover la fecha.`,
      cambios: { fecha_proxima_accion: sumar(h, 7) },
      nota: `Estabas esperando: ${c.proxima_accion}`,
    };
  }

  if (f === 4) {
    // Plan de noviembre: sin nombre del responsable no se manda dossier; se vuelve a llamar.
    if (!c.responsable) {
      return {
        tipo: "llamada_alain",
        nivel: "C",
        conCorreo: false,
        instrucciones: "",
        cambios: {},
        nota: "Han respondido pero la ficha no tiene nombre del responsable: según tu regla de noviembre, llamada para conseguirlo antes de mandar el dossier.",
      };
    }
    return {
      tipo: "dossier",
      nivel: "B",
      conCorreo: true,
      instrucciones: "Han respondido y aún no tienen el dossier: redacta el Mail 2 (A si el calendario está abierto, B si está cerrado; mira el Registro y el hilo) y adjunta el dossier.",
      cambios: { estado: "5 Dossier enviado", proxima_accion: "Seguimiento del dossier si no contesta", fecha_proxima_accion: sumar(h, 7) },
    };
  }

  if (f === 5) {
    if (pa.includes("aparcar")) {
      const fecha = proximaReactivacion();
      return { tipo: "aparcar", nivel: "A", conCorreo: false, instrucciones: "", cambios: { estado: "9 Aparcado (con fecha de reactivación)", fecha_proxima_accion: fecha, proxima_accion: "Reactivar (Mail 1 C)" }, nota: "Sin respuesta al cierre: se aparca para el trimestre siguiente, sin más correos." };
    }
    if (pa.includes("cierre")) {
      return {
        tipo: "mail_cierre",
        nivel: "A",
        conCorreo: true,
        instrucciones: "Redacta el Cierre del guion Mail 4 como respuesta al hilo del dossier, sin dossier. Las tres opciones del guion se mantienen, y la opción 2 ('este curso no, quizá el que viene') se amplía con la puerta a otro formato cuando la charla no cabe este curso: show para una celebración del centro, semana cultural o fin de curso (sin precios ni catálogo; solo abrir la puerta, según la REGLA FIJA de Objeciones). Si la ficha tiene `otros_formatos` con algo ya ofrecido, no lo repitas.",
        cambios: { proxima_accion: "Aparcar si no hay respuesta (cierre enviado)", fecha_proxima_accion: sumar(h, 7), otros_formatos: "puerta abierta a show (celebración / semana cultural / fin de curso) en el Mail de cierre" },
      };
    }
    return {
      tipo: "seguimiento_dossier",
      nivel: "A",
      conCorreo: true,
      instrucciones: "Redacta el Seguimiento a los 7 días del guion Mail 4, como respuesta al hilo del dossier. Sin dossier.",
      cambios: { proxima_accion: "Mail de cierre si no hay respuesta", fecha_proxima_accion: sumar(h, 7) },
    };
  }

  if (f === 6) {
    return {
      tipo: "seguimiento_conversacion",
      nivel: "C",
      conCorreo: true,
      instrucciones: "Están en conversación y se ha enfriado. Redacta un seguimiento corto y concreto según lo último que se habló (fechas, formato o precio). Alain decide si lo manda.",
      cambios: { fecha_proxima_accion: sumar(h, 7) },
    };
  }

  if (f === 9) {
    if (!c.responsable_email && c.email_centro) {
      return {
        tipo: "reactivacion",
        nivel: "B",
        conCorreo: true,
        instrucciones: "Ha llegado la fecha de reactivación, pero no hay correo directo del responsable: va al buzón del centro. Redacta el Mail 1 B (al buzón, 'a la atención de la persona responsable de actividades') del guion Mail 1 genérico, con el dossier, mencionando que ya hubo contacto en otoño y el mes en que quedasteis (está en el Registro). Presentación y firma completas.",
        cambios: { estado: "3 Mail inicial enviado", proxima_accion: "Recordatorio 1 genérico si no contesta", fecha_proxima_accion: sumar(h, 7) },
        nota: "Sin nombre del responsable: según tu regla, mejor llamar para conseguirlo. Si no, este correo va al buzón.",
      };
    }
    return {
      tipo: "reactivacion",
      nivel: "A",
      conCorreo: true,
      instrucciones: "Ha llegado la fecha de reactivación que dio el centro. Redacta el Mail 1 C (reactivación) del guion Mail 1 Calendario, como respuesta al hilo del otoño, con el dossier adjunto. Menciona el mes en que quedasteis (está en el Registro). Es un hilo ya abierto: sin presentación ni firma.",
      cambios: { estado: "3 Mail inicial enviado", proxima_accion: "Recordatorio 1 si no hay respuesta", fecha_proxima_accion: sumar(h, 7) },
    };
  }

  return null;
}

export interface ResumenMotor {
  revisados: number;
  creadas: number;
  ya_abiertas: number;
  errores: string[];
  pendientes_restantes: number;
}

// ------------------------------------------------------------------
// Mail 1 sin llamada previa (fase 3, por territorio).
//
// En Euskadi el Flujo empieza por la llamada a conserjería para conseguir
// el nombre del responsable. Para las tiradas de Navarra y Cantabria, donde
// Alain no va a llamar uno a uno, el Mail 1 puede salir directamente a
// `mail1_por_dia` centros al día en los territorios de
// `mail1_automatico_territorios` (vacío por defecto: no hace nada hasta que
// Alain lo active en charlas_config). Si la ficha ya trae correo directo
// del responsable (del directorio o del rastreo web), va a esa persona
// (Mail 1 A); si no, al buzón del centro (Mail 1 B). Las tareas quedan en
// 'revisar' como todas: Alain las ve salir en la bandeja.
// ------------------------------------------------------------------

export interface ResumenMail1 {
  activo: boolean;
  territorios: string[];
  cupo_dia: number;
  hoy_ya: number;
  creadas: number;
  candidatos: number;
  errores: string[];
}

export async function mail1Automatico(opciones: { presupuestoMs: number }): Promise<ResumenMail1> {
  const inicio = Date.now();
  const supabase = supabaseCharlas();
  const { data: cfgs } = await supabase.from("charlas_config").select("clave, valor").in("clave", ["mail1_automatico_territorios", "mail1_por_dia"]);
  const cfg = Object.fromEntries((cfgs ?? []).map((c) => [c.clave, c.valor]));
  const territorios = (Array.isArray(cfg.mail1_automatico_territorios) ? cfg.mail1_automatico_territorios : []) as string[];
  const cupo = Number(cfg.mail1_por_dia ?? 15);
  const res: ResumenMail1 = { activo: territorios.length > 0, territorios, cupo_dia: cupo, hoy_ya: 0, creadas: 0, candidatos: 0, errores: [] };
  if (!res.activo) return res;

  const { count } = await supabase.from("charlas_tareas").select("id", { count: "exact", head: true }).eq("tipo", "mail_1").gte("creado_en", inicioDiaMadrid());
  res.hoy_ya = count ?? 0;
  const restantes = Math.max(0, cupo - res.hoy_ya);
  if (!restantes) return res;

  const { data: centros } = await supabase
    .from("charlas_centros")
    .select("id, nombre, estado, euskera, responsable, responsable_email, email_centro, proxima_accion, fecha_proxima_accion, bloqueado_por, nivel_autonomia, mails_enviados, intentos_llamada, via, otros_formatos, prioridad, localidad")
    .in("territorio", territorios)
    .like("estado", "0%")
    .is("bloqueado_por", null)
    .order("prioridad", { ascending: true, nullsFirst: false })
    .order("localidad")
    .limit(200);
  const { data: abiertas } = await supabase.from("charlas_tareas").select("centro_id").in("estado", ["revisar", "pendiente", "aprobada"]);
  const conTarea = new Set((abiertas ?? []).map((t) => t.centro_id as string));
  const cola = ((centros ?? []) as (Centro & { prioridad?: string | null })[]).filter((c) => !conTarea.has(c.id) && (c.responsable_email || c.email_centro));
  res.candidatos = cola.length;

  for (const c of cola.slice(0, restantes)) {
    if (Date.now() - inicio > opciones.presupuestoMs) break;
    const directo = !!c.responsable_email;
    const d: Decision = {
      tipo: "mail_1",
      nivel: "B",
      conCorreo: true,
      instrucciones: directo
        ? `Primer contacto sin llamada previa. Redacta el Mail 1 A del guion Mail 1 (a ${c.responsable ? c.responsable : "la persona de orientación/jefatura cuyo correo tenemos"}), con el dossier adjunto. Presentación y firma completas: es el primer correo del hilo.`
        : "Primer contacto sin llamada previa y sin nombre: redacta el Mail 1 B (al buzón del centro, 'a la atención de la persona responsable de actividades / orientación') del guion Mail 1 genérico, con el dossier adjunto. Presentación y firma completas.",
      cambios: { estado: "3 Mail inicial enviado", via: directo ? "directo" : "generico", proxima_accion: directo ? "Recordatorio 1 si no hay respuesta" : "Recordatorio 1 genérico si no contesta", fecha_proxima_accion: sumar(hoy(), 7) },
      nota: directo ? undefined : "Mail 1 al buzón general: si prefieres conseguir antes el nombre, descarta esta tarea y pon el centro en '1 Llamando'.",
    };
    try {
      await crearTarea(c, d);
      res.creadas++;
    } catch (e) {
      res.errores.push(`${c.nombre}: ${(e as Error).message}`);
    }
  }
  return res;
}

export async function tareasPorFecha(opciones: { presupuestoMs: number; limite?: number }): Promise<ResumenMotor> {
  const inicio = Date.now();
  const supabase = supabaseCharlas();
  const res: ResumenMotor = { revisados: 0, creadas: 0, ya_abiertas: 0, errores: [], pendientes_restantes: 0 };
  const limite = opciones.limite ?? 8;

  const { data: centros } = await supabase
    .from("charlas_centros")
    .select("id, nombre, estado, euskera, responsable, responsable_email, email_centro, proxima_accion, fecha_proxima_accion, bloqueado_por, nivel_autonomia, mails_enviados, intentos_llamada, via, otros_formatos")
    .lte("fecha_proxima_accion", hoy())
    .not("estado", "like", "7%")
    .not("estado", "like", "8%")
    .order("fecha_proxima_accion");

  const { data: abiertas } = await supabase.from("charlas_tareas").select("centro_id").in("estado", ["revisar", "pendiente", "aprobada"]);
  const conTarea = new Set((abiertas ?? []).map((t) => t.centro_id as string));

  // Centros donde lo último que ha pasado es que han escrito ellos (en las
  // últimas 3 semanas) y Alain no ha contestado: el paso programado no toca;
  // ese correo ya tiene su tarjeta o está a la espera de ser procesado.
  const hace21 = new Date(Date.now() - 21 * 86400000).toISOString();
  const { data: recientes } = await supabase
    .from("charlas_mensajes")
    .select("centro_id, direccion, fecha")
    .gte("fecha", hace21)
    .not("centro_id", "is", null)
    .order("fecha", { ascending: true });
  const ultimoPorCentro = new Map<string, { direccion: string; fecha: string }>();
  for (const m of recientes ?? []) ultimoPorCentro.set(m.centro_id as string, { direccion: m.direccion as string, fecha: String(m.fecha).slice(0, 10) });

  const cola = (centros ?? []).filter((c) => {
    if (conTarea.has(c.id)) {
      res.ya_abiertas++;
      return false;
    }
    return true;
  });

  let i = 0;
  for (; i < cola.length && res.creadas + res.errores.length < limite; i++) {
    if (Date.now() - inicio > opciones.presupuestoMs) break;
    const c = cola[i] as Centro;
    res.revisados++;
    let d = decidir(c);
    if (!d) continue;
    // Lo último que hay con este centro es un correo suyo sin contestar: el
    // paso programado no toca; se le pide a Alain que decida sobre ese correo.
    const ult = ultimoPorCentro.get(c.id);
    if (ult?.direccion === "entrante") {
      d = {
        tipo: "revisar_correo",
        nivel: "C",
        conCorreo: false,
        instrucciones: "",
        cambios: { fecha_proxima_accion: sumar(hoy(), 7) },
        nota: `Tocaba "${etiqueta(d.tipo).toLowerCase()}", pero lo último es un correo suyo del ${ult.fecha.split("-").reverse().join("-")} sin respuesta tuya. Decide: si hay que contestar, abre la ficha y escribe desde Mail o pide un borrador con Rehacer; si no, cierra el estado o mueve la fecha. Al aplicar, la fecha pasa a +7 días.`,
      };
    }
    try {
      await crearTarea(c, d);
      res.creadas++;
    } catch (e) {
      res.errores.push(`${c.nombre}: ${(e as Error).message}`);
    }
  }
  res.pendientes_restantes = cola.length - i;
  return res;
}

async function crearTarea(c: Centro, d: Decision) {
  const supabase = supabaseCharlas();
  const idioma: "es" | "eu" = c.euskera === "sí" || c.euskera === "parcial" ? "eu" : "es";
  const alBuzon = d.tipo === "mail_b" || (d.tipo === "reactivacion" && !c.responsable_email);
  const destinatario = ((alBuzon ? c.email_centro : c.responsable_email ?? c.email_centro) ?? "").split(/[\/;,\s]+/).find((e) => e.includes("@")) ?? null;

  const nivelFinal = c.nivel_autonomia === "C" ? "C" : d.nivel;
  const { urgencia, motivo: urgenciaMotivo } = puntuarUrgencia({ tipo: d.tipo, nivel: nivelFinal, estadoCentro: c.estado });
  const base = {
    centro_id: c.id,
    tipo: d.tipo,
    nivel: nivelFinal,
    urgencia,
    urgencia_motivo: urgenciaMotivo,
    estado: "revisar",
    idioma,
    mensaje_entrante_id: null,
    cambios_crm: d.cambios,
    destinatario,
    nota_para_alain: d.nota ?? null,
    editado: false,
  };

  if (!d.conCorreo) {
    await supabase.from("charlas_tareas").insert({ ...base, contexto: { programada: true, resumen: etiqueta(d.tipo), clasificacion: d.tipo } });
    return;
  }
  if (!destinatario) {
    await supabase.from("charlas_tareas").insert({
      ...base,
      tipo: "llamada_alain",
      nivel: "C",
      contexto: { programada: true, resumen: `${etiqueta(d.tipo)} · sin correo del responsable` },
      nota_para_alain: `Tocaba ${etiqueta(d.tipo).toLowerCase()} pero la ficha no tiene correo. Consíguelo o escribe al buzón del centro.`,
    });
    return;
  }

  const [{ data: ficha }, { data: registro }, { data: hilo }] = await Promise.all([
    supabase.from("charlas_centros").select("*").eq("id", c.id).single(),
    supabase.from("charlas_interacciones").select("fecha, canal, texto").eq("centro_id", c.id).order("fecha", { ascending: true, nullsFirst: true }).order("orden"),
    supabase.from("charlas_mensajes").select("direccion, fecha, de, asunto, texto").eq("centro_id", c.id).order("fecha", { ascending: false }).limit(6),
  ]);
  const { secciones_extra, creado_en, actualizado_en, actualizado_por, id, ...limpia } = ficha ?? {};
  void secciones_extra; void creado_en; void actualizado_en; void actualizado_por; void id;

  const r = await procesarConIA({
    centro: limpia,
    registro: (registro ?? []).slice(-40),
    hilo: (hilo ?? []).reverse(),
    programada: { tipo: d.tipo, instrucciones: d.instrucciones, destinatario },
  });

  await supabase.from("charlas_tareas").insert({
    ...base,
    contexto: {
      programada: true,
      clasificacion: d.tipo,
      resumen: r.resumen || etiqueta(d.tipo),
      confianza: r.confianza,
      etiqueta_principal: r.alternativa?.etiqueta_principal ?? null,
      alternativa: r.alternativa ? { etiqueta: r.alternativa.etiqueta, asunto: r.alternativa.asunto, cuerpo: r.alternativa.cuerpo, adjuntar_dossier: !!r.alternativa.adjuntar_dossier } : null,
    },
    borrador_asunto: r.respuesta?.asunto ?? null,
    borrador_texto: r.respuesta?.cuerpo ?? null,
    adjuntar_dossier: r.respuesta?.adjuntar_dossier ?? (d.tipo === "reactivacion" || d.tipo === "dossier"),
    // Los cambios de CRM los fija el Flujo, no la IA: así las fechas y estados son siempre los mismos.
    cambios_crm: d.cambios,
    nota_para_alain: [d.nota, r.nota_para_alain].filter(Boolean).join(" · ") || null,
  });
}

export function etiqueta(tipo: string): string {
  return (
    {
      recordatorio_1: "Recordatorio 1",
      recordatorio_2: "Recordatorio 2 (último)",
      aparcar: "Aparcar (sin respuesta)",
      dossier: "Enviar dossier",
      seguimiento_dossier: "Seguimiento del dossier",
      mail_cierre: "Mail de cierre",
      mail_b: "Mail al buzón del centro",
      mail_1: "Mail 1 (primer contacto)",
      reactivacion: "Reactivación",
      seguimiento_conversacion: "Seguimiento de conversación",
      llamada_alain: "Llamada",
      revisar_bloqueo: "Revisar bloqueo",
      revisar_correo: "Correo suyo sin respuesta",
    } as Record<string, string>
  )[tipo] ?? tipo;
}
