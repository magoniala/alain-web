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
//   7 Ganado / 8 Perdido          → nada

import { supabaseCharlas, faseDeEstado, puntuarUrgencia } from "./charlas";
import { procesarConIA } from "./charlas-ia";

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
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
        instrucciones: "Redacta el Cierre del guion Mail 4 (las tres opciones), como respuesta al hilo del dossier. Sin dossier.",
        cambios: { proxima_accion: "Aparcar si no hay respuesta (cierre enviado)", fecha_proxima_accion: sumar(h, 7) },
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
    return {
      tipo: "reactivacion",
      nivel: "A",
      conCorreo: true,
      instrucciones: "Ha llegado la fecha de reactivación que dio el centro. Redacta el Mail 1 C (reactivación) del guion Mail 1 Calendario, como respuesta al hilo del otoño, con el dossier adjunto. Menciona el mes en que quedasteis (está en el Registro).",
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

export async function tareasPorFecha(opciones: { presupuestoMs: number; limite?: number }): Promise<ResumenMotor> {
  const inicio = Date.now();
  const supabase = supabaseCharlas();
  const res: ResumenMotor = { revisados: 0, creadas: 0, ya_abiertas: 0, errores: [], pendientes_restantes: 0 };
  const limite = opciones.limite ?? 8;

  const { data: centros } = await supabase
    .from("charlas_centros")
    .select("id, nombre, estado, euskera, responsable, responsable_email, email_centro, proxima_accion, fecha_proxima_accion, bloqueado_por, nivel_autonomia, mails_enviados")
    .lte("fecha_proxima_accion", hoy())
    .not("estado", "like", "7%")
    .not("estado", "like", "8%")
    .order("fecha_proxima_accion");

  const { data: abiertas } = await supabase.from("charlas_tareas").select("centro_id").in("estado", ["revisar", "pendiente", "aprobada"]);
  const conTarea = new Set((abiertas ?? []).map((t) => t.centro_id as string));

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
    const d = decidir(c);
    if (!d) continue;
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
  const destinatario = (c.responsable_email ?? c.email_centro ?? "").split(/[\/;,\s]+/).find((e) => e.includes("@")) ?? null;

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
      reactivacion: "Reactivación",
      seguimiento_conversacion: "Seguimiento de conversación",
      llamada_alain: "Llamada",
      revisar_bloqueo: "Revisar bloqueo",
    } as Record<string, string>
  )[tipo] ?? tipo;
}
