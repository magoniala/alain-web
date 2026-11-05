// Aprendizaje semanal del carril charlas.
//
// Cada domingo (config aprendizaje_dia / aprendizaje_hora) se leen las
// correcciones de la semana —lo que Alain cambió en un borrador antes de
// enviarlo, con su motivo; las opciones B elegidas; los descartes con
// motivo— y la IA propone reglas nuevas, concretas y cortas. Nada entra en
// el conocimiento sin que Alain las apruebe desde el panel.
//
// Además calcula, por tipo de mensaje, cuántos envíos lleva sin corrección:
// es el dato que decide cuándo un tipo puede pasar a automático (nivel A).

import { supabaseCharlas } from "./charlas";
import { llamarClaude } from "./charlas-ia";

export interface EstadisticaTipo {
  tipo: string;
  enviados: number;
  editados: number;
  racha_sin_editar: number; // envíos consecutivos (los más recientes) sin edición
  ultimo_envio: string | null;
}

/**
 * Agrupa envíos (ordenados del más reciente al más antiguo) por la clave que
 * se le pase y cuenta, por clave, cuántos hay, cuántos se corrigieron y la
 * racha actual sin corrección. Compartido con el carril de magia.
 */
export function calcularRachas<T extends { editado?: boolean | null; resuelto_en: string | null }>(filas: T[], clave: (f: T) => string): EstadisticaTipo[] {
  const porTipo = new Map<string, EstadisticaTipo & { rachaCerrada: boolean }>();
  for (const f of filas) {
    const k = clave(f);
    let e = porTipo.get(k);
    if (!e) {
      e = { tipo: k, enviados: 0, editados: 0, racha_sin_editar: 0, ultimo_envio: f.resuelto_en, rachaCerrada: false };
      porTipo.set(k, e);
    }
    e.enviados++;
    if (f.editado) {
      e.editados++;
      e.rachaCerrada = true;
    } else if (!e.rachaCerrada) {
      e.racha_sin_editar++;
    }
  }
  return [...porTipo.values()]
    .map((e) => ({ tipo: e.tipo, enviados: e.enviados, editados: e.editados, racha_sin_editar: e.racha_sin_editar, ultimo_envio: e.ultimo_envio }))
    .sort((a, b) => b.enviados - a.enviados);
}

/** Envíos por tipo de mensaje y racha sin corrección (los más recientes primero). */
export async function estadisticasPorTipo(): Promise<EstadisticaTipo[]> {
  const supabase = supabaseCharlas();
  const { data } = await supabase
    .from("charlas_tareas")
    .select("tipo, contexto, editado, resuelto_en")
    .eq("estado", "enviada")
    .order("resuelto_en", { ascending: false })
    .limit(2000);
  return calcularRachas(data ?? [], (t) => (t.tipo === "respuesta" ? `respuesta:${(t.contexto as { clasificacion?: string })?.clasificacion ?? "otro"}` : t.tipo));
}

export interface ResumenAprendizaje {
  correcciones: number;
  propuestas: number;
  saltado?: string;
}

/** Lee las correcciones de los últimos `dias` y crea propuestas de regla. */
export async function aprender(opciones: { dias?: number; forzar?: boolean } = {}): Promise<ResumenAprendizaje> {
  const supabase = supabaseCharlas();
  const desde = new Date(Date.now() - (opciones.dias ?? 7) * 86400000).toISOString();

  const { data: correcciones } = await supabase
    .from("charlas_correcciones")
    .select("tipo_mensaje, idioma, borrador, final, motivo, creado_en")
    .gte("creado_en", desde)
    .order("creado_en");

  // Se marca la pasada aunque no haya material: así la semanal no se repite en cada tick del cron.
  await supabase.from("charlas_config").upsert({ clave: "aprendizaje_ultima", valor: new Date().toISOString(), actualizado_en: new Date().toISOString() });
  if (!correcciones?.length) return { correcciones: 0, propuestas: 0, saltado: "sin correcciones en el periodo" };
  if (correcciones.length < 3 && !opciones.forzar) return { correcciones: correcciones.length, propuestas: 0, saltado: "menos de 3 correcciones: poco material" };

  const { data: vigentes } = await supabase.from("charlas_conocimiento").select("texto").eq("clave", "reglas_aprendidas").maybeSingle();
  const { data: pendientes } = await supabase.from("charlas_reglas_propuestas").select("regla").eq("estado", "pendiente");

  const system = [
    {
      type: "text" as const,
      text: `Eres el analista que mantiene las reglas de redacción del asistente comercial de Alain Zulaika (charlas con magia sobre la atención para centros educativos, correos en castellano y euskera).

Te paso las correcciones que Alain ha hecho esta semana a los borradores del sistema: el borrador, el texto final que envió, y su motivo (si lo escribió). Algunas son descartes ("DESCARTADO: …") o elecciones de la alternativa B ("ELIGIÓ LA ALTERNATIVA …").

Tu trabajo: sacar REGLAS nuevas, concretas y cortas, que eviten que el sistema vuelva a cometer lo mismo. Criterios:
- Una regla solo si se repite el patrón (2+ correcciones) o si el motivo de Alain lo dice de forma general ("siempre", "nunca", "en todos los…").
- Formato de cada regla: una o dos frases imperativas, con el caso en que aplica. Ejemplo: "En respuestas a 'da_mes', no repetir la pregunta del mes: confirmar en una línea y cerrar."
- No repitas reglas que ya existen (te las paso) ni propuestas ya pendientes.
- Si una corrección es un cambio puntual sin patrón (un nombre, un dato), no la conviertas en regla.
- Máximo 5 propuestas. Si no hay nada que merezca una regla, devuelve lista vacía.

Devuelve SOLO JSON: {"propuestas":[{"regla":"…","tipos":["da_mes","recordatorio_1"],"evidencia":"2 correcciones del 28 y 30-10: quitó …","n":2}]}`,
    },
  ];

  const usuario = [
    `<reglas_vigentes>\n${vigentes?.texto ?? "(ninguna)"}\n</reglas_vigentes>`,
    `<propuestas_pendientes>\n${(pendientes ?? []).map((p) => `- ${p.regla}`).join("\n") || "(ninguna)"}\n</propuestas_pendientes>`,
    `<correcciones>\n${correcciones
      .map(
        (c, i) =>
          `### ${i + 1} · ${c.creado_en.slice(0, 10)} · tipo ${c.tipo_mensaje} · ${c.idioma ?? ""}\nMOTIVO: ${c.motivo ?? "(sin motivo)"}\n--- borrador ---\n${(c.borrador ?? "").slice(0, 1500)}\n--- final ---\n${(c.final ?? "").slice(0, 1500)}`
      )
      .join("\n\n")}\n</correcciones>`,
  ].join("\n\n");

  const texto = await llamarClaude({ system, usuario, proposito: "aprender", maxTokens: 1500 });
  const propuestas = leerPropuestas(texto);

  if (propuestas.length) {
    await supabase.from("charlas_reglas_propuestas").insert(
      propuestas.map((p) => ({ regla: p.regla.trim(), tipos: p.tipos ?? [], evidencia: p.evidencia ?? null, n_correcciones: p.n ?? 0 }))
    );
  }
  return { correcciones: correcciones.length, propuestas: propuestas.length };
}

/**
 * ¿Toca la pasada semanal ahora? (día y hora de config, una vez por semana)
 * Compartido con el carril de magia: solo cambian los nombres de las claves
 * de config (charlas: aprendizaje_*, magia: magia_aprendizaje_*).
 */
export async function tocaSemanal(claves: { ultima: string; dia: string; hora: string }): Promise<boolean> {
  // Se ejecuta en la primera pasada del cron posterior al momento semanal
  // configurado (domingo 20:00 por defecto). El cron no corre en fin de
  // semana, así que en la práctica es el lunes a las 7:00: lo que importa es
  // que pase una vez por semana, no la hora exacta.
  const supabase = supabaseCharlas();
  const { data } = await supabase.from("charlas_config").select("clave, valor").in("clave", [claves.ultima, claves.dia, claves.hora]);
  const cfg = Object.fromEntries((data ?? []).map((c) => [c.clave, c.valor]));
  const ahora = new Date();
  const madrid = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(ahora);
  const dias: Record<string, number> = { dom: 0, lun: 1, mar: 2, mié: 3, jue: 4, vie: 5, sáb: 6 };
  const dia = dias[(madrid.find((p) => p.type === "weekday")?.value ?? "").replace(".", "").toLowerCase()] ?? -1;
  if (dia < 0) return false;
  const h = Number(madrid.find((p) => p.type === "hour")?.value) * 60 + Number(madrid.find((p) => p.type === "minute")?.value);
  const [hh, mm] = String(cfg[claves.hora] ?? "20:00").split(":").map(Number);
  const objetivoDia = Number(cfg[claves.dia] ?? 0);
  const objetivoMin = hh * 60 + mm;
  // Minutos transcurridos desde la última vez que se cumplió (día, hora) objetivo.
  let desde = ((dia - objetivoDia + 7) % 7) * 1440 + (h - objetivoMin);
  if (desde < 0) desde += 7 * 1440;
  const ultimaOcurrencia = Date.now() - desde * 60000;
  const ultima = cfg[claves.ultima] ? new Date(String(cfg[claves.ultima])).getTime() : 0;
  return ultima < ultimaOcurrencia;
}

export async function tocaAprender(): Promise<boolean> {
  return tocaSemanal({ ultima: "aprendizaje_ultima", dia: "aprendizaje_dia", hora: "aprendizaje_hora" });
}

export interface PropuestaIA {
  regla: string;
  tipos?: string[];
  evidencia?: string;
  n?: number;
}

/** Lee el JSON de propuestas que devuelve la IA (tolera texto alrededor). */
export function leerPropuestas(texto: string): PropuestaIA[] {
  const ini = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (ini < 0 || fin < ini) throw new Error("La IA no devolvió JSON.");
  const json = JSON.parse(texto.slice(ini, fin + 1)) as { propuestas?: PropuestaIA[] };
  return (json.propuestas ?? []).filter((p) => p.regla?.trim()).slice(0, 5);
}

/** Añade una regla numerada y fechada al texto de reglas_aprendidas. */
export function añadirReglaNumerada(actual: string, regla: string, tipos?: string[] | null): string {
  const n = (actual.match(/^\d+\.\s/gm)?.length ?? 0) + 1;
  const fecha = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date()).split("-").reverse().join("-");
  return `${actual.replace(/\s+$/, "")}\n\n${n}. (${fecha}) ${regla}${tipos?.length ? ` [tipos: ${tipos.join(", ")}]` : ""}`;
}

/** Aprueba una propuesta: la añade a reglas_aprendidas numerada y fechada. */
export async function aprobarPropuesta(id: string, textoFinal?: string): Promise<void> {
  const supabase = supabaseCharlas();
  const { data: p } = await supabase.from("charlas_reglas_propuestas").select("*").eq("id", id).single();
  if (!p) throw new Error("Propuesta no encontrada.");
  const regla = (textoFinal ?? p.regla).trim();
  const { data: k } = await supabase.from("charlas_conocimiento").select("texto").eq("clave", "reglas_aprendidas").maybeSingle();
  const actual = k?.texto ?? "Reglas que Alain ha fijado revisando la bandeja. Tienen prioridad sobre los guiones cuando chocan.\n";
  const nuevo = añadirReglaNumerada(actual, regla, p.tipos);
  await supabase.from("charlas_conocimiento").upsert({ clave: "reglas_aprendidas", titulo: "Reglas aprendidas de las correcciones de Alain", tipo: "reglas", orden: 5, texto: nuevo, activo: true, actualizado_en: new Date().toISOString() });
  await supabase.from("charlas_reglas_propuestas").update({ estado: "aprobada", texto_final: regla, resuelto_en: new Date().toISOString() }).eq("id", id);
  await supabase.from("charlas_correcciones").update({ aplicada_en: new Date().toISOString() }).is("aplicada_en", null).lte("creado_en", p.creado_en);
}
