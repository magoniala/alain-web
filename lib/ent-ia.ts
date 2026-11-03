// App de Entrenatzaile · fase 7c: propuesta de la siguiente sesión con IA.
//
// Cuando el cliente cierra una sesión (hecha o incompleta), el cron pide a la
// IA la siguiente sesión del mismo tipo (la de la semana que viene) a partir
// del plan del bloque, las últimas sesiones registradas de ese tipo, los
// formularios y las reglas del cliente. Sale como propuesta en ent_propuestas
// (estado 'revisar'); Alain la ve en la pestaña Entrenatzaile, la acepta tal
// cual o cambiada (cada cambio con motivo → ent_correcciones, que entran en
// las propuestas siguientes). Al aprobar se crea la sesión en la semana que
// toque (y la semana si no existe), en borrador.
//
// Nada se publica solo: todo en revisión (nivel C) hasta que Alain diga.

import { supabaseCharlas } from "./charlas";
import { llamarClaude } from "./charlas-ia";
import { sumarDias, type Ejercicio } from "./ent";

export interface EjercicioPropuesto {
  nombre: string;
  series: number | null;
  reps: string | null;
  carga: string | null;
  tempo: string | null;
  descanso: string | null;
  rir: string | null;
  notas: string | null;
  video: boolean;
  campos: string[];
  cambio: string | null; // por qué cambia respecto a la última vez (null = igual)
}
export interface Propuesta {
  nombre: string;
  fecha: string;
  duracion_min: number | null;
  foco: string | null;
  calentamiento: string | null;
  notas: string | null;
  ejercicios: EjercicioPropuesto[];
  lectura: string; // 2-4 frases: cómo fue la última y qué se ajusta
  avisos: string[]; // cosas que Alain debe decidir (molestias, hitos, material)
}

const INSTRUCCIONES = `Eres el asistente de programación de Alain Zulaika, entrenador personal (Entrenatzaile). Alain programa a sus clientes por bloques (un plan con metas, fases y sesiones tipo A/B/C). Tu trabajo: a partir del plan, de lo que el cliente registró en las últimas sesiones de este tipo y de sus formularios, proponer la SIGUIENTE sesión de ese mismo tipo (normalmente la de la semana que viene), lista para que Alain la revise.

Cómo programa Alain (respétalo siempre):
- Reglas del cliente: se cumplen sin excepción (si dice "fuera la búlgara", no aparece).
- Doble progresión en los básicos con carga: cuando todas las series salen en el tope del rango con RIR ≥ 1, sube la carga (2,5-5 kg en peso muerto; 1-2 kg en mancuernas) y vuelve al mínimo del rango. Si no llega al mínimo, se mantiene o se baja.
- Progresión por palanca (ayuda, altura, ángulo, tempo) en dominadas, sentadilla a una pierna, flexiones.
- Un cambio por ejercicio y sesión como mucho. Si no hay motivo claro, se mantiene igual: "mantener" es una propuesta válida y frecuente.
- Fase del plan y RIR de la semana mandan sobre la progresión: en reentrada o descarga no se sube.
- Formularios: molestia ≥ 4 o repetida → cambia o quita el ejercicio implicado y dilo en avisos. Agujetas 4-5 o energía 1-2 en la recuperación → una serie menos o RIR +1 en la siguiente. RPE de sesión 9-10 cuando la semana era a RIR 2-3 → bajar carga. Trabajo físico duro declarado → la sesión pesada no va pegada (dilo en avisos; la fecha la decide Alain).
- Sesión incompleta o saltada: no se progresa; repetir con nota.
- Mantén los nombres de los ejercicios tal cual (son los que el cliente conoce). Los campos que registra el cliente (campos) se copian del ejercicio anterior; "video" solo true si Alain pidió vídeo cuando sube la carga o es la primera vez de un ejercicio.
- Las notas al cliente son cortas y en su idioma, en el tono de Alain: cercano, directo, sin tecnicismos ("Mismo peso, pero bájalo en 3 segundos").
- No inventes: si falta un registro, dilo en lectura y propón mantener.

Devuelve SOLO un JSON con esta forma exacta:
{"nombre":"A · Fuerza","fecha":"AAAA-MM-DD","duracion_min":50,"foco":"una frase para el recordatorio del día (o null)","calentamiento":"… o null","notas":"… o null","ejercicios":[{"nombre":"…","series":3,"reps":"6","carga":"52,5 kg","tempo":null,"descanso":"2-3'","rir":null,"notas":"… o null","video":false,"campos":["reps","peso","rir"],"cambio":"sube 2,5 kg: las 3 series a 6 con RIR 3 (o null si igual)"}],"lectura":"2-4 frases en castellano para Alain: cómo fue la última sesión y qué ajustas y por qué","avisos":["cosas que Alain debe decidir; [] si nada"]}`;

function fmtSerie(s: { serie: number; lado: string | null; reps: number | null; peso: number | null; rir: number | null; tiempo_s: number | null; nota: string | null }) {
  return `${s.lado ? `${s.lado} ` : ""}S${s.serie}: ${s.reps ?? "?"} reps${s.peso !== null ? ` × ${s.peso} kg` : ""}${s.rir !== null ? ` @RIR ${s.rir}` : ""}${s.tiempo_s ? ` (${s.tiempo_s} s)` : ""}${s.nota ? ` — ${s.nota}` : ""}`;
}

/** Genera la propuesta para la sesión cerrada `sesionId`. Devuelve el id de la propuesta o null si no toca. */
export async function proponerSiguiente(sesionId: string): Promise<string | null> {
  const sb = supabaseCharlas();
  const { data: s } = await sb.from("ent_sesiones").select("*, ejercicios:ent_ejercicios(*)").eq("id", sesionId).single();
  if (!s || !["hecha", "incompleta", "saltada"].includes(s.estado)) return null;
  // Ya hay propuesta para esta sesión (o ya existe la siguiente del mismo tipo en una semana posterior).
  const { count: yaProp } = await sb.from("ent_propuestas").select("id", { count: "exact", head: true }).eq("sesion_origen_id", s.id);
  if (yaProp) return null;
  const [{ data: cliente }, { data: semana }] = await Promise.all([sb.from("ent_clientes").select("*").eq("id", s.cliente_id).single(), sb.from("ent_semanas").select("*").eq("id", s.semana_id).single()]);
  if (!cliente || !semana) return null;
  const { data: plan } = await sb.from("ent_planes").select("*").eq("id", semana.plan_id).single();
  const fechaSiguiente = sumarDias(s.fecha, 7);
  const { data: siguienteYa } = await sb.from("ent_sesiones").select("id, semana:ent_semanas!inner(numero)").eq("cliente_id", s.cliente_id).eq("clave", s.clave ?? "").gt("fecha", s.fecha).limit(1).maybeSingle();
  // Historial del mismo tipo: últimas 4 sesiones con sus series y formularios.
  const { data: previas } = await sb.from("ent_sesiones").select("id, nombre, fecha, estado, rpe, minutos, notas, ejercicios:ent_ejercicios(*)").eq("cliente_id", s.cliente_id).eq("clave", s.clave ?? "").lte("fecha", s.fecha).order("fecha", { ascending: false }).limit(4);
  const ids = (previas ?? []).map((p) => p.id);
  const [{ data: series }, { data: forms }, { data: correcciones }] = await Promise.all([
    sb.from("ent_series").select("*").in("sesion_id", ids),
    sb.from("ent_formularios").select("sesion_id, tipo, respuestas, alerta").in("sesion_id", ids),
    sb.from("ent_correcciones").select("ejercicio, antes, despues, motivo, creado_en").eq("cliente_id", s.cliente_id).order("creado_en", { ascending: false }).limit(20),
  ]);
  const numeroSiguiente = (semana.numero ?? 0) + 1;
  const fase = ((plan?.fases ?? []) as { semanas: string; fase: string; que_pasa: string }[]).find((f) => {
    const [a, b] = String(f.semanas).split("-").map(Number);
    return numeroSiguiente >= a && numeroSiguiente <= (b || a);
  });

  const historial = (previas ?? [])
    .map((p) => {
      const ej = ((p.ejercicios ?? []) as Ejercicio[]).sort((a, b) => a.orden - b.orden);
      const lineas = ej.map((e) => {
        const reg = (series ?? []).filter((x) => x.ejercicio_id === e.id).sort((a, b) => a.serie - b.serie || String(a.lado).localeCompare(String(b.lado)));
        return `  - ${e.nombre}: prescrito ${e.series ?? "?"} × ${e.reps ?? "?"}${e.carga ? ` · ${e.carga}` : ""}${e.rir ? ` · RIR ${e.rir}` : ""}${e.tempo ? ` · ${e.tempo}` : ""}${e.notas ? ` · ${e.notas}` : ""}\n    registrado: ${reg.length ? reg.map(fmtSerie).join(" | ") : "nada"}`;
      });
      const fs = (forms ?? []).filter((f) => f.sesion_id === p.id).map((f) => `  ${f.tipo === "post" ? "Post-sesión" : "Recuperación"}: ${JSON.stringify(f.respuestas)}${f.alerta ? ` ⚠︎ ${f.alerta}` : ""}`);
      return `Sesión ${p.nombre} del ${p.fecha} · estado ${p.estado}${p.rpe !== null ? ` · RPE ${p.rpe}` : ""}${p.minutos ? ` · ${p.minutos} min` : ""}${p.notas ? ` · nota: ${p.notas}` : ""}\n${lineas.join("\n")}\n${fs.join("\n")}`;
    })
    .join("\n\n");

  const usuario = `CLIENTE: ${cliente.nombre} (idioma ${cliente.idioma}). Zonas de riesgo: ${cliente.zonas_riesgo ?? "—"}.
REGLAS DEL CLIENTE:
${(cliente.reglas ?? []).map((r: string) => `- ${r}`).join("\n") || "- (ninguna)"}
MATERIAL: ${cliente.material ?? "—"}

PLAN ${plan?.nombre ?? ""} (${plan?.inicio ?? "?"} → ${plan?.fin ?? "?"}) · ${plan?.frecuencia ?? ""}
Metas: ${JSON.stringify(plan?.metas ?? [])}
Fases: ${JSON.stringify(plan?.fases ?? [])}
Reglas de carga del plan:
${plan?.reglas_carga ?? "(ver Markdown)"}

SEMANA QUE VIENE: semana ${numeroSiguiente}${fase ? ` · fase "${fase.fase}": ${fase.que_pasa}` : ""}. Fecha prevista de la sesión: ${fechaSiguiente} (mismo día de la semana).
${siguienteYa ? "OJO: ya existe una sesión de este tipo programada después; la propuesta es para que Alain la compare." : ""}

CORRECCIONES ANTERIORES DE ALAIN a propuestas de este cliente (aprende de ellas):
${(correcciones ?? []).map((c) => `- ${c.ejercicio ?? "sesión"}: "${c.antes}" → "${c.despues}"${c.motivo ? ` (${c.motivo})` : ""}`).join("\n") || "- (ninguna aún)"}

HISTORIAL DE SESIONES "${s.nombre}" (la más reciente primero; la primera es la que acaba de cerrar):
${historial}

Propón la siguiente sesión "${s.nombre}" para el ${fechaSiguiente}.`;

  const texto = await llamarClaude({
    system: [{ type: "text", text: INSTRUCCIONES, cache_control: { type: "ephemeral", ttl: "1h" } }],
    usuario,
    maxTokens: 3500,
    proposito: "ent_propuesta",
  });
  let propuesta: Propuesta;
  try {
    const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    propuesta = JSON.parse(limpio.slice(limpio.indexOf("{"), limpio.lastIndexOf("}") + 1));
  } catch {
    const { data } = await sb.from("ent_propuestas").insert({ cliente_id: s.cliente_id, sesion_origen_id: s.id, propuesta: { error: texto.slice(0, 2000) }, estado: "error", error: "La IA no devolvió JSON" }).select("id").single();
    return data?.id ?? null;
  }
  propuesta.fecha = /^\d{4}-\d{2}-\d{2}$/.test(propuesta.fecha ?? "") ? propuesta.fecha : fechaSiguiente;
  const { data } = await sb.from("ent_propuestas").insert({ cliente_id: s.cliente_id, sesion_origen_id: s.id, propuesta, estado: "revisar" }).select("id").single();
  return data?.id ?? null;
}

/** Desde el cron: sesiones cerradas en las últimas 48 h sin propuesta. */
export async function proponerPendientes(opciones: { presupuestoMs: number }): Promise<{ creadas: number; errores: string[] }> {
  const inicio = Date.now();
  const sb = supabaseCharlas();
  const res = { creadas: 0, errores: [] as string[] };
  const { data: cfg } = await sb.from("charlas_config").select("valor").eq("clave", "ent_propuestas_ia").maybeSingle();
  if (cfg?.valor === false) return res;
  const desde = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { data: cerradas } = await sb.from("ent_sesiones").select("id, cliente:ent_clientes!inner(estado)").in("estado", ["hecha", "incompleta"]).gte("hecha_en", desde).order("hecha_en");
  const { data: hechas } = await sb.from("ent_propuestas").select("sesion_origen_id").in("sesion_origen_id", (cerradas ?? []).map((c) => c.id));
  const ya = new Set((hechas ?? []).map((h) => h.sesion_origen_id));
  for (const c of cerradas ?? []) {
    if (ya.has(c.id) || (c.cliente as unknown as { estado: string })?.estado !== "activo") continue;
    if (Date.now() - inicio > opciones.presupuestoMs) break;
    try {
      if (await proponerSiguiente(c.id)) res.creadas++;
    } catch (e) {
      res.errores.push((e as Error).message);
    }
  }
  return res;
}

/**
 * Aprueba una propuesta (con los cambios de Alain) y crea la sesión en la
 * semana que toque, en borrador. Devuelve la sesión creada.
 */
export async function aprobarPropuesta(propuestaId: string, final: Propuesta, correcciones: { ejercicio: string | null; antes: string; despues: string; motivo: string | null }[]) {
  const sb = supabaseCharlas();
  const { data: p } = await sb.from("ent_propuestas").select("*").eq("id", propuestaId).single();
  if (!p) throw new Error("Propuesta no encontrada");
  if (p.estado !== "revisar") throw new Error(`La propuesta ya está ${p.estado}`);
  const { data: origen } = await sb.from("ent_sesiones").select("id, clave, semana_id, sesion_tipo_id, semana:ent_semanas(plan_id, numero, lunes)").eq("id", p.sesion_origen_id).single();
  if (!origen) throw new Error("La sesión de origen ya no existe");
  const semOrigen = origen.semana as unknown as { plan_id: string; numero: number; lunes: string };
  // Semana destino: la que contenga la fecha; si no existe, se crea (número +1 sobre la última).
  const lunesDestino = sumarDias(final.fecha, 1 - (new Date(`${final.fecha}T12:00:00Z`).getUTCDay() || 7));
  let { data: semana } = await sb.from("ent_semanas").select("id, numero").eq("plan_id", semOrigen.plan_id).eq("lunes", lunesDestino).maybeSingle();
  if (!semana) {
    const { data: ult } = await sb.from("ent_semanas").select("numero").eq("plan_id", semOrigen.plan_id).order("numero", { ascending: false }).limit(1).maybeSingle();
    const { data: plan } = await sb.from("ent_planes").select("fases").eq("id", semOrigen.plan_id).single();
    const numero = (ult?.numero ?? semOrigen.numero) + 1;
    const fase = ((plan?.fases ?? []) as { semanas: string; fase: string }[]).find((f) => {
      const [a, b] = String(f.semanas).split("-").map(Number);
      return numero >= a && numero <= (b || a);
    });
    const { data: nueva, error } = await sb.from("ent_semanas").insert({ plan_id: semOrigen.plan_id, cliente_id: p.cliente_id, numero, lunes: lunesDestino, fase: fase?.fase ?? null, estado: "borrador" }).select("id, numero").single();
    if (error) throw new Error(error.message);
    semana = nueva;
  }
  const { data: ses, error: e2 } = await sb
    .from("ent_sesiones")
    .insert({ semana_id: semana!.id, cliente_id: p.cliente_id, sesion_tipo_id: origen.sesion_tipo_id, clave: origen.clave, nombre: final.nombre, fecha: final.fecha, duracion_min: final.duracion_min, foco: final.foco, calentamiento: final.calentamiento, notas: final.notas })
    .select("id")
    .single();
  if (e2 || !ses) throw new Error(e2?.message ?? "No se pudo crear la sesión");
  if (final.ejercicios?.length)
    await sb.from("ent_ejercicios").insert(final.ejercicios.map((e, i) => ({ sesion_id: ses.id, orden: i + 1, nombre: e.nombre, series: e.series, reps: e.reps, carga: e.carga, tempo: e.tempo, descanso: e.descanso, rir: e.rir, notas: e.notas, video: !!e.video, campos: e.campos?.length ? e.campos : ["reps", "peso", "rir"] })));
  await sb.from("ent_propuestas").update({ estado: "aprobada", final, sesion_destino_id: ses.id, resuelto_en: new Date().toISOString() }).eq("id", propuestaId);
  if (correcciones.length) await sb.from("ent_correcciones").insert(correcciones.map((c) => ({ ...c, cliente_id: p.cliente_id, propuesta_id: propuestaId })));
  return { sesion_id: ses.id, semana_id: semana!.id, semana_numero: semana!.numero };
}
