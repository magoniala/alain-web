// Aprendizaje semanal del carril MAGIA del CRM.
//
// Mismo mecanismo que lib/charlas-aprendizaje.ts, del que reutiliza las piezas
// (momento semanal, lectura del JSON de la IA, numeración de reglas, rachas):
//
// 1. Cada domingo (config magia_aprendizaje_dia / _hora) se leen las
//    correcciones de la semana en crm_correcciones: lo que Alain cambió en un
//    borrador antes de enviarlo (con su motivo), las opciones B elegidas y los
//    descartes con motivo.
// 2. La IA propone como mucho 5 reglas cortas y concretas, con evidencia y n.
//    Ve las vigentes, las pendientes y las descartadas, para no repetirlas.
// 3. Nada entra en crm_conocimiento 'reglas_aprendidas' (lo que lee
//    lib/crm-ia.ts) hasta que Alain la aprueba desde el panel.
//
// Además, por tipo de mensaje, la racha de envíos sin corrección: el dato
// para decidir cuándo un tipo es fiable (nivel A). Las agencias van aparte
// (agencia_1a, agencia_1b y sus recordatorio_1, check_in y propuesta): su
// flujo y sus textos no son los de antiguos clientes.

import { supabaseCharlas } from "./charlas";
import { llamarClaude } from "./charlas-ia";
import { tocaSemanal, leerPropuestas, añadirReglaNumerada, calcularRachas, SOLO_JSON, type EstadisticaTipo } from "./charlas-aprendizaje";

const CARRIL = "magia";
const CFG = {
  ultima: "magia_aprendizaje_ultima",
  dia: "magia_aprendizaje_dia",
  hora: "magia_aprendizaje_hora",
  resultado: "magia_aprendizaje_resultado", // qué salió de la última pasada (lo enseña el panel)
};
const TIPOS_AGENCIA = ["agencia_1a", "agencia_1b", "recordatorio_1", "check_in", "propuesta"];
const CABECERA_REGLAS = "Reglas que Alain ha fijado revisando la bandeja. Tienen prioridad sobre los guiones cuando chocan.\n";

const ahora = () => new Date().toISOString();
const guardarConfig = (clave: string, valor: unknown) => supabaseCharlas().from("charlas_config").upsert({ clave, valor, actualizado_en: ahora() });

// ── Rachas por tipo ────────────────────────────────────────────────────────

export interface EstadisticaTipoMagia extends EstadisticaTipo {
  segmento: "agencia" | "general";
}

const esAgencia = (clave: string) => clave.startsWith("agencia");

/** Clave de la estadística. Las agencias van aparte aunque compartan tipo con otros segmentos. */
function claveTipo(tipo: string, segmento: string | null | undefined, clasificacion?: string | null): string {
  const base = tipo === "respuesta" ? `respuesta:${clasificacion ?? "otro"}` : tipo;
  if (tipo.startsWith("agencia_")) return base;
  return segmento === "agencia" ? `agencia · ${base}` : base;
}

/** Una relación embebida de PostgREST puede llegar como objeto o como lista de uno. */
const uno = <T>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

export async function estadisticasMagia(): Promise<EstadisticaTipoMagia[]> {
  const { data, error } = await supabaseCharlas()
    .from("crm_tareas")
    .select("tipo, contexto, editado, resuelto_en, ficha:crm_fichas(segmento)")
    .eq("carril", CARRIL)
    .eq("estado", "enviada")
    .order("resuelto_en", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`Rachas: ${error.message}`);

  const stats = calcularRachas(data ?? [], (t) =>
    claveTipo(t.tipo, uno(t.ficha as { segmento: string | null } | { segmento: string | null }[] | null)?.segmento, (t.contexto as { clasificacion?: string } | null)?.clasificacion)
  );
  // El bloque de agencias se enseña completo aunque aún no tenga envíos.
  for (const tipo of TIPOS_AGENCIA) {
    const k = claveTipo(tipo, "agencia");
    if (!stats.some((s) => s.tipo === k)) stats.push({ tipo: k, enviados: 0, editados: 0, racha_sin_editar: 0, ultimo_envio: null });
  }
  // Agencias en el orden de su flujo (1A → 1B → recordatorio → check-in → propuesta, luego respuestas).
  const orden = (k: string) => {
    const i = TIPOS_AGENCIA.findIndex((t) => claveTipo(t, "agencia") === k);
    return i < 0 ? TIPOS_AGENCIA.length : i;
  };
  return stats
    .map((s): EstadisticaTipoMagia => ({ ...s, segmento: esAgencia(s.tipo) ? "agencia" : "general" }))
    .sort((a, b) => (a.segmento === "agencia" && b.segmento === "agencia" ? orden(a.tipo) - orden(b.tipo) : 0));
}

// ── Pasada de aprendizaje ──────────────────────────────────────────────────

export interface ResultadoAprendizaje {
  fecha?: string;
  dias?: number;
  correcciones: number;
  propuestas: number;
  saltado?: string;
  error?: string;
}

interface Correccion {
  tipo_mensaje: string;
  idioma: string | null;
  borrador: string;
  final: string;
  motivo: string | null;
  creado_en: string;
  tarea: { canal: string | null; ficha: { segmento: string | null } | { segmento: string | null }[] | null } | null;
}

const INSTRUCCIONES = `Eres el analista que mantiene las reglas de redacción del asistente comercial de Alain Zulaika, ilusionista (shows y magia de cerca para ayuntamientos, empresas, asociaciones, hostelería, particulares y agencias de eventos). Los mensajes salen por correo o por WhatsApp, en castellano o euskera.

Te paso las correcciones que Alain ha hecho a los borradores del sistema: el borrador, el texto final que envió y su motivo (si lo escribió). Algunas son descartes ("DESCARTADO: …", final vacío) o elecciones de la alternativa B ("ELIGIÓ LA ALTERNATIVA …"). Cada una lleva tipo de mensaje, canal, idioma y segmento de la ficha.

Tu trabajo: sacar REGLAS nuevas, concretas y cortas, que eviten que el sistema vuelva a cometer lo mismo.
- Una regla solo si el patrón se repite (2+ correcciones) o si el motivo de Alain lo dice de forma general ("siempre", "nunca", "en todos los…").
- Cada regla: una o dos frases imperativas que digan en qué caso aplica. Ejemplo: "En recordatorio_1 por WhatsApp, no repetir lo ya dicho: una frase de recuerdo y la misma pregunta fácil."
- Si solo vale para un canal (WhatsApp o correo), dilo en la regla.
- Agencias (marcadas [agencia]): si la regla solo aplica a agencias, empieza con "Con agencias:". agencia_1a, agencia_1b y el recordatorio_1 de agencias salen de un texto fijo del guion: si Alain lo cambia, la regla dice qué cambiar y en "evidencia" añade "actualizar el guion".
- Nada de cambios puntuales sin patrón (un nombre, una fecha, un precio concreto).
- No propongas bajar precios ni dar cifras que no estén en la ficha.
- No repitas reglas vigentes ni pendientes, y no vuelvas a proponer las descartadas, ni con otras palabras.
- Máximo 5. Si nada merece regla, lista vacía.

Devuelve SOLO JSON: {"propuestas":[{"regla":"…","tipos":["recordatorio_1"],"evidencia":"2 correcciones del 3 y 5-11: quitó …","n":2}]}${SOLO_JSON}`;

function describir(c: Correccion, i: number): string {
  const ficha = uno(c.tarea?.ficha);
  const agencia = ficha?.segmento === "agencia" || c.tipo_mensaje.startsWith("agencia_");
  const cab = [c.creado_en.slice(0, 10), `tipo ${c.tipo_mensaje}`, `canal ${c.tarea?.canal ?? "?"}`, c.idioma ?? "", `segmento ${ficha?.segmento ?? "?"}${agencia ? " [agencia]" : ""}`].filter(Boolean).join(" · ");
  return `### ${i + 1} · ${cab}\nMOTIVO: ${c.motivo ?? "(sin motivo)"}\n--- borrador ---\n${(c.borrador ?? "").slice(0, 1500)}\n--- final ---\n${(c.final ?? "").slice(0, 1500)}`;
}

async function pasada(dias: number, forzar: boolean): Promise<ResultadoAprendizaje> {
  const sb = supabaseCharlas();
  const { data, error } = await sb
    .from("crm_correcciones")
    .select("tipo_mensaje, idioma, borrador, final, motivo, creado_en, tarea:crm_tareas(canal, ficha:crm_fichas(segmento))")
    .eq("carril", CARRIL)
    .gte("creado_en", new Date(Date.now() - dias * 86400000).toISOString())
    .order("creado_en");
  if (error) throw new Error(error.message);
  const correcciones = (data ?? []) as unknown as Correccion[];

  if (!correcciones.length) return { correcciones: 0, propuestas: 0, saltado: `no hay correcciones en los últimos ${dias} días` };
  // Magia mueve poco volumen: basta una corrección con motivo (puede ser general) o dos sin él.
  if (!forzar && correcciones.length < 2 && !correcciones[0].motivo) return { correcciones: 1, propuestas: 0, saltado: "una sola corrección y sin motivo" };

  const [vigentes, pendientes, descartadas] = await Promise.all([
    sb.from("crm_conocimiento").select("texto").eq("carril", CARRIL).eq("clave", "reglas_aprendidas").maybeSingle(),
    sb.from("crm_reglas_propuestas").select("regla").eq("carril", CARRIL).eq("estado", "pendiente"),
    sb.from("crm_reglas_propuestas").select("regla").eq("carril", CARRIL).eq("estado", "descartada").gte("resuelto_en", new Date(Date.now() - 120 * 86400000).toISOString()),
  ]);
  const lista = (r: { data: { regla: string }[] | null }) => (r.data ?? []).map((p) => `- ${p.regla}`).join("\n") || "(ninguna)";

  const usuario = [
    `<reglas_vigentes>\n${vigentes.data?.texto ?? "(ninguna)"}\n</reglas_vigentes>`,
    `<propuestas_pendientes>\n${lista(pendientes)}\n</propuestas_pendientes>`,
    `<propuestas_descartadas_por_alain>\n${lista(descartadas)}\n</propuestas_descartadas_por_alain>`,
    `<correcciones>\n${correcciones.map(describir).join("\n\n")}\n</correcciones>`,
  ].join("\n\n");

  const texto = await llamarClaude({ system: [{ type: "text", text: INSTRUCCIONES }], usuario, proposito: "magia_aprender", maxTokens: 1500 });
  const { propuestas: nuevas, nota } = leerPropuestas(texto);
  if (nuevas.length) {
    const { error: e } = await sb
      .from("crm_reglas_propuestas")
      .insert(nuevas.map((p) => ({ carril: CARRIL, regla: p.regla.trim(), tipos: p.tipos ?? [], evidencia: p.evidencia ?? null, n_correcciones: p.n ?? 0 })));
    if (e) throw new Error(e.message);
  }
  return { correcciones: correcciones.length, propuestas: nuevas.length, ...(nota ? { saltado: nota } : {}) };
}

/**
 * Lee las correcciones de los últimos `dias` y crea propuestas de regla.
 * Deja el resultado (o el error) en config para que el panel lo enseñe.
 */
export async function aprenderMagia(opciones: { dias?: number; forzar?: boolean } = {}): Promise<ResultadoAprendizaje> {
  const dias = opciones.dias ?? 7;
  // Se marca antes de llamar a la IA: aunque falle, la pasada semanal no se repite en cada tick del cron.
  await guardarConfig(CFG.ultima, ahora());
  const r: ResultadoAprendizaje = await pasada(dias, !!opciones.forzar).catch((e) => ({ correcciones: 0, propuestas: 0, error: (e as Error).message }));
  await guardarConfig(CFG.resultado, { ...r, fecha: ahora(), dias });
  if (r.error) throw new Error(r.error);
  return r;
}

export const tocaAprenderMagia = () => tocaSemanal(CFG);

// ── Aprobar, descartar, editar ─────────────────────────────────────────────

async function guardarReglas(texto: string) {
  const { error } = await supabaseCharlas()
    .from("crm_conocimiento")
    .upsert({ carril: CARRIL, clave: "reglas_aprendidas", titulo: "Reglas aprendidas de las correcciones de Alain (magia)", tipo: "reglas", orden: 5, texto, activo: true, actualizado_en: ahora() }, { onConflict: "carril,clave" });
  if (error) throw new Error(error.message);
}

/** Aprueba una propuesta (con el texto que Alain haya dejado): entra numerada y fechada en reglas_aprendidas. */
export async function aprobarPropuestaMagia(id: string, textoFinal?: string): Promise<void> {
  const sb = supabaseCharlas();
  const { data: p } = await sb.from("crm_reglas_propuestas").select("*").eq("id", id).eq("carril", CARRIL).single();
  if (!p) throw new Error("Propuesta no encontrada.");
  if (p.estado !== "pendiente") throw new Error(`La propuesta ya está ${p.estado}.`);
  const regla = (textoFinal ?? p.regla).trim();
  if (!regla) throw new Error("Regla vacía.");
  const { data: k } = await sb.from("crm_conocimiento").select("texto").eq("carril", CARRIL).eq("clave", "reglas_aprendidas").maybeSingle();
  await guardarReglas(añadirReglaNumerada(k?.texto ?? CABECERA_REGLAS, regla, p.tipos));
  await sb.from("crm_reglas_propuestas").update({ estado: "aprobada", texto_final: regla, resuelto_en: ahora() }).eq("id", id);
  await sb.from("crm_correcciones").update({ aplicada_en: ahora() }).eq("carril", CARRIL).is("aplicada_en", null).lte("creado_en", p.creado_en);
}

/** Descarta: la IA la verá como descartada 120 días y no la volverá a proponer. */
export async function descartarPropuestaMagia(id: string): Promise<void> {
  await supabaseCharlas().from("crm_reglas_propuestas").update({ estado: "descartada", resuelto_en: ahora() }).eq("id", id).eq("carril", CARRIL).eq("estado", "pendiente");
}

/** Edición a mano del texto completo de reglas_aprendidas. */
export async function guardarReglasMagia(texto: string): Promise<void> {
  if (!texto.trim()) throw new Error("Texto vacío.");
  await guardarReglas(texto.trim());
}

// ── Lo que lee el panel ────────────────────────────────────────────────────

export async function panelAprendizajeMagia() {
  const sb = supabaseCharlas();
  const [propuestas, reglas, stats, config, correcciones] = await Promise.all([
    sb.from("crm_reglas_propuestas").select("*").eq("carril", CARRIL).order("creado_en", { ascending: false }).limit(50),
    sb.from("crm_conocimiento").select("texto, actualizado_en").eq("carril", CARRIL).eq("clave", "reglas_aprendidas").maybeSingle(),
    estadisticasMagia().catch((e) => e as Error),
    sb.from("charlas_config").select("clave, valor").in("clave", [CFG.resultado, CFG.dia, CFG.hora, "magia_racha_para_automatico"]),
    sb.from("crm_correcciones").select("motivo").eq("carril", CARRIL).gte("creado_en", new Date(Date.now() - 7 * 86400000).toISOString()),
  ]);
  const cfg = Object.fromEntries((config.data ?? []).map((c) => [c.clave, c.valor]));
  const c7 = correcciones.data ?? [];
  const avisos = [propuestas.error?.message, stats instanceof Error ? stats.message : null, correcciones.error?.message].filter(Boolean) as string[];
  return {
    propuestas: propuestas.data ?? [],
    reglas: reglas.data?.texto ?? "",
    reglas_actualizadas: reglas.data?.actualizado_en ?? null,
    stats: stats instanceof Error ? [] : stats,
    racha_para_automatico: Number(cfg.magia_racha_para_automatico ?? 15),
    ultima_pasada: (cfg[CFG.resultado] as ResultadoAprendizaje | undefined) ?? null,
    programada: { dia: Number(cfg[CFG.dia] ?? 0), hora: String(cfg[CFG.hora] ?? "20:00") },
    correcciones_7d: { total: c7.length, sin_motivo: c7.filter((c) => !c.motivo).length },
    avisos,
  };
}
export type PanelAprendizajeMagia = Awaited<ReturnType<typeof panelAprendizajeMagia>>;
