import type { SupabaseClient } from "@supabase/supabase-js";
import { etiquetaMagia, faseMagia } from "./crm-motor";
import { contextoConDeshacer, tareaPrevia } from "./bandeja-deshacer";

// Tarjetas de magia que ya no tocan (17-11-2026).
//
// El motor crea una tarjeta según el estado que tenía la ficha en ese momento
// (localizar email, primer mail, recordatorio…). Si después la ficha cambia de
// fase por otro lado (Alain la pasa a 8 Perdido o 9 Aparcado en el panel, la
// cambia en Obsidian, otra tarjeta la mueve), la tarjeta se quedaba abierta
// para siempre: «Descartar» era la única salida.
//
// Regla: una tarjeta PROGRAMADA (la crea el motor por fecha, no por un correo
// suyo) se cierra sola cuando la ficha ya no está en la fase en la que se creó.
// Eso incluye pasar a 8 o 9 y que una agencia deje de estar en 0. Las tarjetas
// que nacen de un correo entrante NO se tocan: si un perdido escribe, Alain lo
// tiene que ver.
//
// El cierre queda en «Últimos cambios» con «Deshacer» (resuelto_por = sistema).
// Una tarjeta que Alain ya ha devuelto a la bandeja con «Deshacer» no se vuelve
// a cerrar sola.
//
// Se ejecuta al cargar la bandeja (GET) y al principio de cada pasada del motor.

interface TareaAbierta {
  id: string;
  tipo: string;
  estado: string;
  motivo: unknown;
  cambios_crm: unknown;
  resuelto_en: unknown;
  resuelto_por: unknown;
  nota_para_alain: string | null;
  mensaje_entrante_id: string | null;
  contexto: Record<string, unknown> | null;
  ficha: { estado: string | null } | null;
}

// Tarjetas creadas antes de guardar `estado_ficha` en el contexto: la fase en la
// que tienen sentido se deduce del tipo (como en decidirMagia).
const PRIMER_TRAMO = new Set(["agencia_1a", "agencia_1b", "primer_contacto"]);
function fasesDeTipo(t: TareaAbierta): number[] | null {
  if (PRIMER_TRAMO.has(t.tipo)) return [0, 1, 2];
  if (t.tipo === "localizar_contacto") return /ya escribiste a mano/i.test(t.nota_para_alain ?? "") ? [3] : [0, 1, 2];
  if (t.tipo === "recordatorio_1" || t.tipo === "recordatorio_2") return [3];
  if (t.tipo === "check_in") return [9];
  return null;
}

/** Motivo por el que la tarjeta ya no toca, o null si sigue siendo válida. */
export function motivoObsoleta(t: TareaAbierta): string | null {
  if (!t.ficha || t.mensaje_entrante_id) return null;
  if (!(t.contexto as { programada?: boolean } | null)?.programada) return null;
  const deshecho = (t.contexto?.deshacer as { deshecho_en?: string } | undefined)?.deshecho_en;
  if (deshecho) return null;
  const ahora = faseMagia(t.ficha.estado);
  const creada = t.contexto?.estado_ficha as string | undefined;
  if (creada) return faseMagia(creada) !== ahora ? `la ficha ha pasado de «${creada}» a «${t.ficha.estado}»` : null;
  const fases = fasesDeTipo(t);
  if (fases) return fases.includes(ahora) ? null : `la ficha está en «${t.ficha.estado}»`;
  // Tipo sin fase clara (llamada, revisar correo, propuesta…): solo 8 y 9 la cierran.
  return ahora === 8 || ahora === 9 ? `la ficha está en «${t.ficha.estado}»` : null;
}

/**
 * Cierra las tarjetas programadas de magia que ya no tocan.
 * `soloComprobar` = no escribe nada, solo devuelve la lista.
 */
export async function cerrarTareasObsoletasMagia(sb: SupabaseClient, opciones: { soloComprobar?: boolean } = {}) {
  const { data, error } = await sb
    .from("crm_tareas")
    .select("id, tipo, estado, motivo, cambios_crm, resuelto_en, resuelto_por, nota_para_alain, mensaje_entrante_id, contexto, ficha:crm_fichas(nombre, estado)")
    .eq("carril", "magia")
    .in("estado", ["revisar", "pendiente", "error"]);
  if (error) throw new Error(`tareas obsoletas: ${error.message}`);
  const cerradas: { id: string; nombre: string; tipo: string; motivo: string }[] = [];
  for (const t of (data ?? []) as unknown as (TareaAbierta & { ficha: { nombre: string; estado: string | null } | null })[]) {
    const m = motivoObsoleta(t);
    if (!m) continue;
    cerradas.push({ id: t.id, nombre: t.ficha?.nombre ?? "—", tipo: t.tipo, motivo: m });
    if (opciones.soloComprobar) continue;
    const resumen = `Cerrada sola: ${etiquetaMagia(t.tipo)} (${m})`;
    await sb
      .from("crm_tareas")
      .update({
        estado: "descartada",
        motivo: `Ya no toca: ${m}`,
        resuelto_en: new Date().toISOString(),
        resuelto_por: "sistema",
        contexto: contextoConDeshacer(t.contexto, { accion: "cerrar", resumen, tarea_previa: tareaPrevia(t as unknown as Record<string, unknown>), antes: {}, despues: {}, interacciones: [] }),
      })
      .eq("id", t.id)
      .eq("estado", t.estado);
  }
  return cerradas;
}
