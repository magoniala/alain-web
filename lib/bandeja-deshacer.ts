import type { SupabaseClient } from "@supabase/supabase-js";

// «Deshacer» de la bandeja (Charlas y Magia).
//
// Cuando Alain aplica, aplaza o descarta una tarjeta desde el panel, se guarda en
// la propia tarea (contexto.deshacer) una foto de lo que había antes: los campos
// de la ficha que se tocaron, las líneas de Registro que se crearon, las
// correcciones y contactos añadidos y cómo estaba la tarea. Con eso, «Deshacer»
// lo deja todo como estaba y la tarjeta vuelve a la bandeja.
//
// Lo que sale de verdad (correos, WhatsApp, formularios) no se deshace: esas
// acciones no guardan foto.
//
// Si un campo de la ficha ha cambiado otra vez después (lo ha tocado el motor,
// otra tarjeta o Alain a mano), ese campo NO se pisa: se deja y se avisa.

export type Carril = "charlas" | "crm";

const TABLAS = {
  charlas: { tareas: "charlas_tareas", fichas: "charlas_centros", fk: "centro_id", interacciones: "charlas_interacciones", correcciones: "charlas_correcciones", contactos: "charlas_contactos" },
  crm: { tareas: "crm_tareas", fichas: "crm_fichas", fk: "ficha_id", interacciones: "crm_interacciones", correcciones: "crm_correcciones", contactos: null },
} as const;

export interface Huella {
  /** Valores de la ficha antes del cambio (solo los campos tocados). */
  antes: Record<string, unknown>;
  /** Valores que se escribieron (para saber si alguien los ha cambiado después). */
  despues: Record<string, unknown>;
  interacciones: string[];
  correcciones?: string[];
  contactos?: string[];
}

export interface Deshacer extends Huella {
  /** cerrar = la cerró el sistema sola (lib/crm-tareas-obsoletas). */
  accion: "aplicar" | "aplazar" | "descartar" | "cerrar";
  /** Texto corto para la lista de «Últimos cambios». */
  resumen: string;
  en: string;
  tarea_previa: { estado: string; motivo: unknown; cambios_crm: unknown; resuelto_en: unknown; resuelto_por: unknown };
  deshecho_en?: string;
}

/** Lee de la ficha los campos que se van a cambiar (sin `actualizado_por`). */
export async function fotoFicha(sb: SupabaseClient, carril: Carril, fichaId: string, campos: string[]): Promise<Record<string, unknown>> {
  const c = campos.filter((k) => k !== "actualizado_por");
  if (!c.length || !fichaId) return {};
  const { data } = await sb.from(TABLAS[carril].fichas).select(c.join(",")).eq("id", fichaId).maybeSingle();
  return (data ?? {}) as unknown as Record<string, unknown>;
}

export function sinActualizadoPor(o: Record<string, unknown>) {
  const { actualizado_por: _, ...resto } = o;
  return resto;
}

/** Foto de la tarea tal y como estaba antes de resolverla. */
export function tareaPrevia(t: Record<string, unknown>): Deshacer["tarea_previa"] {
  return { estado: String(t.estado ?? "revisar"), motivo: t.motivo ?? null, cambios_crm: t.cambios_crm ?? null, resuelto_en: t.resuelto_en ?? null, resuelto_por: t.resuelto_por ?? null };
}

/** Contexto de la tarea con la foto para deshacer añadida. */
export function contextoConDeshacer(contexto: unknown, d: Omit<Deshacer, "en">): Record<string, unknown> {
  return { ...((contexto ?? {}) as Record<string, unknown>), deshacer: { ...d, en: new Date().toISOString() } };
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export async function deshacer(sb: SupabaseClient, carril: Carril, tareaId: string): Promise<{ ok: true; avisos: string[] }> {
  const T = TABLAS[carril];
  const { data: t, error } = await sb.from(T.tareas).select("*").eq("id", tareaId).single();
  if (error || !t) throw new Error("No encuentro esa tarea.");
  const d = (t.contexto as Record<string, unknown> | null)?.deshacer as Deshacer | undefined;
  if (!d) throw new Error("Este cambio no se puede deshacer (no hay foto de cómo estaba).");
  if (d.deshecho_en) throw new Error("Este cambio ya se deshizo.");
  if (t.estado === "revisar" || t.estado === "error") throw new Error("La tarjeta ya está otra vez en la bandeja.");
  if (t.estado === "enviada") throw new Error("Esta tarjeta acabó enviando un mensaje: eso no se puede deshacer.");

  const avisos: string[] = [];
  const fichaId = t[T.fk] as string | null;

  // 1. Ficha: cada campo vuelve a su valor anterior solo si sigue como lo dejamos.
  const campos = Object.keys(d.despues ?? {});
  if (fichaId && campos.length) {
    const actual = await fotoFicha(sb, carril, fichaId, campos);
    const vuelta: Record<string, unknown> = {};
    for (const k of campos) {
      if (igual(actual[k], d.despues[k])) vuelta[k] = d.antes?.[k] ?? null;
      else avisos.push(`«${k.replace(/_/g, " ")}» ha cambiado después y no se ha tocado`);
    }
    if (Object.keys(vuelta).length) {
      const { error: e } = await sb.from(T.fichas).update({ ...vuelta, actualizado_por: "panel" }).eq("id", fichaId);
      if (e) throw new Error(`No se pudo restaurar la ficha: ${e.message}`);
    }
  }

  // 2. Lo que se añadió: líneas de Registro, correcciones y contactos.
  if (d.interacciones?.length) await sb.from(T.interacciones).delete().in("id", d.interacciones);
  if (d.correcciones?.length) await sb.from(T.correcciones).delete().in("id", d.correcciones);
  if (d.contactos?.length && T.contactos) await sb.from(T.contactos).delete().in("id", d.contactos);

  // 3. La tarjeta vuelve a la bandeja como estaba.
  const p = d.tarea_previa;
  const contexto = { ...(t.contexto as Record<string, unknown>), deshacer: { ...d, deshecho_en: new Date().toISOString() } };
  const { error: e2 } = await sb
    .from(T.tareas)
    .update({ estado: p.estado === "error" ? "error" : "revisar", motivo: p.motivo, cambios_crm: p.cambios_crm, resuelto_en: null, resuelto_por: null, contexto })
    .eq("id", tareaId);
  if (e2) throw new Error(`La ficha se restauró, pero la tarjeta no volvió a la bandeja: ${e2.message}`);

  return { ok: true, avisos };
}

/** Últimas tarjetas resueltas (por Alain o cerradas solas) que se pueden deshacer (para el panel). */
export async function recientesDeshacibles(sb: SupabaseClient, carril: Carril, extra?: { carril?: string }) {
  const T = TABLAS[carril];
  const relacion = carril === "charlas" ? "ficha:charlas_centros(nombre)" : "ficha:crm_fichas(nombre)";
  let q = sb
    .from(T.tareas)
    .select(`id, tipo, estado, resuelto_en, contexto, ${relacion}`)
    // También las que cerró el sistema solo (tarjetas que ya no tocaban): llevan foto y se pueden deshacer.
    .in("resuelto_por", ["alain", "sistema"])
    .in("estado", ["hecha", "descartada"])
    .gte("resuelto_en", new Date(Date.now() - 48 * 3600000).toISOString())
    .not("contexto->deshacer", "is", null)
    .order("resuelto_en", { ascending: false })
    .limit(20);
  if (extra?.carril) q = q.eq("carril", extra.carril);
  const { data } = await q;
  return (data ?? [])
    .map((t) => {
      const d = (t.contexto as Record<string, unknown> | null)?.deshacer as Deshacer | undefined;
      const ficha = t.ficha as unknown as { nombre?: string } | null;
      return d && !d.deshecho_en ? { id: t.id as string, nombre: ficha?.nombre ?? "—", resumen: d.resumen, en: t.resuelto_en as string } : null;
    })
    .filter(Boolean)
    .slice(0, 10);
}
