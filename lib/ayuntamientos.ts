// Vía Ayuntamientos: configuración, carga de los 251 ayuntamientos de Euskadi
// (padrón del INE) y cola diaria del Mail 1.
//
// Las fichas son filas de charlas_centros con tipo "ayuntamiento" (carpeta
// Instituciones/ del vault). El flujo está en lib/ayto-flujo.ts; la
// investigación web en lib/ayto-investigar.ts; el envío automático en
// lib/ayto-autoenvio.ts. Esquema: sql/ayuntamientos.sql.

import { supabaseCharlas, faseDeEstado } from "./charlas";
import { crearTarea } from "./charlas-motor";
import { decisionMail1, correoAyto } from "./ayto-flujo";
import { presupuestoIA } from "./ia-presupuesto";

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
const inicioDiaMadrid = () => {
  const parte = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", timeZoneName: "shortOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const h = Number(/([+-]\d+)/.exec(parte)?.[1] ?? 1);
  return `${hoy()}T00:00:00${h >= 0 ? "+" : "-"}${String(Math.abs(h)).padStart(2, "0")}:00`;
};

export interface ConfigAyto {
  activo: boolean;
  mail1PorDia: number;
  poblacionMinima: number;
  investigarActivo: boolean;
  investigarPorPasada: number;
  localizarPorDia: number;
  autoenvio: boolean;
  racha: number;
  tiposManuales: string[];
  autoenvioTopeDia: number;
}

export const CLAVES_CONFIG_AYTO = {
  activo: "ayto_activo",
  mail1PorDia: "ayto_mail1_maximo_dia",
  poblacionMinima: "ayto_poblacion_minima",
  investigarActivo: "ayto_investigar_activo",
  investigarPorPasada: "ayto_investigar_por_pasada",
  localizarPorDia: "ayto_localizar_por_dia",
  autoenvio: "ayto_autoenvio",
  racha: "ayto_racha_automatico",
  tiposManuales: "ayto_tipos_manuales",
  autoenvioTopeDia: "ayto_autoenvio_tope_dia",
} as const;

export async function configAyto(): Promise<ConfigAyto> {
  const { data } = await supabaseCharlas().from("charlas_config").select("clave, valor").like("clave", "ayto_%");
  const c = Object.fromEntries((data ?? []).map((f) => [f.clave, f.valor])) as Record<string, unknown>;
  const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v !== null && v !== undefined ? Number(v) : d);
  return {
    activo: c.ayto_activo === true,
    mail1PorDia: n(c.ayto_mail1_maximo_dia, 30),
    poblacionMinima: n(c.ayto_poblacion_minima, 0),
    investigarActivo: c.ayto_investigar_activo !== false,
    investigarPorPasada: n(c.ayto_investigar_por_pasada, 2),
    localizarPorDia: n(c.ayto_localizar_por_dia, 3),
    autoenvio: c.ayto_autoenvio !== false,
    racha: n(c.ayto_racha_automatico, 20),
    tiposManuales: Array.isArray(c.ayto_tipos_manuales) ? (c.ayto_tipos_manuales as string[]) : [],
    autoenvioTopeDia: n(c.ayto_autoenvio_tope_dia, 25),
  };
}

// ---------------------------------------------------------------------------
// Carga de los ayuntamientos desde el padrón del INE (cifras oficiales de
// población por municipio). Tres tablas, una por territorio. Idempotente: los
// que ya existen (por nombre, por código INE o por localidad) solo reciben el
// código y la población si les faltaban; nunca se toca su estado ni su flujo.
// ---------------------------------------------------------------------------

const TABLAS_INE = [
  { id: 2854, territorio: "Araba", prefijo: "01", minimo: 45 },
  { id: 2873, territorio: "Gipuzkoa", prefijo: "20", minimo: 80 },
  { id: 2905, territorio: "Bizkaia", prefijo: "48", minimo: 100 },
] as const;

export interface MunicipioIne {
  codigo: string;
  nombre: string;
  territorio: string;
  poblacion: number | null;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Lee una tabla del INE (CSV «csv_c»: "20001 Abaltzisketa,326,309,…"). La primera cifra es el total del último año. */
export function parsearIne(texto: string, prefijo: string, territorio: string): MunicipioIne[] {
  const vistos = new Map<string, MunicipioIne>();
  const re = /"?(\d{5}) ([^,;"\r\n]+?)"?[,;]"?(\d{1,3}(?:\.\d{3})+|\d+)"?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    const [, codigo, nombre, cifra] = m;
    if (!codigo.startsWith(prefijo) || vistos.has(codigo)) continue;
    const pob = Number(cifra.replace(/\./g, ""));
    vistos.set(codigo, { codigo, nombre: nombre.trim(), territorio, poblacion: Number.isFinite(pob) ? pob : null });
  }
  return [...vistos.values()];
}

async function bajarIne(id: number): Promise<string> {
  const errores: string[] = [];
  for (const url of [`https://www.ine.es/jaxiT3/files/t/es/csv_c/${id}.csv`, `https://www.ine.es/jaxiT3/files/t/en/csv_c/${id}.csv`]) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; AlainZulaikaBot/1.0; +https://alainzulaika.com)" } });
      clearTimeout(t);
      if (!r.ok) {
        errores.push(`${url}: ${r.status}`);
        continue;
      }
      const buf = new Uint8Array(await r.arrayBuffer());
      // El INE sirve a veces en Latin-1: si no es UTF-8 válido, se lee como windows-1252.
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(buf);
      } catch {
        return new TextDecoder("windows-1252").decode(buf);
      }
    } catch (e) {
      errores.push(`${url}: ${(e as Error).message}`);
    }
  }
  throw new Error(`No se pudo leer la tabla ${id} del INE (${errores.join(" · ")})`);
}

/** "Donostia/San Sebastián" → nombre de fichero válido para el vault. */
export function nombreFicha(municipio: string): string {
  return `Ayuntamiento de ${municipio.replace(/\s*\/\s*/g, " - ").trim()}`;
}

function prioridadPorPoblacion(p: number | null): string {
  if (p === null) return "C";
  if (p >= 20000) return "A";
  if (p >= 5000) return "B";
  return "C";
}

export interface ResumenImportacion {
  leidos: Record<string, number>;
  creados: number;
  ya_estaban: number;
  actualizados: number;
  errores: string[];
}

export async function importarAyuntamientos(opciones: { comprobar?: boolean } = {}): Promise<ResumenImportacion> {
  const sb = supabaseCharlas();
  const res: ResumenImportacion = { leidos: {}, creados: 0, ya_estaban: 0, actualizados: 0, errores: [] };

  const municipios: MunicipioIne[] = [];
  for (const t of TABLAS_INE) {
    try {
      const lista = parsearIne(await bajarIne(t.id), t.prefijo, t.territorio);
      res.leidos[t.territorio] = lista.length;
      if (lista.length < t.minimo) {
        res.errores.push(`${t.territorio}: solo ${lista.length} municipios leídos del INE (se esperaban más); no se carga ese territorio.`);
        continue;
      }
      municipios.push(...lista);
    } catch (e) {
      res.errores.push(`${t.territorio}: ${(e as Error).message}`);
    }
  }
  if (!municipios.length) return res;

  const { data: existentes, error } = await sb.from("charlas_centros").select("id, nombre, localidad, codigo, poblacion, tipo");
  if (error) throw new Error(error.message);
  const porNombre = new Map((existentes ?? []).map((e) => [e.nombre as string, e]));
  const aytos = (existentes ?? []).filter((e) => e.tipo === "ayuntamiento" && /^ayuntamiento/i.test(String(e.nombre)));

  const nuevos: Record<string, unknown>[] = [];
  const fecha = hoy();
  for (const m of municipios) {
    const nombre = nombreFicha(m.nombre);
    const partes = new Set([norm(m.nombre), ...m.nombre.split("/").map(norm)].filter(Boolean));
    const ya = porNombre.get(nombre) ?? aytos.find((e) => e.codigo === m.codigo || (e.localidad && partes.has(norm(String(e.localidad)))));
    if (ya) {
      res.ya_estaban++;
      const cambios: Record<string, unknown> = {};
      if (!ya.codigo) cambios.codigo = m.codigo;
      if (!ya.poblacion && m.poblacion) cambios.poblacion = m.poblacion;
      if (Object.keys(cambios).length && !opciones.comprobar) {
        await sb.from("charlas_centros").update({ ...cambios, actualizado_por: "sistema" }).eq("id", ya.id);
        res.actualizados++;
      }
      continue;
    }
    nuevos.push({
      nombre,
      codigo: m.codigo,
      territorio: m.territorio,
      localidad: m.nombre,
      tipo: "ayuntamiento",
      tipo_centro: "Ayuntamiento",
      euskera: "sí", // decisión de Alain (20-11-2026): a todos los ayuntamientos, en euskera
      etapas: [],
      prioridad: prioridadPorPoblacion(m.poblacion),
      poblacion: m.poblacion,
      estado: "0 Por llamar",
      origen: "Padrón INE · vía ayuntamientos (20-11-2026)",
      via: "institucional",
      proxima_accion: "Investigación web y Mail 1 (cola diaria de ayuntamientos)",
      fecha_proxima_accion: null,
      fecha_creacion: fecha,
      nivel_autonomia: "B",
      actualizado_por: "sistema",
    });
  }

  if (opciones.comprobar) {
    res.creados = nuevos.length;
    return res;
  }
  for (let i = 0; i < nuevos.length; i += 50) {
    const lote = nuevos.slice(i, i + 50);
    const { data: ins, error: e } = await sb.from("charlas_centros").insert(lote).select("id");
    if (e) {
      res.errores.push(`lote ${i / 50 + 1}: ${e.message}`);
      continue;
    }
    res.creados += ins?.length ?? 0;
    if (ins?.length) {
      await sb.from("charlas_interacciones").insert(
        ins.map((f) => ({ centro_id: f.id, fecha, canal: "Sistema", texto: "Ficha creada desde el padrón del INE (vía ayuntamientos). El sistema buscará en su web el buzón general y quién lleva Educación.", orden: 600, origen: "sistema" }))
      );
    }
  }
  return res;
}

// ---------------------------------------------------------------------------
// Cola diaria del Mail 1: hasta `ayto_mail1_maximo_dia` ayuntamientos al día (recortado por el presupuesto de IA), de más a
// menos población, con correo y sin tarea abierta. Solo con `ayto_activo`.
// Las tarjetas quedan en la bandeja; el envío automático decide aparte.
// ---------------------------------------------------------------------------

const CAMPOS_FICHA = "id, nombre, estado, euskera, responsable, responsable_email, responsable_cargo, email_centro, web, telefono, proxima_accion, fecha_proxima_accion, bloqueado_por, nivel_autonomia, mails_enviados, intentos_llamada, via, otros_formatos, tipo, localidad, poblacion";

export interface ResumenColaAyto {
  activo: boolean;
  cupo_hoy?: number;
  hoy_ya: number;
  creadas: number;
  candidatos: number;
  localizar: number;
  errores: string[];
}

export async function mail1Ayuntamientos(opciones: { presupuestoMs: number }): Promise<ResumenColaAyto> {
  const inicio = Date.now();
  const sb = supabaseCharlas();
  const cfg = await configAyto();
  const res: ResumenColaAyto = { activo: cfg.activo, hoy_ya: 0, creadas: 0, candidatos: 0, localizar: 0, errores: [] };
  if (!cfg.activo) return res;

  const { count } = await sb.from("charlas_tareas").select("id", { count: "exact", head: true }).in("tipo", ["ayto_mail_1_concejal", "ayto_mail_1_buzon"]).gte("creado_en", inicioDiaMadrid());
  res.hoy_ya = count ?? 0;
  // Cupo del día: el máximo de ajustes, recortado a lo que cabe en el presupuesto de IA del mes
  // (lib/ia-presupuesto.ts: lo más cerca del tope sin pasarse).
  const presupuesto = await presupuestoIA(cfg.mail1PorDia);
  res.cupo_hoy = presupuesto.cupo_ayto_hoy;
  const restantes = Math.max(0, presupuesto.cupo_ayto_hoy - res.hoy_ya);

  const { data: fichas } = await sb
    .from("charlas_centros")
    .select(CAMPOS_FICHA)
    .eq("tipo", "ayuntamiento")
    .like("estado", "0%")
    .is("bloqueado_por", null)
    .order("poblacion", { ascending: false, nullsFirst: false })
    .limit(400);
  const { data: abiertas } = await sb.from("charlas_tareas").select("centro_id").in("estado", ["revisar", "pendiente", "aprobada"]);
  const conTarea = new Set((abiertas ?? []).map((t) => t.centro_id as string));
  const h = hoy();
  const aptas = (fichas ?? []).filter(
    (c) =>
      !conTarea.has(c.id as string) &&
      (!c.fecha_proxima_accion || (c.fecha_proxima_accion as string) <= h) &&
      (cfg.poblacionMinima <= 0 || (c.poblacion ?? 0) >= cfg.poblacionMinima)
  );
  const cola = aptas.filter((c) => correoAyto(c as never).correo);
  res.candidatos = cola.length;

  for (const c of cola.slice(0, restantes)) {
    if (Date.now() - inicio > opciones.presupuestoMs) break;
    const d = decisionMail1(c as never, h);
    if (!d) continue;
    try {
      await crearTarea(c as never, d);
      res.creadas++;
    } catch (e) {
      res.errores.push(`${c.nombre}: ${(e as Error).message}`);
    }
  }

  // Sin correo tras investigar: unas pocas tarjetas al día para pegarlo a mano.
  if (cfg.localizarPorDia > 0 && Date.now() - inicio < opciones.presupuestoMs) {
    const { count: locHoy } = await sb.from("charlas_tareas").select("id", { count: "exact", head: true }).eq("tipo", "localizar_correo").contains("contexto", { ayuntamiento: true }).gte("creado_en", inicioDiaMadrid());
    const cupo = Math.max(0, cfg.localizarPorDia - (locHoy ?? 0));
    if (cupo) {
      const { data: inv } = await sb.from("charlas_investigacion").select("centro_id, web, resultado").in("resultado", ["sin_web", "sin_correo"]);
      const sinCorreo = new Map((inv ?? []).map((i) => [i.centro_id as string, i]));
      const hace45 = new Date(Date.now() - 45 * 86400000).toISOString();
      const { data: previas } = await sb.from("charlas_tareas").select("centro_id").eq("tipo", "localizar_correo").gte("creado_en", hace45);
      const yaPedidas = new Set((previas ?? []).map((t) => t.centro_id as string));
      const pendientes = aptas.filter((c) => !correoAyto(c as never).correo && sinCorreo.has(c.id as string) && !yaPedidas.has(c.id as string));
      for (const c of pendientes.slice(0, cupo)) {
        const i = sinCorreo.get(c.id as string)!;
        const web = (c.web as string | null) ?? (i.web as string | null);
        const { error } = await sb.from("charlas_tareas").insert({
          centro_id: c.id,
          tipo: "localizar_correo",
          nivel: "C",
          urgencia: 1,
          urgencia_motivo: "Rellenar el correo del ayuntamiento",
          estado: "revisar",
          idioma: c.euskera === "sí" ? "eu" : "es",
          mensaje_entrante_id: null,
          cambios_crm: {},
          destinatario: null,
          nota_para_alain: `La web del ayuntamiento no ha dado ningún correo útil (web: ${web ?? "no encontrada"} · tel: ${c.telefono ?? "sin teléfono"}). Busca el de Educación (concejal/a o técnico/a) o, si no, el general, y pégalo en «Contacto»: el Mail 1 entra en la cola. Si no lo encuentras, «Descartar».`,
          editado: false,
          contexto: { programada: true, resumen: "Localizar el correo del ayuntamiento", clasificacion: "localizar_correo", ayuntamiento: true },
        });
        if (error) res.errores.push(`${c.nombre}: ${error.message}`);
        else res.localizar++;
      }
    }
  }
  return res;
}

/** Números para la pestaña del panel. */
export async function resumenAyuntamientos() {
  const sb = supabaseCharlas();
  const [{ data: fichas }, { data: inv }, cfg] = await Promise.all([
    sb.from("charlas_centros").select("id, nombre, estado, territorio, localidad, poblacion, responsable, responsable_cargo, responsable_email, email_centro, web, proxima_accion, fecha_proxima_accion, fecha_ultimo_contacto, otros_formatos").eq("tipo", "ayuntamiento").order("poblacion", { ascending: false, nullsFirst: false }),
    sb.from("charlas_investigacion").select("centro_id, resultado, investigado_en, hallazgos"),
    configAyto(),
  ]);
  const porEstado: Record<string, number> = {};
  for (const f of fichas ?? []) porEstado[f.estado as string] = (porEstado[f.estado as string] ?? 0) + 1;
  const invPor = new Map((inv ?? []).map((i) => [i.centro_id as string, i]));
  const porResultado: Record<string, number> = {};
  for (const i of inv ?? []) porResultado[(i.resultado as string) ?? "?"] = (porResultado[(i.resultado as string) ?? "?"] ?? 0) + 1;
  const lista = (fichas ?? []).map((f) => {
    const i = invPor.get(f.id as string);
    const { correo, directo } = correoAyto(f as never);
    return { ...f, fase: faseDeEstado(f.estado as string), correo, directo, investigacion: i ? { resultado: i.resultado, fecha: String(i.investigado_en).slice(0, 10), hallazgos: i.hallazgos } : null };
  });
  const presupuesto = await presupuestoIA(cfg.mail1PorDia).catch(() => null);
  return {
    config: cfg,
    presupuesto,
    total: lista.length,
    por_estado: porEstado,
    investigacion: { hechas: inv?.length ?? 0, por_resultado: porResultado, pendientes: lista.filter((f) => !f.investigacion && f.fase <= 2).length },
    con_correo_educacion: lista.filter((f) => f.directo).length,
    solo_buzon: lista.filter((f) => f.correo && !f.directo).length,
    sin_correo: lista.filter((f) => !f.correo).length,
    lista,
  };
}
