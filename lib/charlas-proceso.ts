// Proceso de la bandeja de charlas: correos entrantes nuevos → IA → tareas.
//
// Fase 1: todas las tareas quedan en estado 'revisar'. Nada sale sin que
// Alain pulse "Enviar" en el panel. El nivel (B/C) solo ordena la bandeja:
// C = lead caliente o caso delicado, arriba del todo.

import { supabaseCharlas, faseDeEstado } from "./charlas";
import { procesarConIA, type ResultadoIA } from "./charlas-ia";

async function config<T>(clave: string, defecto: T): Promise<T> {
  const { data } = await supabaseCharlas().from("charlas_config").select("valor").eq("clave", clave).maybeSingle();
  return (data?.valor as T) ?? defecto;
}

const CALIENTES = new Set(["interesado_fechas", "otro", "pide_contacto_ayuntamiento"]);

export interface ResumenProceso {
  procesados: number;
  ya_respondidos: number;
  tareas: number;
  errores: string[];
}

export async function procesarPendientes(opciones: { presupuestoMs: number; limite?: number }): Promise<ResumenProceso> {
  const inicio = Date.now();
  const supabase = supabaseCharlas();
  const limite = opciones.limite ?? Number(await config("procesar_por_ejecucion", 4));
  const res: ResumenProceso = { procesados: 0, ya_respondidos: 0, tareas: 0, errores: [] };

  const { data: pendientes } = await supabase
    .from("charlas_mensajes")
    .select("*")
    .eq("direccion", "entrante")
    .eq("estado", "nuevo")
    .not("centro_id", "is", null)
    .lt("intentos", 3)
    .order("fecha", { ascending: true })
    .limit(limite * 3);

  for (const m of pendientes ?? []) {
    if (res.procesados >= limite) break;
    // Una llamada a la IA tarda 10-25 s: no se empieza otra si no da tiempo.
    if (Date.now() - inicio > opciones.presupuestoMs) break;

    try {
      // ¿Ya contestado desde Mail? Entonces no hay nada que hacer.
      const { data: posterior } = await supabase
        .from("charlas_mensajes")
        .select("id")
        .eq("centro_id", m.centro_id)
        .eq("direccion", "saliente")
        .gt("fecha", m.fecha)
        .limit(1);
      if (posterior?.length) {
        await supabase.from("charlas_mensajes").update({ estado: "procesado", resumen: "Ya respondido desde Mail" }).eq("id", m.id);
        res.ya_respondidos++;
        continue;
      }

      const r = await procesarMensaje(m.id);
      res.procesados++;
      if (r.tarea) res.tareas++;
    } catch (e) {
      const intentos = (m.intentos ?? 0) + 1;
      await supabase
        .from("charlas_mensajes")
        .update({ intentos, estado: intentos >= 3 ? "error" : "nuevo", error: (e as Error).message.slice(0, 500) })
        .eq("id", m.id);
      res.errores.push(`${m.asunto ?? m.id}: ${(e as Error).message}`);
    }
  }
  return res;
}

/** Procesa un mensaje entrante concreto (también se usa al asignar uno a mano y al regenerar). */
export async function procesarMensaje(mensajeId: string, instruccion?: string): Promise<{ resultado: ResultadoIA; tarea: string | null }> {
  const supabase = supabaseCharlas();
  const umbral = Number(await config("umbral_confianza", 0.8));

  const { data: m, error } = await supabase.from("charlas_mensajes").select("*").eq("id", mensajeId).single();
  if (error || !m) throw new Error("Mensaje no encontrado.");
  if (!m.centro_id) throw new Error("El mensaje no tiene centro asignado.");

  const [{ data: centro }, { data: registro }, { data: hilo }] = await Promise.all([
    supabase.from("charlas_centros").select("*").eq("id", m.centro_id).single(),
    supabase.from("charlas_interacciones").select("fecha, canal, texto").eq("centro_id", m.centro_id).order("fecha", { ascending: true, nullsFirst: true }).order("orden"),
    supabase
      .from("charlas_mensajes")
      .select("direccion, fecha, de, asunto, texto")
      .eq("centro_id", m.centro_id)
      .neq("id", m.id)
      .lt("fecha", m.fecha ?? new Date().toISOString())
      .order("fecha", { ascending: false })
      .limit(6),
  ]);
  if (!centro) throw new Error("Centro no encontrado.");

  // La ficha sin campos internos que no aportan a la IA.
  const { secciones_extra, creado_en, actualizado_en, actualizado_por, id, ...ficha } = centro;
  void secciones_extra; void creado_en; void actualizado_en; void actualizado_por; void id;

  const resultado = await procesarConIA(
    {
      centro: ficha,
      registro: (registro ?? []).slice(-40),
      hilo: (hilo ?? []).reverse(),
      correo: { de: m.de, asunto: m.asunto, fecha: m.fecha, texto: m.texto ?? "" },
      instruccion_extra: instruccion,
    },
    m.id
  );

  // Nivel: C arriba del todo (lead caliente o delicado), B el resto.
  const nivel =
    resultado.necesita_alain ||
    CALIENTES.has(resultado.clasificacion) ||
    resultado.confianza < umbral ||
    faseDeEstado(centro.estado) === 6 ||
    centro.nivel_autonomia === "C"
      ? "C"
      : "B";

  const idiomaRespuesta: "es" | "eu" =
    resultado.idioma === "eu" || (resultado.idioma === "mixto" && (centro.euskera === "sí" || centro.euskera === "parcial")) ? "eu" : "es";

  const cambios: Record<string, unknown> = { ...resultado.cambios_crm };
  if (resultado.datos?.persona_nueva?.email) cambios.contacto_nuevo = resultado.datos.persona_nueva;
  for (const k of Object.keys(cambios)) if (cambios[k] === null || cambios[k] === undefined) delete cambios[k];

  // Primera vez que se procesa: queda en el Registro que ha llegado.
  if (!instruccion) {
    await supabase.from("charlas_interacciones").insert({
      centro_id: m.centro_id,
      fecha: (m.fecha ?? new Date().toISOString()).slice(0, 10),
      canal: "Recibido",
      texto: resultado.resumen,
      raw: null,
      orden: 500,
      origen: "sistema",
      mensaje_id: m.id,
    });
  }

  await supabase
    .from("charlas_mensajes")
    .update({
      estado: "procesado",
      clasificacion: resultado.clasificacion,
      clasificacion_confianza: resultado.confianza,
      datos_extraidos: resultado.datos ?? {},
      idioma: resultado.idioma,
      resumen: resultado.resumen,
      error: null,
    })
    .eq("id", m.id);

  // Nada que contestar ni que cambiar: no hay tarea.
  if (!resultado.responder && Object.keys(cambios).length === 0) return { resultado, tarea: null };

  // Una respuesta nueva sustituye a la que hubiera sin enviar para ese centro.
  await supabase
    .from("charlas_tareas")
    .update({ estado: "descartada", motivo: "Sustituida por una respuesta más reciente", resuelto_en: new Date().toISOString(), resuelto_por: "sistema" })
    .eq("centro_id", m.centro_id)
    .in("estado", ["revisar", "pendiente"])
    .neq("mensaje_entrante_id", m.id);

  const fila = {
    centro_id: m.centro_id,
    tipo: resultado.responder ? "respuesta" : "actualizar_crm",
    nivel,
    estado: "revisar",
    idioma: idiomaRespuesta,
    mensaje_entrante_id: m.id,
    contexto: { clasificacion: resultado.clasificacion, confianza: resultado.confianza, resumen: resultado.resumen, datos: resultado.datos, instruccion: instruccion ?? null },
    borrador_asunto: resultado.respuesta?.asunto ?? null,
    borrador_texto: resultado.respuesta?.cuerpo ?? null,
    adjuntar_dossier: resultado.respuesta?.adjuntar_dossier ?? false,
    cambios_crm: cambios,
    destinatario: m.de,
    nota_para_alain: resultado.nota_para_alain,
    editado: false,
  };

  const { data: existente } = await supabase
    .from("charlas_tareas")
    .select("id")
    .eq("mensaje_entrante_id", m.id)
    .in("estado", ["revisar", "pendiente"])
    .maybeSingle();

  if (existente) {
    await supabase.from("charlas_tareas").update(fila).eq("id", existente.id);
    return { resultado, tarea: existente.id };
  }
  const { data: nueva, error: errT } = await supabase.from("charlas_tareas").insert(fila).select("id").single();
  if (errT) throw new Error(`crear tarea: ${errT.message}`);
  return { resultado, tarea: nueva.id };
}
