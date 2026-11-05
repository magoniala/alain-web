// Motor del carril de MAGIA: lo que toca por fecha en el CRM de prospectos
// (Guía comercial + flujos de Antiguos, Recuperar e Intermediarios escritos
// como reglas), más el tratamiento de los correos que llegan de esas fichas.
//
// Fase 6a: todas las tareas quedan en 'revisar'. WhatsApp no se envía desde
// el servidor: la tarjeta lleva un enlace wa.me con el texto preparado y Alain
// lo manda desde su móvil con un toque; al pulsar "Enviado" se aplican los
// cambios en la ficha. El correo sí sale por SMTP, como en charlas.
//
// Resumen de reglas:
//   antiguo   0/9 → reactivación (A WhatsApp · B mail · C particular pide recomendación) → 3, R1 a +4 laborables
//             3 + "Recordatorio 1" → R1 → "Recordatorio 2" a +7 · 3 + "Recordatorio 2" → R2 (último) → 9, 2 meses antes de su temporada
//             particular (variante C) → 9 Aparcado directo, no se persigue
//   recuperar 9 → mensaje de recuperación → 3, recordatorio único a +5 laborables → 9 a +12 meses (dos intentos en años distintos → 8 Perdido)
//   intermediario 9 → check-in → 9 a +6 meses
//   agencia   0 → mail 1-B (pide a quién escribir; sin responsable) o 1-A (pregunta por el formato; con responsable), texto fijo → 3, recordatorio único a +4 laborables
//             3 → recordatorio único (texto fijo) → 9, check-in a +6 meses · nunca se llama hasta tener contacto con nombre (regla de Alain, 5-11-2026)
//   4 Ha respondido → propuesta (Alain, con borrador) · 5/6 → seguimiento de propuesta (+3 laborables) / cierre suave · "Esperar…" → aviso
//   7 Ganado con fecha → recordatorio para Alain (cobro, confirmación, post-evento)

import { supabaseCharlas } from "./charlas";
import { procesarMagiaConIA, type ResultadoMagia } from "./crm-ia";

export const ESTADOS_MAGIA = [
  "0 Por contactar",
  "1 Intentando",
  "2 Contacto conseguido",
  "3 Primer mensaje enviado",
  "4 Ha respondido",
  "5 Propuesta enviada",
  "6 En conversación",
  "7 Ganado",
  "8 Perdido",
  "9 Aparcado",
] as const;

export function faseMagia(estado: string | null | undefined): number {
  const m = /^(\d+)/.exec(estado ?? "");
  return m ? Number(m[1]) : -1;
}

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
const sumar = (iso: string, dias: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const laborables = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  let k = n;
  while (k > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) k--;
  }
  return d.toISOString().slice(0, 10);
};
const sumarMeses = (iso: string, meses: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + meses);
  return d.toISOString().slice(0, 10);
};

/** Dos meses antes de la temporada del cliente (mes_temporada o el mes del último evento), nunca antes de 60 días. */
export function antesDeTemporada(f: Ficha): string {
  const h = hoy();
  const mes = f.mes_temporada ?? (f.fecha_ultimo_evento ? Number(f.fecha_ultimo_evento.slice(5, 7)) : null);
  if (!mes) return sumar(h, 182);
  const m = ((mes - 3 + 12) % 12) + 1;
  let y = Number(h.slice(0, 4));
  let fecha = `${y}-${String(m).padStart(2, "0")}-01`;
  while (fecha <= sumar(h, 60)) {
    y++;
    fecha = `${y}-${String(m).padStart(2, "0")}-01`;
  }
  return fecha;
}

export interface Ficha {
  id: string;
  nombre: string;
  segmento: string | null;
  tipo_entidad: string | null;
  estado: string;
  canal: string | null;
  idioma: string | null;
  email: string | null;
  telefono: string | null;
  responsable: string | null;
  responsable_email: string | null;
  responsable_tel: string | null;
  ultimo_evento: string | null;
  fecha_ultimo_evento: string | null;
  mes_temporada: number | null;
  proxima_accion: string | null;
  fecha_proxima_accion: string | null;
  bloqueado_por: string | null;
  nivel_autonomia: "A" | "B" | "C";
  localidad?: string | null;
}

export type Canal = "mail" | "whatsapp" | "llamada" | "ninguno";

export function telefonoWa(t: string | null | undefined): string | null {
  const d = (t ?? "").split(/[\/;,]/)[0].replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 9) return `34${d}`;
  if (d.startsWith("0034")) return d.slice(2);
  return d;
}

/** Canal por el que se escribe a esta ficha, y a quién. */
export function canalDe(f: Ficha): { canal: Canal; destinatario: string | null } {
  const mail = (f.responsable_email ?? f.email ?? "").split(/[\/;,\s]+/).find((e) => e.includes("@")) ?? null;
  const tel = telefonoWa(f.responsable_tel ?? f.telefono);
  const pref = (f.canal ?? "").toLowerCase();
  if (/whats/.test(pref) && tel) return { canal: "whatsapp", destinatario: tel };
  if (/mail/.test(pref) && mail) return { canal: "mail", destinatario: mail };
  if (mail) return { canal: "mail", destinatario: mail };
  if (tel) return { canal: "whatsapp", destinatario: tel };
  return { canal: "llamada", destinatario: null };
}

interface Decision {
  tipo: string;
  nivel: "A" | "B" | "C";
  conMensaje: boolean;
  instrucciones: string;
  cambios: Record<string, unknown>;
  nota?: string;
  /** Texto fijo (sin IA): se usa tal cual cuando el canal es correo. */
  borrador?: { asunto: string | null; cuerpo: string };
}


// ── Agencias de eventos (guion: vault, Vías/Agencias/Guion — primer mail a agencias) ──
const FIRMA_AGENCIA = "Alain Zulaika · Niala\n688 821 488 · contacto@alainzulaika.com · alainzulaika.com";
const PRESENTACION_AGENCIA = "Soy Alain Zulaika, mago profesional de Elgoibar (Niala). Llevo 12 años actuando, con más de 200 eventos en empresas, ferias, congresos y celebraciones familiares.";

/** Primer nombre de "Nombre Apellido (cargo…)"; null si no hay responsable. */
function primerNombre(r: string | null | undefined): string | null {
  const n = (r ?? "").replace(/\(.*?\)/g, "").trim().split(/\s+/)[0];
  return n ? n : null;
}

function mailAgencia1B(): { asunto: string; cuerpo: string } {
  return {
    asunto: "¿A quién puedo escribir para proveedores de espectáculos?",
    cuerpo: `Hola:\n\n${PRESENTACION_AGENCIA}\n\nMe gustaría trabajar con agencias como proveedor. ¿Podríais decirme con quién de vuestro equipo me conviene hablar para proveedores de espectáculos o animación?\n\nCon un nombre o un email me vale. Gracias,\n\n${FIRMA_AGENCIA}`,
  };
}
function mailAgencia1A(nombre: string): { asunto: string; cuerpo: string } {
  return {
    asunto: "Una pregunta rápida sobre espectáculos para vuestros eventos",
    cuerpo: `Hola ${nombre}:\n\n${PRESENTACION_AGENCIA}\n\nMe gustaría trabajar con agencias como proveedor y prefiero acertar con lo que os hace falta antes que mandaros un catálogo.\n\nUna pregunta: cuando un cliente os pide magia o un espectáculo, ¿qué formato os cuesta más encontrar bien resuelto? (cóctel itinerante, presentador, show de sobremesa, algo para público familiar…)\n\nCon una línea me vale. Gracias,\n\n${FIRMA_AGENCIA}`,
  };
}
// Dentro de un hilo abierto: sin saludo ni firma (regla aprendida 1).
const RECORDATORIO_AGENCIA_1B = "Escribo de nuevo por si mi mensaje se quedó entre los demás: ¿me podéis decir con quién de vuestro equipo hablar para proveedores de espectáculos? Con un nombre me vale.";
const RECORDATORIO_AGENCIA_1A = "Te escribo de nuevo por si se te pasó: ¿qué formato de espectáculo os cuesta más encontrar bien resuelto? Con una línea me vale.";

export function decidirMagia(f: Ficha): Decision | null {
  const fase = faseMagia(f.estado);
  const pa = (f.proxima_accion ?? "").toLowerCase();
  const h = hoy();
  const seg = (f.segmento ?? "").toLowerCase();
  const particular = (f.tipo_entidad ?? "").toLowerCase() === "particular";
  const { canal } = canalDe(f);

  if (fase === 8) return null;
  if (f.bloqueado_por) {
    return { tipo: "revisar_bloqueo", nivel: "C", conMensaje: false, instrucciones: "", cambios: { fecha_proxima_accion: sumar(h, 30) }, nota: `Bloqueado por "${f.bloqueado_por}". Si sigue igual, +30 días; si el bloqueo se ha resuelto, escribe tú.` };
  }
  if (pa.startsWith("esperar") || pa.startsWith("espera ")) {
    return { tipo: "seguimiento", nivel: "C", conMensaje: true, instrucciones: `La ficha dice: "${f.proxima_accion}". Ha llegado la fecha. Si procede un toque suave (Mensajes comunes · Seguimiento corto), redáctalo en dos frases por el canal de la ficha; si no procede, responder = false y propón mover la fecha.`, cambios: { fecha_proxima_accion: laborables(h, 3) }, nota: `Estabas esperando: ${f.proxima_accion}` };
  }
  if (seg === "agencia" && canal === "llamada" && fase !== 7) {
    return { tipo: "localizar_contacto", nivel: "C", conMensaje: false, instrucciones: "", cambios: { fecha_proxima_accion: sumar(h, 3) }, nota: "Agencia sin email: localiza el email general en su web, Google Maps o Instagram y ponlo en la ficha. No se llama hasta tener contacto con nombre. Al aplicar, la fecha pasa a +3 días." };
  }
  if (canal === "llamada" && fase !== 7) {
    return { tipo: "llamada_alain", nivel: "C", conMensaje: false, instrucciones: "", cambios: { fecha_proxima_accion: sumar(h, 7) }, nota: "La ficha no tiene correo ni teléfono con el que escribir: toca llamar o conseguir el contacto. Al aplicar, la fecha pasa a +7." };
  }

  // 7 Ganado: lo que haya programado es de Alain (cobro, confirmación, post-evento).
  if (fase === 7) {
    return { tipo: "revisar_ganado", nivel: "C", conMensaje: false, instrucciones: "", cambios: {}, nota: `Cliente ganado con acción programada: "${f.proxima_accion ?? "sin texto"}". Si el evento ya se hizo, aplica la regla post-evento (segmento antiguo, 9 Aparcado, 2 meses antes del aniversario) desde la ficha.` };
  }

  if (seg === "agencia") {
    const nombre = primerNombre(f.responsable);
    if (fase === 0 || fase === 1 || fase === 2) {
      const m = nombre ? mailAgencia1A(nombre) : mailAgencia1B();
      return {
        tipo: nombre ? "agencia_1a" : "agencia_1b",
        nivel: "B",
        conMensaje: true,
        instrucciones: `Primer mail a una agencia de eventos (${nombre ? "con persona de contacto: pregunta por el formato" : "a un email general: pide a quién escribir"}). Texto fijo del guion, sin cambiar nada salvo que Alain indique otra cosa:\nAsunto: ${m.asunto}\n\n${m.cuerpo}`,
        cambios: { estado: "3 Primer mensaje enviado", proxima_accion: "Recordatorio único (4 días laborables). Sin llamar hasta tener contacto con nombre", fecha_proxima_accion: laborables(h, 4) },
        borrador: m,
        nota: nombre ? undefined : "Solo hay email general: este mail pide a quién escribir. No llamar.",
      };
    }
    if (fase === 3) {
      const texto = nombre ? RECORDATORIO_AGENCIA_1A : RECORDATORIO_AGENCIA_1B;
      return {
        tipo: "recordatorio_1",
        nivel: "A",
        conMensaje: true,
        instrucciones: `Recordatorio único a una agencia, dentro del mismo hilo, sin saludo ni firma. Texto fijo: ${texto}`,
        cambios: { estado: "9 Aparcado", proxima_accion: "Check-in (agencia)", fecha_proxima_accion: sumarMeses(h, 6) },
        borrador: { asunto: null, cuerpo: texto },
        nota: "Último toque: si no contesta, la ficha queda aparcada y vuelve a +6 meses.",
      };
    }
    if (fase === 9) {
      return {
        tipo: "check_in",
        nivel: "B",
        conMensaje: true,
        instrucciones: "Check-in semestral a una agencia de eventos: mensaje corto y cercano. Recuerda que sigues disponible y haz UNA pregunta fácil (qué formato les ha costado encontrar este año). Sin catálogo ni precios. Por el canal indicado.",
        cambios: { estado: "9 Aparcado", proxima_accion: "Check-in (agencia)", fecha_proxima_accion: sumarMeses(h, 6) },
      };
    }
    if (fase === 4) {
      return {
        tipo: "propuesta",
        nivel: "C",
        conMensaje: true,
        instrucciones: "Una agencia de eventos ha respondido. Mira en el Registro y en su respuesta QUÉ FORMATO dicen que les cuesta encontrar y propón solo ese formato (no un catálogo): una frase de qué incluye, que puedes mandar vídeo y condiciones, y que tienes seguro de responsabilidad civil. Sin precio si la ficha no lo trae; en ese caso pregunta fecha y tipo de evento. En nota_para_alain deja el formato que han dicho.",
        cambios: { estado: "5 Propuesta enviada", proxima_accion: "Seguimiento de la propuesta (3 días laborables)", fecha_proxima_accion: laborables(h, 3) },
      };
    }
  }

  if (seg === "intermediario") {
    return {
      tipo: "check_in",
      nivel: "B",
      conMensaje: true,
      instrucciones: "Toca el check-in semestral a un intermediario (Intermediarios · Check-in): mensaje corto, cercano, sin pedir nada concreto más que saber cómo va y recordar que sigues disponible para lo que le llegue. Por el canal indicado.",
      cambios: { estado: "9 Aparcado", proxima_accion: "Check-in", fecha_proxima_accion: sumarMeses(h, 6) },
    };
  }

  if (seg === "recuperar") {
    if (fase === 9 || fase === 0) {
      return {
        tipo: "recuperacion",
        nivel: "B",
        conMensaje: true,
        instrucciones: "Propuesta antigua que no se cerró: redacta el mensaje de recuperación (Recuperar · Mensaje) por el canal indicado, aludiendo a lo que se habló entonces (ultimo_evento y Registro) sin reprochar nada, y con una pregunta fácil para ver si ahora encaja.",
        cambios: { estado: "3 Primer mensaje enviado", proxima_accion: "Recordatorio único si no contesta", fecha_proxima_accion: laborables(h, 5) },
      };
    }
    if (fase === 3) {
      return {
        tipo: "recordatorio_1",
        nivel: "A",
        conMensaje: true,
        instrucciones: "Recordatorio único del mensaje de recuperación, dentro del mismo hilo (o como segundo WhatsApp): dos frases, con salida fácil. Sin saludo ni firma.",
        cambios: { estado: "9 Aparcado", proxima_accion: "Recuperación (2.º intento; si ya hubo dos en años distintos → 8 Perdido)", fecha_proxima_accion: sumarMeses(h, 12) },
        nota: "Si el Registro ya muestra dos intentos de recuperación en años distintos, el flujo dice 8 Perdido en vez de aparcar.",
      };
    }
  }

  // Antiguos, referidos y leads de charlas: flujo general de la Guía.
  if (fase === 0 || fase === 1 || fase === 2 || fase === 9) {
    if (seg === "antiguo" || fase === 9) {
      const variante = particular ? "C (particular: se pide recomendación, no repetir)" : canal === "whatsapp" ? "A (WhatsApp, trato cercano)" : "B (mail a empresa o institución)";
      return {
        tipo: "reactivacion",
        nivel: "B",
        conMensaje: true,
        instrucciones: `Toca la reactivación de un antiguo cliente (Antiguos · Reactivación, variante ${variante}) por el canal indicado, en el idioma de la ficha. Menciona lo que hicisteis (ultimo_evento) con naturalidad. Si estamos en octubre-noviembre y es empresa o ayuntamiento, gancho de Navidad / fin de año.${f.proxima_accion && !/^reactivaci/i.test(f.proxima_accion) ? ` La ficha indica además: "${f.proxima_accion}".` : ""}`,
        cambios: particular
          ? { estado: "9 Aparcado", proxima_accion: "Reactivación", fecha_proxima_accion: antesDeTemporada(f) }
          : { estado: "3 Primer mensaje enviado", proxima_accion: "Recordatorio 1 (4 días laborables)", fecha_proxima_accion: laborables(h, 4) },
        nota: particular ? "Particular: se le pide una recomendación y no se persigue. Al enviar, la ficha queda aparcada hasta antes de su temporada." : undefined,
      };
    }
    return {
      tipo: "primer_contacto",
      nivel: "C",
      conMensaje: true,
      instrucciones: `Primer contacto con este prospecto (segmento ${seg || "sin segmento"}; origen: ${"origen" in f ? String((f as Record<string, unknown>).origen ?? "") : ""}). Redacta el primer mensaje por el canal indicado según la Guía comercial y el contexto de la ficha (si hay un bloque "mensaje-listo" en el cuerpo, úsalo como base). Alain decide.`,
      cambios: { estado: "3 Primer mensaje enviado", proxima_accion: "Recordatorio 1 (4 días laborables)", fecha_proxima_accion: laborables(h, 4) },
    };
  }
  if (fase === 3) {
    if (/recordatorio 2|último|ultimo/.test(pa)) {
      return {
        tipo: "recordatorio_2",
        nivel: "A",
        conMensaje: true,
        instrucciones: "Recordatorio 2, el último (Antiguos · Recordatorios / textos de las tandas), dentro del hilo: cierre amable con salida fácil, dos o tres frases, sin saludo ni firma.",
        cambios: { estado: "9 Aparcado", proxima_accion: "Reactivación", fecha_proxima_accion: antesDeTemporada(f) },
      };
    }
    return {
      tipo: "recordatorio_1",
      nivel: "A",
      conMensaje: true,
      instrucciones: "Recordatorio 1 (Antiguos · Recordatorios / textos de las tandas), dentro del hilo: una o dos frases para ir cerrando el calendario, con salida fácil. Sin saludo ni firma.",
      cambios: { proxima_accion: "Recordatorio 2 (último), a los 7 días", fecha_proxima_accion: sumar(h, 7) },
    };
  }
  if (fase === 4) {
    return {
      tipo: "propuesta",
      nivel: "C",
      conMensaje: true,
      instrucciones: "Han respondido y falta la propuesta (Antiguos · Propuesta y cierre). Redacta la propuesta por escrito solo si los datos están en la ficha o el Registro (formato, fecha, importe del último evento); si falta algo, redacta en su lugar el mensaje que lo pida (una sola pregunta) o propón una llamada. Recuerda en nota_para_alain el nivel de cobro que aplica según la Guía.",
      cambios: { estado: "5 Propuesta enviada", proxima_accion: "Seguimiento de la propuesta (3 días laborables)", fecha_proxima_accion: laborables(h, 3) },
    };
  }
  if (fase === 5 || fase === 6) {
    if (/cierre/.test(pa)) {
      return { tipo: "cierre", nivel: "B", conMensaje: true, instrucciones: "Cierre suave (Mensajes comunes · Cierre suave) dentro del hilo: dos frases, sin presión, con salida fácil. Sin saludo ni firma.", cambios: { proxima_accion: "Aparcar si no contesta", fecha_proxima_accion: laborables(h, 5) } };
    }
    if (/aparcar/.test(pa)) {
      return { tipo: "aparcar", nivel: "A", conMensaje: false, instrucciones: "", cambios: { estado: "9 Aparcado", proxima_accion: "Reactivación", fecha_proxima_accion: antesDeTemporada(f) }, nota: "Sin respuesta tras el cierre: se aparca hasta antes de su temporada." };
    }
    return {
      tipo: "seguimiento",
      nivel: "B",
      conMensaje: true,
      instrucciones: fase === 5 ? "Seguimiento de la propuesta (Mensajes comunes · Seguimiento propuesta) dentro del hilo: una pregunta fácil (¿lo habéis podido ver / comentar?). Sin saludo ni firma." : "Conversación que se ha enfriado: seguimiento corto dentro del hilo con la única pregunta que desbloquea (fecha, formato o a quién va la propuesta). Sin saludo ni firma.",
      cambios: { proxima_accion: "Cierre suave si no contesta", fecha_proxima_accion: laborables(h, 5) },
    };
  }
  return null;
}

export interface ResumenMotorMagia {
  activo: boolean;
  revisados: number;
  creadas: number;
  ya_abiertas: number;
  errores: string[];
  pendientes_restantes: number;
}

export async function tareasPorFechaMagia(opciones: { presupuestoMs: number }): Promise<ResumenMotorMagia> {
  const inicio = Date.now();
  const sb = supabaseCharlas();
  const res: ResumenMotorMagia = { activo: true, revisados: 0, creadas: 0, ya_abiertas: 0, errores: [], pendientes_restantes: 0 };
  const { data: cfgs } = await sb.from("charlas_config").select("clave, valor").in("clave", ["magia_activo", "magia_por_dia"]);
  const cfg = Object.fromEntries((cfgs ?? []).map((c) => [c.clave, c.valor]));
  if (cfg.magia_activo === false) return { ...res, activo: false };
  const tope = Number(cfg.magia_por_dia ?? 10);

  const { count: hoyYa } = await sb.from("crm_tareas").select("id", { count: "exact", head: true }).eq("carril", "magia").gte("creado_en", `${hoy()}T00:00:00+01:00`);
  const cupo = Math.max(0, tope - (hoyYa ?? 0));
  if (!cupo) return res;

  const { data: fichas } = await sb.from("crm_fichas").select("*").eq("carril", "magia").lte("fecha_proxima_accion", hoy()).not("estado", "like", "8%").order("prioridad", { ascending: true, nullsFirst: false }).order("fecha_proxima_accion");
  const { data: abiertas } = await sb.from("crm_tareas").select("ficha_id").eq("carril", "magia").in("estado", ["revisar", "pendiente", "aprobada"]);
  const conTarea = new Set((abiertas ?? []).map((t) => t.ficha_id as string));
  const { data: recientes } = await sb.from("crm_mensajes").select("ficha_id, direccion, fecha").gte("fecha", new Date(Date.now() - 21 * 86400000).toISOString()).not("ficha_id", "is", null).order("fecha");
  const ultimo = new Map<string, string>();
  for (const m of recientes ?? []) ultimo.set(m.ficha_id as string, m.direccion as string);

  const cola = ((fichas ?? []) as Ficha[]).filter((f) => {
    if (conTarea.has(f.id)) {
      res.ya_abiertas++;
      return false;
    }
    return true;
  });
  let i = 0;
  for (; i < cola.length && res.creadas + res.errores.length < cupo; i++) {
    if (Date.now() - inicio > opciones.presupuestoMs) break;
    const f = cola[i];
    res.revisados++;
    let d = decidirMagia(f);
    if (!d) continue;
    if (ultimo.get(f.id) === "entrante") {
      d = { tipo: "revisar_correo", nivel: "C", conMensaje: false, instrucciones: "", cambios: { fecha_proxima_accion: sumar(hoy(), 7) }, nota: `Tocaba "${etiquetaMagia(d.tipo).toLowerCase()}", pero lo último es un correo suyo sin respuesta tuya. Decide desde la ficha.` };
    }
    try {
      await crearTareaMagia(f, d);
      res.creadas++;
    } catch (e) {
      res.errores.push(`${f.nombre}: ${(e as Error).message}`);
    }
  }
  res.pendientes_restantes = cola.length - i;
  return res;
}

function urgenciaMagia(tipo: string, clasificacion?: string | null): { urgencia: 1 | 2 | 3; motivo: string } {
  if (clasificacion === "interesado" || clasificacion === "da_fecha") return { urgencia: 3, motivo: "Quiere repetir o da fecha: cerrar" };
  if (clasificacion === "pide_propuesta" || tipo === "propuesta") return { urgencia: 2, motivo: "Hay que mandar la propuesta" };
  if (clasificacion === "recomienda") return { urgencia: 2, motivo: "Te pasan un contacto" };
  if (tipo === "respuesta" || tipo === "revisar_correo" || tipo === "llamada_alain") return { urgencia: 2, motivo: "Hay algo que decidir" };
  return { urgencia: 1, motivo: "Paso programado del flujo" };
}

async function crearTareaMagia(f: Ficha, d: Decision) {
  const sb = supabaseCharlas();
  const { canal, destinatario } = canalDe(f);
  const nivel: "A" | "B" | "C" = f.nivel_autonomia === "C" ? "C" : d.nivel;
  const idioma: "es" | "eu" = (f.idioma ?? "").toLowerCase() === "eu" ? "eu" : "es";
  const { urgencia, motivo } = urgenciaMagia(d.tipo);
  const base = {
    ficha_id: f.id,
    carril: "magia",
    tipo: d.tipo,
    canal: d.conMensaje ? (canal === "llamada" ? "ninguno" : canal) : "ninguno",
    nivel,
    urgencia,
    urgencia_motivo: motivo,
    estado: "revisar",
    idioma,
    cambios_crm: d.cambios,
    destinatario: d.conMensaje ? destinatario : null,
    nota_para_alain: d.nota ?? null,
    editado: false,
  };
  if (!d.conMensaje || canal === "llamada") {
    await sb.from("crm_tareas").insert({ ...base, contexto: { programada: true, resumen: etiquetaMagia(d.tipo), clasificacion: d.tipo } });
    return;
  }
  if (d.borrador && canal === "mail") {
    // Texto fijo del guion: sin llamada a la IA, el borrador sale exacto.
    await sb.from("crm_tareas").insert({
      ...base,
      contexto: { programada: true, clasificacion: d.tipo, instrucciones: d.instrucciones, canal_ia: "mail", resumen: etiquetaMagia(d.tipo), confianza: 1, etiqueta_principal: null, alternativa: null, redaccion: "texto_fijo" },
      borrador_asunto: d.borrador.asunto,
      borrador_texto: d.borrador.cuerpo,
    });
    return;
  }
  const [{ data: ficha }, { data: registro }, { data: hilo }] = await Promise.all([
    sb.from("crm_fichas").select("*").eq("id", f.id).single(),
    sb.from("crm_interacciones").select("fecha, canal, texto").eq("ficha_id", f.id).order("fecha", { ascending: true, nullsFirst: true }).order("orden"),
    sb.from("crm_mensajes").select("direccion, fecha, de, asunto, texto").eq("ficha_id", f.id).order("fecha", { ascending: false }).limit(6),
  ]);
  const { frontmatter_raw, cuerpo_despues, creado_en, actualizado_en, actualizado_por, id, ...limpia } = ficha ?? {};
  void frontmatter_raw; void cuerpo_despues; void creado_en; void actualizado_en; void actualizado_por; void id;
  const r = await procesarMagiaConIA({
    ficha: limpia,
    registro: (registro ?? []).slice(-40),
    hilo: (hilo ?? []).reverse(),
    programada: { tipo: d.tipo, canal: canal === "whatsapp" ? "whatsapp" : "mail", instrucciones: d.instrucciones, destinatario },
  });
  await sb.from("crm_tareas").insert({
    ...base,
    contexto: {
      programada: true,
      clasificacion: d.tipo,
      instrucciones: d.instrucciones,
      canal_ia: canal === "whatsapp" ? "whatsapp" : "mail",
      resumen: r.resumen || etiquetaMagia(d.tipo),
      confianza: r.confianza,
      etiqueta_principal: r.alternativa?.etiqueta_principal ?? null,
      alternativa: r.alternativa ? { etiqueta: r.alternativa.etiqueta, asunto: r.alternativa.asunto, cuerpo: r.alternativa.cuerpo } : null,
    },
    borrador_asunto: canal === "mail" ? r.respuesta?.asunto ?? null : null,
    borrador_texto: r.respuesta?.cuerpo ?? null,
    cambios_crm: d.cambios,
    nota_para_alain: [d.nota, r.nota_para_alain].filter(Boolean).join(" · ") || null,
  });
}

/** Vuelve a redactar una tarea programada con una indicación de Alain. */
export async function regenerarTareaMagia(tareaId: string, instruccion: string) {
  const sb = supabaseCharlas();
  const { data: t } = await sb.from("crm_tareas").select("*").eq("id", tareaId).single();
  if (!t) throw new Error("Tarea no encontrada.");
  const [{ data: ficha }, { data: registro }, { data: hilo }] = await Promise.all([
    sb.from("crm_fichas").select("*").eq("id", t.ficha_id).single(),
    sb.from("crm_interacciones").select("fecha, canal, texto").eq("ficha_id", t.ficha_id).order("fecha", { ascending: true, nullsFirst: true }).order("orden"),
    sb.from("crm_mensajes").select("direccion, fecha, de, asunto, texto").eq("ficha_id", t.ficha_id).order("fecha", { ascending: false }).limit(6),
  ]);
  if (!ficha) throw new Error("Ficha no encontrada.");
  const { frontmatter_raw, cuerpo_despues, creado_en, actualizado_en, actualizado_por, id, ...limpia } = ficha;
  void frontmatter_raw; void cuerpo_despues; void creado_en; void actualizado_en; void actualizado_por; void id;
  const ctx = (t.contexto ?? {}) as { instrucciones?: string; canal_ia?: "mail" | "whatsapp" };
  const r = await procesarMagiaConIA({
    ficha: limpia,
    registro: (registro ?? []).slice(-40),
    hilo: (hilo ?? []).reverse(),
    programada: { tipo: t.tipo, canal: ctx.canal_ia ?? (t.canal === "whatsapp" ? "whatsapp" : "mail"), instrucciones: ctx.instrucciones ?? `Vuelve a redactar: ${etiquetaMagia(t.tipo)}.`, destinatario: t.destinatario },
    instruccion_extra: instruccion,
  });
  await sb
    .from("crm_tareas")
    .update({
      borrador_asunto: t.canal === "mail" ? r.respuesta?.asunto ?? t.borrador_asunto : null,
      borrador_texto: r.respuesta?.cuerpo ?? t.borrador_texto,
      contexto: { ...ctx, resumen: r.resumen, instruccion: instruccion, etiqueta_principal: r.alternativa?.etiqueta_principal ?? null, alternativa: r.alternativa ? { etiqueta: r.alternativa.etiqueta, asunto: r.alternativa.asunto, cuerpo: r.alternativa.cuerpo } : null },
      nota_para_alain: r.nota_para_alain ?? t.nota_para_alain,
    })
    .eq("id", t.id);
}

/** Correo entrante asociado a una ficha de magia: lo lee la IA y crea la tarjeta. */
export async function procesarEntranteMagia(mensajeId: string, instruccion?: string): Promise<{ resultado: ResultadoMagia; tarea: string | null }> {
  const sb = supabaseCharlas();
  const { data: m } = await sb.from("crm_mensajes").select("*").eq("id", mensajeId).single();
  if (!m?.ficha_id) throw new Error("Mensaje sin ficha.");
  const [{ data: ficha }, { data: registro }, { data: hilo }] = await Promise.all([
    sb.from("crm_fichas").select("*").eq("id", m.ficha_id).single(),
    sb.from("crm_interacciones").select("fecha, canal, texto").eq("ficha_id", m.ficha_id).order("fecha", { ascending: true, nullsFirst: true }).order("orden"),
    sb.from("crm_mensajes").select("direccion, fecha, de, asunto, texto").eq("ficha_id", m.ficha_id).neq("id", m.id).lt("fecha", m.fecha ?? new Date().toISOString()).order("fecha", { ascending: false }).limit(6),
  ]);
  if (!ficha) throw new Error("Ficha no encontrada.");
  const { frontmatter_raw, cuerpo_despues, creado_en, actualizado_en, actualizado_por, id, ...limpia } = ficha;
  void frontmatter_raw; void cuerpo_despues; void creado_en; void actualizado_en; void actualizado_por; void id;
  const r = await procesarMagiaConIA({ ficha: limpia, registro: (registro ?? []).slice(-40), hilo: (hilo ?? []).reverse(), correo: { de: m.de, asunto: m.asunto, fecha: m.fecha, texto: m.texto ?? "" }, instruccion_extra: instruccion }, m.id);

  if (!instruccion) {
    await sb.from("crm_interacciones").insert({ ficha_id: m.ficha_id, fecha: (m.fecha ?? new Date().toISOString()).slice(0, 10), canal: "Recibido", texto: r.resumen, orden: 500, origen: "sistema", mensaje_id: m.id });
  }
  await sb.from("crm_mensajes").update({ estado: "procesado", clasificacion: r.clasificacion, clasificacion_confianza: r.confianza, datos_extraidos: r.datos ?? {}, idioma: r.idioma, resumen: r.resumen, error: null }).eq("id", m.id);

  const cambios: Record<string, unknown> = { ...r.cambios_crm };
  for (const k of Object.keys(cambios)) if (cambios[k] === null || cambios[k] === undefined) delete cambios[k];
  const importante = ["interesado", "pide_propuesta", "da_fecha", "no_interesa", "recomienda", "pregunta"].includes(r.clasificacion) || r.necesita_alain || faseMagia(ficha.estado) >= 4;
  if (!r.responder && Object.keys(cambios).length === 0 && !importante) return { resultado: r, tarea: null };

  await sb.from("crm_tareas").update({ estado: "descartada", motivo: "Sustituida por una respuesta más reciente", resuelto_en: new Date().toISOString(), resuelto_por: "sistema" }).eq("ficha_id", m.ficha_id).in("estado", ["revisar", "pendiente"]).neq("mensaje_entrante_id", m.id);

  const nivel: "A" | "B" | "C" = r.necesita_alain || ficha.nivel_autonomia === "C" || faseMagia(ficha.estado) === 6 || r.confianza < 0.8 ? "C" : "B";
  const { urgencia, motivo } = urgenciaMagia("respuesta", r.clasificacion);
  const fila = {
    ficha_id: m.ficha_id,
    carril: "magia",
    tipo: r.responder ? "respuesta" : "actualizar_crm",
    canal: r.responder ? "mail" : "ninguno",
    nivel,
    urgencia,
    urgencia_motivo: motivo,
    estado: "revisar",
    idioma: r.idioma === "eu" ? "eu" : "es",
    mensaje_entrante_id: m.id,
    contexto: { clasificacion: r.clasificacion, confianza: r.confianza, resumen: r.resumen, datos: r.datos, etiqueta_principal: r.alternativa?.etiqueta_principal ?? null, alternativa: r.alternativa ? { etiqueta: r.alternativa.etiqueta, asunto: r.alternativa.asunto, cuerpo: r.alternativa.cuerpo } : null },
    borrador_asunto: r.respuesta?.asunto ?? null,
    borrador_texto: r.respuesta?.cuerpo ?? null,
    destinatario: m.de,
    cambios_crm: cambios,
    nota_para_alain: r.nota_para_alain ?? (!r.responder && importante ? "La IA no ve necesario contestar. Revísalo y cierra o mueve la fecha desde la ficha." : null),
    editado: false,
  };
  const { data: existente } = await sb.from("crm_tareas").select("id").eq("mensaje_entrante_id", m.id).in("estado", ["revisar", "pendiente"]).maybeSingle();
  if (existente) {
    await sb.from("crm_tareas").update(fila).eq("id", existente.id);
    return { resultado: r, tarea: existente.id };
  }
  const { data: nueva, error } = await sb.from("crm_tareas").insert(fila).select("id").single();
  if (error) throw new Error(error.message);
  return { resultado: r, tarea: nueva.id };
}

/** Procesa los correos entrantes de magia pendientes (los deja el lector en crm_mensajes). */
export async function procesarPendientesMagia(opciones: { presupuestoMs: number; limite?: number }) {
  const inicio = Date.now();
  const sb = supabaseCharlas();
  const res = { procesados: 0, tareas: 0, errores: [] as string[] };
  const { data: pendientes } = await sb.from("crm_mensajes").select("id, asunto, intentos").eq("direccion", "entrante").eq("estado", "nuevo").not("ficha_id", "is", null).lt("intentos", 3).order("fecha").limit(opciones.limite ?? 5);
  for (const m of pendientes ?? []) {
    if (Date.now() - inicio > opciones.presupuestoMs) break;
    try {
      const r = await procesarEntranteMagia(m.id);
      res.procesados++;
      if (r.tarea) res.tareas++;
    } catch (e) {
      const intentos = (m.intentos ?? 0) + 1;
      await sb.from("crm_mensajes").update({ intentos, estado: intentos >= 3 ? "error" : "nuevo", error: (e as Error).message.slice(0, 500) }).eq("id", m.id);
      res.errores.push(`${m.asunto ?? m.id}: ${(e as Error).message}`);
    }
  }
  return res;
}

export function etiquetaMagia(tipo: string): string {
  return (
    {
      reactivacion: "Reactivación",
      recordatorio_1: "Recordatorio 1",
      recordatorio_2: "Recordatorio 2 (último)",
      recuperacion: "Mensaje de recuperación",
      check_in: "Check-in",
      primer_contacto: "Primer contacto",
      agencia_1a: "Agencia · primer mail (pregunta por el formato)",
      agencia_1b: "Agencia · primer mail (pide a quién escribir)",
      localizar_contacto: "Localizar el email de la agencia",
      propuesta: "Propuesta",
      seguimiento: "Seguimiento",
      cierre: "Cierre suave",
      aparcar: "Aparcar",
      revisar_bloqueo: "Revisar bloqueo",
      revisar_ganado: "Cliente ganado: acción programada",
      revisar_correo: "Correo suyo sin respuesta",
      llamada_alain: "Llamada / conseguir contacto",
      respuesta: "Respuesta",
      actualizar_crm: "Actualizar ficha",
    } as Record<string, string>
  )[tipo] ?? tipo;
}
