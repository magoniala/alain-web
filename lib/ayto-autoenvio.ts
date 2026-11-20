// Envío automático de la vía Ayuntamientos.
//
// Regla de Alain (20-11-2026): cuando un tipo de mail lleva `ayto_racha_automatico`
// envíos seguidos sin que lo corrija (20 por defecto), ese tipo pasa a salir solo.
// La racha es la misma que enseña «Aprendizajes y métricas»: envíos seguidos en
// los que Alain no tocó el texto.
//
// Qué NUNCA sale solo, aunque el tipo tenga racha:
//   · tarjetas de nivel C (lo que la IA o el flujo marcan para Alain),
//   · tarjetas con dos versiones (alternativa) o con «me falta información»,
//   · ayuntamientos en 6 En conversación,
//   · tipos que Alain ha devuelto a manual (ayto_tipos_manuales),
//   · en modo prueba, fuera de horario (L-V 9:00-18:00) o pasado el tope diario.
// El envío usa exactamente el mismo camino que el botón «Enviar» (lib/charlas-envio.ts)
// y deja una línea en el Registro diciendo que salió solo.

import { supabaseCharlas, faseDeEstado } from "./charlas";
import { estadisticasPorTipo } from "./charlas-aprendizaje";
import { enviar, EnvioDuplicado } from "./charlas-envio";
import { configAyto } from "./ayuntamientos";

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

function enHorario(): boolean {
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const dia = partes.find((p) => p.type === "weekday")?.value ?? "";
  const min = Number(partes.find((p) => p.type === "hour")?.value) * 60 + Number(partes.find((p) => p.type === "minute")?.value);
  return !["Sat", "Sun"].includes(dia) && min >= 9 * 60 && min < 18 * 60;
}

/** Clave de racha de una tarea: igual que en Aprendizajes (respuesta:<clasificación> o el tipo). */
export function claveTarea(t: { tipo: string; contexto?: { clasificacion?: string } | null }): string {
  return t.tipo === "respuesta" ? `respuesta:${t.contexto?.clasificacion ?? "otro"}` : t.tipo;
}
export const esClaveAyto = (k: string) => k.startsWith("ayto_") || k.startsWith("respuesta:ayto_");

export interface ResumenAutoenvio {
  activo: boolean;
  saltado?: string;
  enviados: number;
  errores: string[];
}

export async function autoenviarAyuntamientos(opciones: { presupuestoMs: number; maximo?: number }): Promise<ResumenAutoenvio> {
  const inicio = Date.now();
  const sb = supabaseCharlas();
  const cfg = await configAyto();
  const res: ResumenAutoenvio = { activo: cfg.autoenvio, enviados: 0, errores: [] };
  if (!cfg.autoenvio) return res;

  const { data: prueba } = await sb.from("charlas_config").select("valor").eq("clave", "modo_prueba").maybeSingle();
  if (prueba?.valor !== false) return { ...res, saltado: "modo prueba" };
  if (!enHorario()) return { ...res, saltado: "fuera de horario" };

  const { data: tareas } = await sb
    .from("charlas_tareas")
    .select("id, tipo, nivel, contexto, borrador_asunto, borrador_texto, destinatario, adjuntar_dossier, idioma, creado_en, centro:charlas_centros(id, nombre, tipo, estado)")
    .eq("estado", "revisar")
    .neq("nivel", "C")
    .not("borrador_texto", "is", null)
    .not("destinatario", "is", null)
    .order("creado_en", { ascending: true })
    .limit(200);
  type Fila = { id: string; tipo: string; nivel: string; creado_en: string; contexto: Record<string, unknown> | null; adjuntar_dossier: boolean; idioma: string | null; centro: { id: string; nombre: string; tipo: string | null; estado: string } | null };
  const filas = ((tareas ?? []) as unknown as Fila[]).filter((t) => t.centro?.tipo === "ayuntamiento" && esClaveAyto(claveTarea(t as never)));
  if (!filas.length) return res;

  // Tope diario de automáticos en esta vía.
  const desde = `${hoy()}T00:00:00`;
  const { data: hechasHoy } = await sb.from("charlas_tareas").select("tipo, contexto").eq("estado", "enviada").eq("resuelto_por", "sistema").gte("resuelto_en", desde);
  let hoyYa = (hechasHoy ?? []).filter((t) => esClaveAyto(claveTarea(t as never))).length;

  const rachas = new Map((await estadisticasPorTipo()).map((s) => [s.tipo, s.racha_sin_editar]));
  const maximo = opciones.maximo ?? 3;

  for (const t of filas) {
    if (res.enviados >= maximo || hoyYa >= cfg.autoenvioTopeDia) break;
    if (Date.now() - inicio > opciones.presupuestoMs) break;
    const clave = claveTarea(t as never);
    const racha = rachas.get(clave) ?? 0;
    const ctx = t.contexto ?? {};
    if (cfg.tiposManuales.includes(clave) || racha < cfg.racha) continue;
    if (ctx.alternativa || (Array.isArray(ctx.faltan_datos) && ctx.faltan_datos.length)) continue;
    if (faseDeEstado(t.centro?.estado) === 6) continue;
    // Si ha entrado un correo suyo después de preparar la tarjeta, lo que había que decir puede haber cambiado.
    const { data: nuevo } = await sb.from("charlas_mensajes").select("id").eq("centro_id", t.centro!.id).eq("direccion", "entrante").gt("fecha", t.creado_en).limit(1);
    if (nuevo?.length) continue;
    try {
      await enviar({ id: t.id, automatico: true, adjuntar_dossier: !!t.adjuntar_dossier });
      res.enviados++;
      hoyYa++;
      await sb.from("charlas_interacciones").insert({ centro_id: t.centro!.id, fecha: hoy(), canal: "Sistema", texto: `Enviado automáticamente: «${clave}» llevaba ${racha} envíos seguidos sin corrección.`, orden: 601, origen: "sistema" });
    } catch (e) {
      if (e instanceof EnvioDuplicado) continue; // lo decide Alain desde la bandeja
      res.errores.push(`${t.centro?.nombre ?? t.id}: ${(e as Error).message}`);
    }
  }
  return res;
}
