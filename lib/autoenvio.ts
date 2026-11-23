// Envío automático por racha en los carriles de charlas (centros) y magia.
//
// Regla de Alain (20-11-2026): cuando un tipo de mensaje lleva la racha de
// envíos seguidos sin que lo corrija (la que enseña «Aprendizajes y
// métricas»), ese tipo deja de esperar a Alain y sale solo. Hasta ahora
// «Listo» era solo una señal. Los ayuntamientos tienen su propio módulo con la
// misma lógica (lib/ayto-autoenvio.ts) y sus propios ajustes.
//
// Nunca sale solo: en modo prueba, fuera de L-V 9:00-18:00, tarjetas de nivel C,
// tarjetas con dos versiones o «me falta información», fichas en 6 En
// conversación, si ha entrado un correo suyo después de preparar la tarjeta,
// WhatsApp o llamadas (solo correo), tipos que Alain deja en manual
// (autoenvio_tipos_manuales) o pasado el tope diario de cada carril.

import { supabaseCharlas, faseDeEstado } from "./charlas";
import { estadisticasPorTipo } from "./charlas-aprendizaje";
import { estadisticasMagia } from "./crm-aprendizaje";
import { enviar as enviarCharlas, EnvioDuplicado as DuplicadoCharlas } from "./charlas-envio";
import { enviarMail as enviarMagia, EnvioDuplicado as DuplicadoMagia } from "./crm-envio";
import { esClaveAyto } from "./ayto-autoenvio";

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

export function enHorario(): boolean {
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const dia = partes.find((p) => p.type === "weekday")?.value ?? "";
  const min = Number(partes.find((p) => p.type === "hour")?.value) * 60 + Number(partes.find((p) => p.type === "minute")?.value);
  return !["Sat", "Sun"].includes(dia) && min >= 9 * 60 && min < 18 * 60;
}

export interface ConfigAutoenvio {
  activo: boolean;
  topeDia: number;
  manuales: string[]; // "charlas:<clave>" | "magia:<clave>"
  rachaCharlas: number;
  rachaMagia: number;
  modoPrueba: boolean;
}

export async function configAutoenvio(): Promise<ConfigAutoenvio> {
  const { data } = await supabaseCharlas()
    .from("charlas_config")
    .select("clave, valor")
    .in("clave", ["autoenvio_activo", "autoenvio_tope_dia", "autoenvio_tipos_manuales", "racha_para_automatico", "magia_racha_para_automatico", "modo_prueba"]);
  const c = Object.fromEntries((data ?? []).map((f) => [f.clave, f.valor])) as Record<string, unknown>;
  return {
    activo: c.autoenvio_activo !== false,
    topeDia: Number(c.autoenvio_tope_dia ?? 25),
    manuales: Array.isArray(c.autoenvio_tipos_manuales) ? (c.autoenvio_tipos_manuales as string[]) : [],
    rachaCharlas: Number(c.racha_para_automatico ?? 20),
    rachaMagia: Number(c.magia_racha_para_automatico ?? 15),
    modoPrueba: c.modo_prueba !== false,
  };
}

export interface ResumenAuto {
  enviados: number;
  saltado?: string;
  errores: string[];
}

const claveCharlas = (t: { tipo: string; contexto?: { clasificacion?: string } | null }) => (t.tipo === "respuesta" ? `respuesta:${t.contexto?.clasificacion ?? "otro"}` : t.tipo);

/** Centros (no ayuntamientos). */
export async function autoenviarCharlas(opciones: { presupuestoMs: number; maximo?: number }): Promise<ResumenAuto> {
  const inicio = Date.now();
  const sb = supabaseCharlas();
  const cfg = await configAutoenvio();
  const res: ResumenAuto = { enviados: 0, errores: [] };
  if (!cfg.activo) return { ...res, saltado: "apagado" };
  if (cfg.modoPrueba) return { ...res, saltado: "modo prueba" };
  if (!enHorario()) return { ...res, saltado: "fuera de horario" };

  const { data } = await sb
    .from("charlas_tareas")
    .select("id, tipo, nivel, contexto, destinatario, adjuntar_dossier, creado_en, centro:charlas_centros(id, nombre, tipo, estado)")
    .eq("estado", "revisar")
    .neq("nivel", "C")
    .not("borrador_texto", "is", null)
    .not("destinatario", "is", null)
    .order("creado_en", { ascending: true })
    .limit(200);
  type Fila = { id: string; tipo: string; contexto: Record<string, unknown> | null; destinatario: string; adjuntar_dossier: boolean; creado_en: string; centro: { id: string; nombre: string; tipo: string | null; estado: string } | null };
  const filas = ((data ?? []) as unknown as Fila[]).filter((t) => t.centro && t.centro.tipo !== "ayuntamiento" && t.destinatario.includes("@") && !esClaveAyto(claveCharlas(t as never)));
  if (!filas.length) return res;

  const { data: hechas } = await sb.from("charlas_tareas").select("tipo, contexto, centro:charlas_centros(tipo)").eq("estado", "enviada").eq("resuelto_por", "sistema").gte("resuelto_en", `${hoy()}T00:00:00`);
  let hoyYa = (hechas ?? []).filter((t) => (t.centro as { tipo?: string } | null)?.tipo !== "ayuntamiento" && !esClaveAyto(claveCharlas(t as never))).length;
  const rachas = new Map((await estadisticasPorTipo()).map((s) => [s.tipo, s.racha_sin_editar]));

  for (const t of filas) {
    if (res.enviados >= (opciones.maximo ?? 3) || hoyYa >= cfg.topeDia || Date.now() - inicio > opciones.presupuestoMs) break;
    const clave = claveCharlas(t as never);
    const racha = rachas.get(clave) ?? 0;
    const ctx = t.contexto ?? {};
    if (cfg.manuales.includes(`charlas:${clave}`) || racha < cfg.rachaCharlas) continue;
    if (ctx.alternativa || (Array.isArray(ctx.faltan_datos) && ctx.faltan_datos.length)) continue;
    if (faseDeEstado(t.centro!.estado) === 6) continue;
    const { data: nuevo } = await sb.from("charlas_mensajes").select("id").eq("centro_id", t.centro!.id).eq("direccion", "entrante").gt("fecha", t.creado_en).limit(1);
    if (nuevo?.length) continue;
    try {
      await enviarCharlas({ id: t.id, automatico: true, adjuntar_dossier: !!t.adjuntar_dossier });
      res.enviados++;
      hoyYa++;
      await sb.from("charlas_interacciones").insert({ centro_id: t.centro!.id, fecha: hoy(), canal: "Sistema", texto: `Enviado automáticamente: «${clave}» llevaba ${racha} envíos seguidos sin corrección.`, orden: 601, origen: "sistema" });
    } catch (e) {
      if (e instanceof DuplicadoCharlas) continue;
      res.errores.push(`${t.centro?.nombre ?? t.id}: ${(e as Error).message}`);
    }
  }
  return res;
}

/** Misma clave que estadisticasMagia (lib/crm-aprendizaje.ts). */
function claveMagia(tipo: string, segmento: string | null | undefined, clasificacion?: string | null): string {
  const base = tipo === "respuesta" ? `respuesta:${clasificacion ?? "otro"}` : tipo;
  if (tipo.startsWith("agencia_")) return base;
  return segmento === "agencia" ? `agencia · ${base}` : base;
}

/** Carril de magia: solo tarjetas de correo. */
export async function autoenviarMagia(opciones: { presupuestoMs: number; maximo?: number }): Promise<ResumenAuto> {
  const inicio = Date.now();
  const sb = supabaseCharlas();
  const cfg = await configAutoenvio();
  const res: ResumenAuto = { enviados: 0, errores: [] };
  if (!cfg.activo) return { ...res, saltado: "apagado" };
  if (cfg.modoPrueba) return { ...res, saltado: "modo prueba" };
  if (!enHorario()) return { ...res, saltado: "fuera de horario" };

  const { data } = await sb
    .from("crm_tareas")
    .select("id, tipo, nivel, canal, contexto, destinatario, creado_en, ficha:crm_fichas(id, nombre, segmento, estado)")
    .eq("carril", "magia")
    .eq("estado", "revisar")
    .eq("canal", "mail")
    .neq("nivel", "C")
    .not("borrador_texto", "is", null)
    .not("destinatario", "is", null)
    .order("creado_en", { ascending: true })
    .limit(200);
  type Ficha = { id: string; nombre: string; segmento: string | null; estado: string };
  type Fila = { id: string; tipo: string; contexto: Record<string, unknown> | null; destinatario: string; creado_en: string; ficha: Ficha | Ficha[] | null };
  const fichaDe = (t: Fila): Ficha | null => (Array.isArray(t.ficha) ? (t.ficha[0] ?? null) : t.ficha);
  const filas = ((data ?? []) as unknown as Fila[]).filter((t) => fichaDe(t) && t.destinatario.includes("@"));
  if (!filas.length) return res;

  const { count } = await sb.from("crm_tareas").select("id", { count: "exact", head: true }).eq("carril", "magia").eq("estado", "enviada").eq("resuelto_por", "sistema").gte("resuelto_en", `${hoy()}T00:00:00`);
  let hoyYa = count ?? 0;
  const rachas = new Map((await estadisticasMagia()).map((s) => [s.tipo, s.racha_sin_editar]));

  for (const t of filas) {
    if (res.enviados >= (opciones.maximo ?? 3) || hoyYa >= cfg.topeDia || Date.now() - inicio > opciones.presupuestoMs) break;
    const f = fichaDe(t)!;
    const clave = claveMagia(t.tipo, f.segmento, (t.contexto as { clasificacion?: string } | null)?.clasificacion);
    const racha = rachas.get(clave) ?? 0;
    const ctx = t.contexto ?? {};
    if (cfg.manuales.includes(`magia:${clave}`) || racha < cfg.rachaMagia) continue;
    if (ctx.alternativa || (Array.isArray(ctx.faltan_datos) && ctx.faltan_datos.length)) continue;
    if (/^6/.test(f.estado ?? "")) continue;
    const { data: nuevo } = await sb.from("crm_mensajes").select("id").eq("ficha_id", f.id).eq("direccion", "entrante").gt("fecha", t.creado_en).limit(1);
    if (nuevo?.length) continue;
    try {
      await enviarMagia({ id: t.id, automatico: true });
      res.enviados++;
      hoyYa++;
      await sb.from("crm_interacciones").insert({ ficha_id: f.id, fecha: hoy(), canal: "Sistema", texto: `Enviado automáticamente: «${clave}» llevaba ${racha} envíos seguidos sin corrección.`, orden: 601, origen: "sistema" });
    } catch (e) {
      if (e instanceof DuplicadoMagia) continue;
      res.errores.push(`${f.nombre}: ${(e as Error).message}`);
    }
  }
  return res;
}

/** Devuelve un tipo a manual (o le deja volver a automático). carril: charlas | magia. */
export async function marcarManual(carril: "charlas" | "magia" | "leads", tipo: string, manual: boolean) {
  const cfg = await configAutoenvio();
  const lista = new Set(cfg.manuales);
  const k = `${carril}:${tipo}`;
  if (manual) lista.add(k);
  else lista.delete(k);
  await supabaseCharlas().from("charlas_config").upsert({ clave: "autoenvio_tipos_manuales", valor: [...lista], actualizado_en: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Leads de Entrenatzaile (decisión de Alain, 23-11-2026): un tipo de mensaje que
// Alain ha enviado 20 veces seguidas sin editar (leads_racha_para_automatico) sale
// solo. Solo correo (WhatsApp e Instagram no tienen API), solo check-in y
// seguimiento (una conversación la contesta siempre Alain), solo borradores
// redactados por la IA (nunca la plantilla), solo con leads_modo = activo y con
// los mismos frenos que magia (horario, tope diario, tipos en manual, correo suyo).
// ---------------------------------------------------------------------------
const TIPOS_AUTO_LEADS = ["check_in", "seguimiento"];

/** Racha de envíos seguidos sin editar por tipo (solo los que envió Alain; los automáticos no cuentan ni la rompen). */
export async function rachasLeads(): Promise<Record<string, number>> {
  const { data } = await supabaseCharlas().from("crm_tareas").select("tipo, editado, resuelto_por").eq("carril", "entrenatzaile").eq("estado", "enviada").in("tipo", TIPOS_AUTO_LEADS).order("resuelto_en", { ascending: false }).limit(400);
  const racha: Record<string, number> = Object.fromEntries(TIPOS_AUTO_LEADS.map((t) => [t, 0]));
  const roto = new Set<string>();
  for (const t of data ?? []) {
    if (roto.has(t.tipo) || t.resuelto_por === "sistema") continue;
    if (t.editado) roto.add(t.tipo);
    else racha[t.tipo] = (racha[t.tipo] ?? 0) + 1;
  }
  return racha;
}

export async function autoenviarLeads(opciones: { presupuestoMs: number; maximo?: number }): Promise<ResumenAuto> {
  const inicio = Date.now();
  const sb = supabaseCharlas();
  const cfg = await configAutoenvio();
  const res: ResumenAuto = { enviados: 0, errores: [] };
  const { data: c } = await sb.from("charlas_config").select("clave, valor").in("clave", ["leads_modo", "leads_racha_para_automatico"]);
  const lc = Object.fromEntries((c ?? []).map((x) => [x.clave, x.valor])) as Record<string, unknown>;
  if (lc.leads_modo !== "activo") return { ...res, saltado: "leads no activo" };
  if (!cfg.activo) return { ...res, saltado: "apagado" };
  if (cfg.modoPrueba) return { ...res, saltado: "modo prueba" };
  if (!enHorario()) return { ...res, saltado: "fuera de horario" };
  const minimo = Number(lc.leads_racha_para_automatico ?? 20);
  const rachas = await rachasLeads();
  const tipos = TIPOS_AUTO_LEADS.filter((t) => (rachas[t] ?? 0) >= minimo && !cfg.manuales.includes(`leads:${t}`));
  if (!tipos.length) return res;

  const { data } = await sb
    .from("crm_tareas")
    .select("id, tipo, contexto, destinatario, creado_en, ficha_id, ficha:crm_fichas(nombre)")
    .eq("carril", "entrenatzaile")
    .eq("estado", "revisar")
    .eq("canal", "mail")
    .eq("contexto->>redaccion", "ia")
    .is("contexto->>auto_error", null)
    .in("tipo", tipos)
    .not("borrador_texto", "is", null)
    .not("destinatario", "is", null)
    .order("creado_en", { ascending: true })
    .limit(50);
  const { count } = await sb.from("crm_tareas").select("id", { count: "exact", head: true }).eq("carril", "entrenatzaile").eq("estado", "enviada").eq("resuelto_por", "sistema").gte("resuelto_en", `${hoy()}T00:00:00`);
  let hoyYa = count ?? 0;
  for (const t of (data ?? []) as unknown as { id: string; tipo: string; contexto: Record<string, unknown> | null; destinatario: string; creado_en: string; ficha_id: string; ficha: { nombre: string } | null }[]) {
    if (res.enviados >= (opciones.maximo ?? 3) || hoyYa >= cfg.topeDia || Date.now() - inicio > opciones.presupuestoMs) break;
    if (!t.destinatario.includes("@")) continue;
    const { data: nuevo } = await sb.from("crm_mensajes").select("id").eq("ficha_id", t.ficha_id).eq("direccion", "entrante").gt("fecha", t.creado_en).limit(1);
    if (nuevo?.length) continue;
    try {
      await enviarMagia({ id: t.id, automatico: true });
      res.enviados++;
      hoyYa++;
      await sb.from("crm_interacciones").insert({ ficha_id: t.ficha_id, fecha: hoy(), canal: "Sistema", texto: `Enviado automáticamente: «${t.tipo}» llevaba ${rachas[t.tipo]} envíos seguidos sin corrección.`, orden: 601, origen: "sistema" });
    } catch (e) {
      if (e instanceof DuplicadoMagia) continue;
      res.errores.push(`${t.ficha?.nombre ?? t.id}: ${(e as Error).message}`);
      // No se reintenta en cada pasada (p. ej. sin hilo ni asunto): la tarjeta se queda para Alain con el motivo.
      await sb.from("crm_tareas").update({ contexto: { ...(t.contexto ?? {}), auto_error: (e as Error).message.slice(0, 200) } }).eq("id", t.id);
    }
  }
  return res;
}
