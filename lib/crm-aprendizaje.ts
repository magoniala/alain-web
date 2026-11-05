// Aprendizaje semanal del carril MAGIA del CRM.
//
// Igual que lib/charlas-aprendizaje.ts (y reutiliza sus piezas): cada domingo
// (config magia_aprendizaje_dia / magia_aprendizaje_hora) se leen las
// correcciones de la semana en crm_correcciones —lo que Alain cambió en un
// borrador antes de enviarlo, con su motivo; las opciones B elegidas; los
// descartes con motivo— y la IA propone reglas cortas y concretas. Nada entra
// en crm_conocimiento 'reglas_aprendidas' sin que Alain las apruebe.
//
// Además calcula, por tipo de mensaje, la racha de envíos sin corrección: el
// dato para decidir cuándo un tipo puede pasar a nivel A. El segmento agencia
// va aparte (agencia_1a, agencia_1b y sus recordatorio_1, check_in y
// propuesta), porque su flujo y sus textos no son los de antiguos clientes.

import { supabaseCharlas } from "./charlas";
import { llamarClaude } from "./charlas-ia";
import { tocaSemanal, leerPropuestas, añadirReglaNumerada } from "./charlas-aprendizaje";

const CARRIL = "magia";
const TIPOS_AGENCIA = ["agencia_1a", "agencia_1b", "recordatorio_1", "check_in", "propuesta"] as const;
const CLAVES_SEMANAL = { ultima: "magia_aprendizaje_ultima", dia: "magia_aprendizaje_dia", hora: "magia_aprendizaje_hora" };
const CABECERA_REGLAS = "Reglas que Alain ha fijado revisando la bandeja. Tienen prioridad sobre los guiones cuando chocan.\n";

export interface EstadisticaTipoMagia {
  tipo: string; // clave: "reactivacion", "respuesta:interesado", "agencia_1a", "agencia · check_in"…
  segmento: "agencia" | "general";
  enviados: number;
  editados: number;
  racha_sin_editar: number; // envíos consecutivos (los más recientes) sin corrección
  ultimo_envio: string | null;
}

/** Clave de estadística: las agencias van aparte aunque compartan tipo con otros segmentos. */
function claveTipo(tipo: string, segmento: string | null, clasificacion?: string | null): { clave: string; agencia: boolean } {
  const agencia = segmento === "agencia" || tipo.startsWith("agencia_");
  if (tipo === "respuesta") return { clave: `${agencia ? "agencia · " : ""}respuesta:${clasificacion ?? "otro"}`, agencia };
  if (agencia && !tipo.startsWith("agencia_")) return { clave: `agencia · ${tipo}`, agencia };
  return { clave: tipo, agencia };
}

/** Envíos por tipo de mensaje y racha sin corrección (los más recientes primero). */
export async function estadisticasMagia(): Promise<EstadisticaTipoMagia[]> {
  const { data } = await supabaseCharlas()
    .from("crm_tareas")
    .select("tipo, contexto, editado, resuelto_en, ficha:crm_fichas(segmento)")
    .eq("carril", CARRIL)
    .eq("estado", "enviada")
    .order("resuelto_en", { ascending: false })
    .limit(2000);

  const porTipo = new Map<string, EstadisticaTipoMagia & { rachaCerrada: boolean }>();
  const asegurar = (clave: string, agencia: boolean, ultimo: string | null) => {
    let e = porTipo.get(clave);
    if (!e) {
      e = { tipo: clave, segmento: agencia ? "agencia" : "general", enviados: 0, editados: 0, racha_sin_editar: 0, ultimo_envio: ultimo, rachaCerrada: false };
      porTipo.set(clave, e);
    }
    return e;
  };

  for (const t of data ?? []) {
    const ficha = (Array.isArray(t.ficha) ? t.ficha[0] : t.ficha) as { segmento?: string | null } | null;
    const { clave, agencia } = claveTipo(t.tipo, ficha?.segmento ?? null, (t.contexto as { clasificacion?: string } | null)?.clasificacion);
    const e = asegurar(clave, agencia, t.resuelto_en);
    e.enviados++;
    if (t.editado) {
      e.editados++;
      e.rachaCerrada = true;
    } else if (!e.rachaCerrada) {
      e.racha_sin_editar++;
    }
  }

  // El segmento agencia se enseña completo aunque aún no tenga envíos.
  for (const tipo of TIPOS_AGENCIA) {
    const { clave } = claveTipo(tipo, "agencia");
    asegurar(clave, true, null);
  }

  return [...porTipo.values()]
    .map(({ rachaCerrada, ...e }) => {
      void rachaCerrada;
      return e;
    })
    .sort((a, b) => (a.segmento === b.segmento ? b.enviados - a.enviados : a.segmento === "general" ? -1 : 1));
}

export interface ResumenAprendizajeMagia {
  correcciones: number;
  propuestas: number;
  saltado?: string;
}

interface CorreccionLeida {
  tipo_mensaje: string;
  idioma: string | null;
  borrador: string;
  final: string;
  motivo: string | null;
  creado_en: string;
  tarea: { canal?: string | null; ficha?: { segmento?: string | null } | { segmento?: string | null }[] | null } | { canal?: string | null }[] | null;
}

/** Lee las correcciones de magia de los últimos `dias` y crea propuestas de regla. */
export async function aprenderMagia(opciones: { dias?: number; forzar?: boolean } = {}): Promise<ResumenAprendizajeMagia> {
  const supabase = supabaseCharlas();
  const desde = new Date(Date.now() - (opciones.dias ?? 7) * 86400000).toISOString();

  const { data, error } = await supabase
    .from("crm_correcciones")
    .select("tipo_mensaje, idioma, borrador, final, motivo, creado_en, tarea:crm_tareas(canal, ficha:crm_fichas(segmento))")
    .eq("carril", CARRIL)
    .gte("creado_en", desde)
    .order("creado_en");
  if (error) throw new Error(error.message);
  const correcciones = (data ?? []) as unknown as CorreccionLeida[];

  // Se marca la pasada aunque no haya material: así la semanal no se repite en cada tick del cron.
  await supabase.from("charlas_config").upsert({ clave: CLAVES_SEMANAL.ultima, valor: new Date().toISOString(), actualizado_en: new Date().toISOString() });
  if (!correcciones.length) return { correcciones: 0, propuestas: 0, saltado: "sin correcciones en el periodo" };
  if (correcciones.length < 3 && !opciones.forzar) return { correcciones: correcciones.length, propuestas: 0, saltado: "menos de 3 correcciones: poco material" };

  const [{ data: vigentes }, { data: pendientes }] = await Promise.all([
    supabase.from("crm_conocimiento").select("texto").eq("carril", CARRIL).eq("clave", "reglas_aprendidas").maybeSingle(),
    supabase.from("crm_reglas_propuestas").select("regla").eq("carril", CARRIL).eq("estado", "pendiente"),
  ]);

  const system = [
    {
      type: "text" as const,
      text: `Eres el analista que mantiene las reglas de redacción del asistente comercial de Alain Zulaika, ilusionista (shows y magia de cerca para ayuntamientos, empresas, asociaciones, hostelería, particulares y agencias de eventos). Los mensajes salen por correo o por WhatsApp, en castellano o euskera.

Te paso las correcciones que Alain ha hecho esta semana a los borradores del sistema: el borrador, el texto final que envió y su motivo (si lo escribió). Algunas son descartes ("DESCARTADO: …", final vacío) o elecciones de la alternativa B ("ELIGIÓ LA ALTERNATIVA …"). Cada una lleva tipo de mensaje, canal, idioma y segmento de la ficha.

Tu trabajo: sacar REGLAS nuevas, concretas y cortas, que eviten que el sistema vuelva a cometer lo mismo. Criterios:
- Una regla solo si se repite el patrón (2+ correcciones) o si el motivo de Alain lo dice de forma general ("siempre", "nunca", "en todos los…").
- Formato de cada regla: una o dos frases imperativas, con el caso en que aplica. Ejemplo: "En recordatorio_1 por WhatsApp, no repetir lo que ya se dijo: una frase de recuerdo y la misma pregunta fácil."
- Si la regla solo vale para un canal (WhatsApp o correo), dilo en la regla.
- Segmento agencia (marcado [agencia]): su flujo es distinto (agencia_1a pregunta por el formato, agencia_1b pide a quién escribir, después recordatorio_1, check_in semestral y propuesta del formato que dicen). Si la regla solo aplica a agencias, empiézala con "Con agencias:". agencia_1a y agencia_1b salen de un texto fijo del guion: si Alain lo cambia, la regla dice qué cambiar del texto y en "evidencia" añade que conviene actualizar el guion.
- No repitas reglas que ya existen (te las paso) ni propuestas ya pendientes.
- Si una corrección es un cambio puntual sin patrón (un nombre, una fecha, un precio concreto), no la conviertas en regla.
- Nunca propongas bajar precios ni dar cifras que no estén en la ficha: esas reglas del guion no se tocan.
- Máximo 5 propuestas. Si no hay nada que merezca una regla, devuelve lista vacía.

Devuelve SOLO JSON: {"propuestas":[{"regla":"…","tipos":["recordatorio_1","check_in"],"evidencia":"2 correcciones del 3 y 5-11: quitó …","n":2}]}`,
    },
  ];

  const datosDe = (c: CorreccionLeida) => {
    const tarea = Array.isArray(c.tarea) ? c.tarea[0] : c.tarea;
    const fichaRaw = tarea && "ficha" in tarea ? tarea.ficha : null;
    const ficha = Array.isArray(fichaRaw) ? fichaRaw[0] : fichaRaw;
    const agencia = ficha?.segmento === "agencia" || c.tipo_mensaje.startsWith("agencia_");
    return { canal: tarea?.canal ?? "?", segmento: ficha?.segmento ?? "?", agencia };
  };

  const usuario = [
    `<reglas_vigentes>\n${vigentes?.texto ?? "(ninguna)"}\n</reglas_vigentes>`,
    `<propuestas_pendientes>\n${(pendientes ?? []).map((p) => `- ${p.regla}`).join("\n") || "(ninguna)"}\n</propuestas_pendientes>`,
    `<correcciones>\n${correcciones
      .map((c, i) => {
        const d = datosDe(c);
        return `### ${i + 1} · ${c.creado_en.slice(0, 10)} · tipo ${c.tipo_mensaje} · canal ${d.canal} · ${c.idioma ?? ""} · segmento ${d.segmento}${d.agencia ? " [agencia]" : ""}\nMOTIVO: ${c.motivo ?? "(sin motivo)"}\n--- borrador ---\n${(c.borrador ?? "").slice(0, 1500)}\n--- final ---\n${(c.final ?? "").slice(0, 1500)}`;
      })
      .join("\n\n")}\n</correcciones>`,
  ].join("\n\n");

  const texto = await llamarClaude({ system, usuario, proposito: "magia_aprender", maxTokens: 1500 });
  const propuestas = leerPropuestas(texto);

  if (propuestas.length) {
    const { error: e } = await supabase.from("crm_reglas_propuestas").insert(
      propuestas.map((p) => ({ carril: CARRIL, regla: p.regla.trim(), tipos: p.tipos ?? [], evidencia: p.evidencia ?? null, n_correcciones: p.n ?? 0 }))
    );
    if (e) throw new Error(e.message);
  }
  return { correcciones: correcciones.length, propuestas: propuestas.length };
}

/** ¿Toca la pasada semanal de magia ahora? */
export function tocaAprenderMagia(): Promise<boolean> {
  return tocaSemanal(CLAVES_SEMANAL);
}

async function guardarTextoReglas(texto: string) {
  const { error } = await supabaseCharlas()
    .from("crm_conocimiento")
    .upsert(
      { carril: CARRIL, clave: "reglas_aprendidas", titulo: "Reglas aprendidas de las correcciones de Alain (magia)", tipo: "reglas", orden: 5, texto, activo: true, actualizado_en: new Date().toISOString() },
      { onConflict: "carril,clave" }
    );
  if (error) throw new Error(error.message);
}

/** Aprueba una propuesta: la añade a reglas_aprendidas de magia, numerada y fechada. */
export async function aprobarPropuestaMagia(id: string, textoFinal?: string): Promise<void> {
  const supabase = supabaseCharlas();
  const { data: p } = await supabase.from("crm_reglas_propuestas").select("*").eq("id", id).eq("carril", CARRIL).single();
  if (!p) throw new Error("Propuesta no encontrada.");
  if (p.estado !== "pendiente") throw new Error(`La propuesta ya está ${p.estado}.`);
  const regla = (textoFinal ?? p.regla).trim();
  if (!regla) throw new Error("Regla vacía.");
  const { data: k } = await supabase.from("crm_conocimiento").select("texto").eq("carril", CARRIL).eq("clave", "reglas_aprendidas").maybeSingle();
  await guardarTextoReglas(añadirReglaNumerada(k?.texto ?? CABECERA_REGLAS, regla, p.tipos));
  await supabase.from("crm_reglas_propuestas").update({ estado: "aprobada", texto_final: regla, resuelto_en: new Date().toISOString() }).eq("id", id);
  await supabase.from("crm_correcciones").update({ aplicada_en: new Date().toISOString() }).eq("carril", CARRIL).is("aplicada_en", null).lte("creado_en", p.creado_en);
}

export async function descartarPropuestaMagia(id: string): Promise<void> {
  await supabaseCharlas().from("crm_reglas_propuestas").update({ estado: "descartada", resuelto_en: new Date().toISOString() }).eq("id", id).eq("carril", CARRIL).eq("estado", "pendiente");
}

/** Edición a mano del texto completo de reglas_aprendidas de magia. */
export async function guardarReglasMagia(texto: string): Promise<void> {
  const t = texto.trim();
  if (!t) throw new Error("Texto vacío.");
  await guardarTextoReglas(t);
}
