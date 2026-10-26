// Altas en newsletter_contactos según la configuración de embudos.
//
// Qué secuencia recibe un alta nueva ya no está escrito en cada ruta: lo
// dicen las tablas embudos / embudo_origenes / secuencias (ver embudos.sql),
// que se podrán cambiar desde /admin. Cada landing llama a altaEmbudo() con
// su `origen` en vez de hacer su propio upsert.
//
// Reglas:
//  - Un origen sin embudo configurado, o una configuración que no se puede
//    leer, va SOLO a la newsletter diaria. Nunca entra en una secuencia por
//    omisión (es justo lo que pasó con recibe_secuencia DEFAULT true).
//  - A quien ya estaba en newsletter_contactos no se le toca nada: ni la
//    secuencia, ni el idioma, ni el origen.
//  - Solo las secuencias de motor «nurture» viven en newsletter_contactos.
//    Las «legacy» (mision, comodin) las lleva /api/sequence/cron con su
//    propia tabla, y la persona sigue en la newsletter a la vez.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface ConfigEmbudo {
  embudo: string;
  secuencia: string | null;
  motor: "nurture" | "legacy" | "unico" | null;
  idioma_modo: "landing" | "es" | "eu";
}

let cliente: SupabaseClient | null = null;
function supabase() {
  if (!cliente) cliente = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  return cliente;
}

/** La configuración del embudo de un origen. null si no hay o no se puede leer. */
export async function configDeOrigen(origen: string): Promise<ConfigEmbudo | null> {
  try {
    const { data: o, error } = await supabase().from("embudo_origenes").select("embudo").eq("origen", origen).maybeSingle();
    if (error || !o) {
      if (error) console.error(`embudos: no se ha podido leer el origen ${origen}:`, error.message);
      return null;
    }
    const { data: e, error: e2 } = await supabase()
      .from("embudos")
      .select("slug, secuencia, idioma_modo, activo, secuencias(motor, activa)")
      .eq("slug", o.embudo)
      .maybeSingle();
    if (e2 || !e) {
      if (e2) console.error(`embudos: no se ha podido leer el embudo ${o.embudo}:`, e2.message);
      return null;
    }
    const sec = (Array.isArray(e.secuencias) ? e.secuencias[0] : e.secuencias) as { motor: ConfigEmbudo["motor"]; activa: boolean } | null;
    // Embudo o secuencia desactivados: como si no tuviera secuencia.
    const conSecuencia = e.activo && e.secuencia && sec?.activa;
    return {
      embudo: e.slug,
      secuencia: conSecuencia ? e.secuencia : null,
      motor: conSecuencia ? sec!.motor : null,
      idioma_modo: e.idioma_modo,
    };
  } catch (err) {
    console.error(`embudos: no se ha podido leer la configuración de ${origen}:`, err);
    return null;
  }
}

export interface AltaEmbudoInput {
  origen: string;
  email: string;
  nombre?: string | null;
  // El idioma de la landing. Se usa si el embudo está en modo «landing».
  idioma?: string | null;
  // Asignación a mano desde /admin. Pisa la del embudo solo en un alta nueva.
  secuenciaManual?: string | null;
}

export interface AltaEmbudoResultado {
  config: ConfigEmbudo | null;
  // La fila creada; null si el email ya estaba (o si falló).
  creado: Record<string, unknown> | null;
  error?: string;
}

/**
 * Da de alta en newsletter_contactos según el embudo del origen. Si el
 * email ya existía, no cambia nada.
 */
export async function altaEmbudo(input: AltaEmbudoInput): Promise<AltaEmbudoResultado> {
  const config = await configDeOrigen(input.origen);

  const idiomaLanding = input.idioma === "eu" ? "eu" : "es";
  const idioma = config && config.idioma_modo !== "landing" ? config.idioma_modo : idiomaLanding;

  const manual = input.secuenciaManual ?? null;
  const secuencia = manual ?? (config?.motor === "nurture" ? config.secuencia : null);

  const base = {
    email: input.email,
    nombre: input.nombre ?? null,
    idioma,
    origen: input.origen,
    // El cron de nurture todavía lee recibe_secuencia (hasta la fase 4).
    recibe_secuencia: secuencia === "nurture",
  };
  const extra = {
    secuencia_activa: secuencia,
    secuencia_asignada_por: secuencia ? (manual ? "manual" : "embudo") : null,
    embudo: config?.embudo ?? null,
  };

  const upsert = (fila: Record<string, unknown>) =>
    supabase()
      .from("newsletter_contactos")
      .upsert(fila, { onConflict: "email", ignoreDuplicates: true })
      .select()
      .maybeSingle();

  let { data, error } = await upsert({ ...base, ...extra });
  // Si las columnas nuevas aún no existen (embudos.sql sin ejecutar), el
  // alta sale igual, sin ellas. Que un despliegue antes de tiempo no deje a
  // nadie fuera de la newsletter.
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    console.error("embudos: faltan las columnas de embudos.sql; alta sin ellas:", error.message);
    ({ data, error } = await upsert(base));
  }
  if (error) {
    console.error(`embudos: error en el alta de ${input.email} (${input.origen}):`, error.message);
    return { config, creado: null, error: error.message };
  }
  return { config, creado: (data as Record<string, unknown> | null) ?? null };
}
