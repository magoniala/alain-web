// Eventos de magia: checklist del protocolo, tarjetas de los mensajes y avisos
// (23-11-2026). Lo llama el cron del servidor (/api/charlas/cron) en cada
// pasada, así que no depende del Mac ni de que nadie abra un panel.
//
//   1. asegurarPasos     → cada evento futuro tiene sus pasos con las fechas de
//                          lib/eventos-protocolo.ts (si cambia la fecha, se recalculan).
//   2. sincronizarTareas → lo hecho en la Bandeja («Ya lo he enviado», «Descartar»,
//                          «Aplazar») pasa al paso, y al revés.
//   3. crearTarjetas     → en la fecha ideal de cada mensaje, tarjeta en la Bandeja
//                          de Magia con la plantilla rellena y push al móvil.
//   4. avisosLimite      → el día límite, a partir de las 9:00: la tarjeta sube a
//                          «Ahora» y llega un aviso al móvil; también de lo interno
//                          sin marcar (red de seguridad, decisión de Alain).
//   5. tarjetasGanados   → ficha en 7 Ganado sin evento → tarjeta «Crear evento».
//
// El vault es espejo (scripts/crm/espejo-eventos.mjs). post-evento.mjs no cambia.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseCharlas } from "./charlas";
import { enviarPush } from "./charlas-push";
import { llamarClaude } from "./charlas-ia";
import {
  CLAVE_VAULT,
  ORDEN,
  borradorPaso,
  cancelado,
  esRecurrente,
  estadoDeValor,
  fechaCorta,
  fechaLarga,
  horaMadrid,
  hoyMadrid,
  pasosDelEvento,
  sumar,
  type ClavePaso,
  type EstadoPaso,
  type EventoBase,
} from "./eventos-protocolo";

export interface Evento extends EventoBase {
  carril: string;
  ficha_id: string | null;
  cliente_ficha: string | null;
  creado_desde: string;
  actualizado_en: string;
  espejado_en: string | null;
}
export interface Paso {
  id: string;
  evento_id: string;
  clave: ClavePaso;
  tipo: "mensaje" | "interno";
  titulo: string;
  fecha_ideal: string;
  fecha_limite: string;
  estado: EstadoPaso;
  hecho_en: string | null;
  hecho_por: string | null;
  tarea_id: string | null;
  aplazado_hasta: string | null;
  aviso_limite_en: string | null;
  nota: string | null;
}
interface Ficha {
  id: string;
  nombre: string;
  estado: string;
  idioma: string | null;
  responsable: string | null;
  responsable_tel: string | null;
  responsable_email: string | null;
  telefono: string | null;
  email: string | null;
}

const URL_PANEL = "/admin?tab=Eventos";
const MODELO_BARATO = "claude-haiku-5-5";
const ahora = () => new Date().toISOString();
const telWa = (t: string | null | undefined) => {
  const d = String(t ?? "").replace(/\D/g, "");
  return !d ? null : d.length === 9 ? `34${d}` : d;
};
const primerNombre = (s: string | null | undefined) => String(s ?? "").replace(/\(.*$/, "").trim().split(/\s+/)[0] || "";
export const nombreCorto = (nombre: string) => nombre.replace(/^\d{4}-\d{2}-\d{2}\s+/, "").replace(/["“”«»][^"“”«»]*["“”«»]/g, "").split(/\s+[—·-]\s+/)[0].trim();
const enlaceFicha = (v: unknown) => (/\[\[([^\]|]+)/.exec(String(v ?? ""))?.[1] ?? String(v ?? "")).trim();
const CAMPOS_FICHA = "id, nombre, estado, idioma, responsable, responsable_tel, responsable_email, telefono, email";

async function eventosYPasos(sb: SupabaseClient, desde: string) {
  const { data: evs, error } = await sb.from("eventos").select("*").gte("fecha_evento", desde).order("fecha_evento");
  if (error) throw new Error(`eventos: ${error.message}`);
  const eventos = (evs ?? []) as Evento[];
  const { data: ps, error: e2 } = eventos.length ? await sb.from("eventos_pasos").select("*").in("evento_id", eventos.map((e) => e.id)) : { data: [], error: null };
  if (e2) throw new Error(`eventos_pasos: ${e2.message}`);
  return { eventos, pasos: (ps ?? []) as Paso[] };
}

async function fichaDe(sb: SupabaseClient, ev: Evento): Promise<Ficha | null> {
  if (ev.ficha_id) {
    const { data } = await sb.from("crm_fichas").select(CAMPOS_FICHA).eq("id", ev.ficha_id).maybeSingle();
    if (data) return data as Ficha;
  }
  const nombre = enlaceFicha(ev.cliente_ficha ?? ev.frontmatter?.cliente_ficha);
  if (!nombre) return null;
  const { data } = await sb.from("crm_fichas").select(CAMPOS_FICHA).eq("carril", "magia").eq("nombre", nombre).maybeSingle();
  if (data) await sb.from("eventos").update({ ficha_id: data.id }).eq("id", ev.id);
  return (data as Ficha) ?? null;
}

// --- 1 · pasos ----------------------------------------------------------------------

export async function asegurarPasos(sb: SupabaseClient, hoy: string) {
  // Todos los eventos desde hace 2 días (el «post» vence al día siguiente) para «material compartido».
  const { eventos, pasos } = await eventosYPasos(sb, sumar(hoy, -2));
  let creados = 0;
  let movidos = 0;
  let quitados = 0;
  for (const ev of eventos) {
    if (cancelado(ev.estado_evento)) continue;
    const tipo = esRecurrente(ev.nombre) ? "recurrente" : ev.tipo;
    const calc = pasosDelEvento({ ...ev, tipo }, eventos, hoy);
    const mios = pasos.filter((p) => p.evento_id === ev.id);
    for (const c of calc) {
      const p = mios.find((x) => x.clave === c.clave);
      if (!p) {
        // Un evento que ya pasó cuando entra (importado tarde) no estrena checklist: lo de después lo lleva post-evento.mjs.
        if (ev.fecha_evento < hoy) continue;
        // Estado inicial: lo que diga la nota del vault (cartel "-", mensaje_7dias: Sí…).
        const v = estadoDeValor(ev.frontmatter?.[CLAVE_VAULT[c.clave]]);
        const { error } = await sb.from("eventos_pasos").insert({ evento_id: ev.id, ...c, estado: v.estado, hecho_en: v.estado === "hecho" ? v.fecha ?? hoy : null, hecho_por: v.estado === "pendiente" ? null : "vault" });
        if (!error) creados++;
      } else if (p.estado === "pendiente" && (p.fecha_ideal !== c.fecha_ideal || p.fecha_limite !== c.fecha_limite || p.titulo !== c.titulo)) {
        // Fechas recalculadas (cambió la fecha del evento o las reglas). Si ya pasó el límite que se avisó, se vuelve a poder avisar.
        await sb.from("eventos_pasos").update({ fecha_ideal: c.fecha_ideal, fecha_limite: c.fecha_limite, titulo: c.titulo, ...(p.fecha_limite !== c.fecha_limite ? { aviso_limite_en: null } : {}) }).eq("id", p.id);
        movidos++;
      }
    }
    // Pasos que ya no tocan (p. ej. el otro evento se canceló y ya no hay material compartido).
    for (const p of mios) {
      if (p.estado !== "pendiente" || calc.some((c) => c.clave === p.clave)) continue;
      await cerrarTarea(sb, p.tarea_id, "descartada", "El paso ya no aplica a este evento");
      await sb.from("eventos_pasos").delete().eq("id", p.id);
      quitados++;
    }
  }
  // Eventos cancelados: sus tarjetas abiertas se cierran.
  for (const ev of eventos.filter((e) => cancelado(e.estado_evento))) {
    for (const p of pasos.filter((x) => x.evento_id === ev.id && x.tarea_id)) await cerrarTarea(sb, p.tarea_id, "descartada", "Evento cancelado o aplazado");
  }
  return { creados, movidos, quitados };
}

async function cerrarTarea(sb: SupabaseClient, tareaId: string | null, estado: "hecha" | "descartada", motivo: string) {
  if (!tareaId) return;
  await sb.from("crm_tareas").update({ estado, motivo, resuelto_en: ahora(), resuelto_por: "sistema" }).eq("id", tareaId).in("estado", ["revisar", "pendiente", "error"]);
}

// --- 2 · bandeja ↔ pasos --------------------------------------------------------------

export async function sincronizarTareas(sb: SupabaseClient) {
  const { data, error } = await sb.from("eventos_pasos").select("id, evento_id, estado, tarea_id").not("tarea_id", "is", null);
  if (error || !data?.length) return { cambiados: 0 };
  const ids = data.map((p) => p.tarea_id as string);
  const { data: tareas } = await sb.from("crm_tareas").select("id, estado, motivo, resuelto_en, resuelto_por").in("id", ids);
  const porId = new Map((tareas ?? []).map((t) => [t.id as string, t]));
  let cambiados = 0;
  for (const p of data) {
    const t = porId.get(p.tarea_id as string);
    if (p.estado !== "pendiente") {
      // Marcado en el panel o en el vault con la tarjeta aún abierta: se cierra.
      if (t && ["revisar", "pendiente", "error"].includes(t.estado)) await cerrarTarea(sb, t.id, p.estado === "hecho" ? "hecha" : "descartada", p.estado === "hecho" ? "Marcado como hecho en Eventos o en el vault" : "Marcado como «no aplica» en Eventos o en el vault");
      continue;
    }
    if (!t) {
      await sb.from("eventos_pasos").update({ tarea_id: null }).eq("id", p.id);
      continue;
    }
    if (["revisar", "pendiente", "error"].includes(t.estado)) continue;
    const motivo = String(t.motivo ?? "");
    const aplazada = /^Aplazada al (\d{4}-\d{2}-\d{2})/.exec(motivo)?.[1];
    const cambio: Record<string, unknown> =
      t.estado === "enviada" || t.estado === "hecha"
        ? { estado: "hecho", hecho_en: String(t.resuelto_en ?? ahora()).slice(0, 10), hecho_por: "bandeja" }
        : aplazada
          ? { tarea_id: null, aplazado_hasta: aplazada }
          : /^Sustituida/.test(motivo)
            ? { estado: "hecho", hecho_en: hoyMadrid(), hecho_por: "bandeja", nota: "Sustituida por un borrador redactado en la Bandeja" }
            : t.resuelto_por === "sistema"
              ? { tarea_id: null } // la cerró otro proceso: se vuelve a crear en la pasada siguiente
              : { estado: "no_aplica", hecho_por: "bandeja", nota: motivo ? `Descartada en la Bandeja: ${motivo}` : "Descartada en la Bandeja" };
    await sb.from("eventos_pasos").update({ ...cambio, actualizado_en: ahora() }).eq("id", p.id);
    cambiados++;
  }
  return { cambiados };
}

// --- 3 · tarjetas de los mensajes --------------------------------------------------------

async function aEuskera(texto: string): Promise<string | null> {
  try {
    const r = await llamarClaude({
      system: [{ type: "text", text: "Traduce al euskera batua el mensaje de WhatsApp o correo que te paso. Registro cercano y natural, como lo escribiría un mago que trata de tú al organizador. Mantén los saltos de línea, nombres, horas, fechas y lo que va entre corchetes tal cual. Sin comillas angulares. Devuelve solo el mensaje traducido." }],
      usuario: texto,
      proposito: "magia_eventos_euskera",
      maxTokens: 900,
      modelo: MODELO_BARATO,
    });
    return r.trim() || null;
  } catch {
    return null;
  }
}

export async function crearTarjetas(sb: SupabaseClient, hoy: string) {
  const { eventos, pasos } = await eventosYPasos(sb, hoy);
  const creadas: string[] = [];
  const sinFicha: string[] = [];
  for (const p of pasos) {
    if (p.tipo !== "mensaje" || p.estado !== "pendiente" || p.tarea_id) continue;
    const ev = eventos.find((e) => e.id === p.evento_id);
    if (!ev || cancelado(ev.estado_evento) || ev.fecha_evento < hoy) continue;
    if (hoy < p.fecha_ideal || (p.aplazado_hasta && hoy < p.aplazado_hasta)) continue;
    // La víspera no tiene sentido el mismo día del evento.
    if (p.clave === "mensaje_vispera" && hoy >= ev.fecha_evento) continue;
    const f = await fichaDe(sb, ev);
    const corto = nombreCorto(ev.nombre);
    if (!f) {
      if (!p.aviso_limite_en) {
        sinFicha.push(`${corto}: ${p.titulo}`);
        await sb.from("eventos_pasos").update({ aviso_limite_en: ahora(), nota: "Sin ficha en el CRM: hazlo a mano desde la pestaña Eventos" }).eq("id", p.id);
      }
      continue;
    }
    const contacto = primerNombre(f.responsable) || primerNombre(/\(([^)]+)\)/.exec(String(ev.frontmatter?.cliente ?? ""))?.[1]);
    const b = borradorPaso(p.clave, ev, contacto, p.fecha_limite);
    if (!b) continue;
    const tel = telWa(f.responsable_tel || f.telefono);
    const email = f.responsable_email || f.email;
    const canal = tel ? "whatsapp" : email ? "mail" : "whatsapp";
    const idioma = f.idioma === "es" ? "es" : "eu";
    let texto = b.texto;
    const notas = [`Protocolo de eventos · ${corto}, ${fechaLarga(ev.fecha_evento)}. ${p.titulo}. Ideal ${fechaCorta(p.fecha_ideal)} · límite ${fechaCorta(p.fecha_limite)}.`, b.nota];
    if (idioma === "eu") {
      const eu = await aEuskera(texto);
      if (eu) {
        texto = eu;
        notas.push("Euskera traducido por la IA: repásalo antes de mandarlo.");
      } else notas.push("La ficha está en euskera y no se ha podido traducir: tradúcelo tú.");
    }
    if (!tel && !email) notas.push("La ficha no tiene teléfono ni correo: copia el mensaje.");
    notas.push("Al pulsar «Ya lo he enviado» queda hecho en Eventos. Si no aplica a este evento, «Descartar».");
    const limite = hoy >= p.fecha_limite;
    const { data: t, error } = await sb
      .from("crm_tareas")
      .insert({
        ficha_id: f.id,
        carril: "magia",
        tipo: "evento_paso",
        canal,
        nivel: "C",
        urgencia: limite ? 3 : 2,
        urgencia_motivo: limite ? `Hoy es el límite: ${p.titulo}` : `Protocolo de eventos · límite ${fechaCorta(p.fecha_limite)}`,
        estado: "revisar",
        idioma,
        destinatario: canal === "whatsapp" ? tel : email,
        borrador_asunto: canal === "mail" ? `${String(ev.frontmatter?.show_base ?? "").trim() || "Show de magia"} · ${fechaLarga(ev.fecha_evento)}` : null,
        borrador_texto: texto,
        nota_para_alain: notas.filter(Boolean).join(" "),
        contexto: { evento_paso: { evento_id: ev.id, paso_id: p.id, clave: p.clave, evento: ev.nombre }, resumen: `${p.titulo} · ${corto} (${fechaCorta(ev.fecha_evento)})` },
        cambios_crm: {},
        notificada_en: ahora(),
      })
      .select("id")
      .single();
    if (error || !t) continue;
    await sb.from("eventos_pasos").update({ tarea_id: t.id, aplazado_hasta: null, ...(limite ? { aviso_limite_en: ahora() } : {}) }).eq("id", p.id);
    creadas.push(`${limite ? "⚠ " : ""}${corto}: ${p.titulo.split(" · ")[1] ?? p.titulo}`);
  }
  if (creadas.length) {
    await enviarPush({
      title: creadas.length === 1 ? `📅 ${creadas[0].split(":")[0]}: mensaje del protocolo` : `📅 Eventos: ${creadas.length} mensajes del protocolo`,
      body: creadas.join(" · "),
      url: "/admin?tab=Prospectos%20magia",
      tag: "eventos-mensajes",
    }).catch(() => null);
  }
  if (sinFicha.length) await enviarPush({ title: "📅 Eventos: toca un mensaje sin ficha en el CRM", body: sinFicha.join(" · "), url: URL_PANEL, tag: "eventos-sin-ficha" }).catch(() => null);
  return { creadas, sin_ficha: sinFicha };
}

// --- 4 · avisos del día límite ---------------------------------------------------------

export async function avisosLimite(sb: SupabaseClient, hoy: string) {
  if (horaMadrid() < 9) return { avisos: [] as string[] };
  const { eventos, pasos } = await eventosYPasos(sb, sumar(hoy, -1));
  const lineas: string[] = [];
  for (const p of pasos) {
    if (p.estado !== "pendiente" || p.aviso_limite_en || hoy < p.fecha_limite) continue;
    const ev = eventos.find((e) => e.id === p.evento_id);
    if (!ev || cancelado(ev.estado_evento)) continue;
    if (p.tipo === "mensaje" && (!p.tarea_id || hoy > ev.fecha_evento)) continue; // sin tarjeta aún: la crea crearTarjetas ya en «Ahora»
    if (p.tipo === "mensaje") await sb.from("crm_tareas").update({ urgencia: 3, urgencia_motivo: `Hoy es el límite: ${p.titulo}` }).eq("id", p.tarea_id!).in("estado", ["revisar", "error"]);
    await sb.from("eventos_pasos").update({ aviso_limite_en: ahora() }).eq("id", p.id);
    const vencido = hoy > p.fecha_limite ? ` (límite ${fechaCorta(p.fecha_limite)}, pasado)` : "";
    lineas.push(`${nombreCorto(ev.nombre)}: ${p.titulo.replace(/^Mensaje \d · /, "mensaje · ")}${vencido}`);
  }
  if (lineas.length) await enviarPush({ title: `⚠️ Eventos: ${lineas.length === 1 ? "hoy es el límite" : `${lineas.length} cosas con límite hoy`}`, body: lineas.join(" · "), url: URL_PANEL, tag: "eventos-limite", renotify: true }).catch(() => null);
  return { avisos: lineas };
}

// --- 5 · fichas ganadas sin evento -----------------------------------------------------

/** Solo fichas que pasaron a 7 Ganado desde que existe esto: las antiguas ya tienen su evento en el vault o ya se celebró. */
const DESDE_GANADOS = "2026-11-23";

export async function tarjetasGanados(sb: SupabaseClient, hoy: string) {
  // Hasta que el espejo del vault no ha cargado los eventos que ya existían, no se sabe quién tiene evento.
  const { count } = await sb.from("eventos").select("id", { count: "exact", head: true }).eq("creado_desde", "vault");
  if (!count) return { creadas: 0 };
  const { data: fichas } = await sb.from("crm_fichas").select("id, nombre, estado, actualizado_en").eq("carril", "magia").eq("estado", "7 Ganado").gte("actualizado_en", DESDE_GANADOS);
  if (!fichas?.length) return { creadas: 0 };
  const { data: evs } = await sb.from("eventos").select("ficha_id, cliente_ficha").gte("fecha_evento", sumar(hoy, -30));
  const conEvento = new Set((evs ?? []).flatMap((e) => [e.ficha_id, enlaceFicha(e.cliente_ficha)]).filter(Boolean) as string[]);
  const { data: yaOfrecidas } = await sb.from("crm_tareas").select("ficha_id").eq("tipo", "crear_evento").in("ficha_id", fichas.map((f) => f.id));
  const ofrecidas = new Set((yaOfrecidas ?? []).map((t) => t.ficha_id as string));
  let creadas = 0;
  for (const f of fichas) {
    if (conEvento.has(f.id) || conEvento.has(f.nombre) || ofrecidas.has(f.id)) continue;
    const { error } = await sb.from("crm_tareas").insert({
      ficha_id: f.id,
      carril: "magia",
      tipo: "crear_evento",
      canal: "ninguno",
      nivel: "C",
      urgencia: 2,
      urgencia_motivo: "Cliente ganado sin evento",
      estado: "revisar",
      nota_para_alain: "Ficha ganada sin evento creado. Crea el evento (fecha, hora, lugar, precio) y los pasos del protocolo saldrán solos: mensajes aquí, preparación en la nota diaria. Si no hace falta (ya existe o no es un evento), descarta la tarjeta.",
      contexto: { estado_ficha: "7 Ganado", resumen: "Crear el evento para que el protocolo salga solo" },
      cambios_crm: {},
    });
    if (!error) creadas++;
  }
  return { creadas };
}

// --- pasada completa (cron) -------------------------------------------------------------

export async function avisosEventos() {
  const sb = supabaseCharlas();
  const hoy = hoyMadrid();
  const pasos = await asegurarPasos(sb, hoy);
  const sinc = await sincronizarTareas(sb);
  const tarjetas = await crearTarjetas(sb, hoy);
  const limite = await avisosLimite(sb, hoy);
  const ganados = await tarjetasGanados(sb, hoy).catch(() => ({ creadas: 0 }));
  return { pasos, sincronizados: sinc.cambiados, tarjetas: tarjetas.creadas, sin_ficha: tarjetas.sin_ficha, limite: limite.avisos, crear_evento: ganados.creadas };
}

// --- panel -------------------------------------------------------------------------------

export async function listarEventos() {
  const sb = supabaseCharlas();
  const hoy = hoyMadrid();
  // Primero se pone al día lo de la Bandeja, para que el panel no enseñe como pendiente algo ya enviado.
  await sincronizarTareas(sb).catch(() => null);
  const { eventos, pasos } = await eventosYPasos(sb, sumar(hoy, -60));
  const fichaIds = [...new Set(eventos.map((e) => e.ficha_id).filter(Boolean))] as string[];
  const tareaIds = pasos.map((p) => p.tarea_id).filter(Boolean) as string[];
  const [fichas, tareas, postventa, ganados] = await Promise.all([
    fichaIds.length ? sb.from("crm_fichas").select(CAMPOS_FICHA).in("id", fichaIds) : Promise.resolve({ data: [] }),
    tareaIds.length ? sb.from("crm_tareas").select("id, estado").in("id", tareaIds) : Promise.resolve({ data: [] }),
    sb.from("eventos_postventa").select("*").gte("fecha_evento", sumar(hoy, -60)).order("fecha_evento", { ascending: false }),
    sb.from("crm_fichas").select("id, nombre, actualizado_en").eq("carril", "magia").eq("estado", "7 Ganado").order("nombre"),
  ]);
  const fichaPorId = new Map(((fichas.data ?? []) as Ficha[]).map((f) => [f.id, f]));
  const tareaPorId = new Map(((tareas.data ?? []) as { id: string; estado: string }[]).map((t) => [t.id, t.estado]));
  const conEvento = new Set(eventos.filter((e) => e.fecha_evento >= sumar(hoy, -30)).map((e) => e.ficha_id));
  return {
    hoy,
    eventos: eventos.map((e) => ({
      ...e,
      ficha: e.ficha_id ? fichaPorId.get(e.ficha_id) ?? null : null,
      pasos: pasos
        .filter((p) => p.evento_id === e.id)
        .sort((a, b) => ORDEN.indexOf(a.clave) - ORDEN.indexOf(b.clave))
        .map((p) => ({ ...p, tarea_estado: p.tarea_id ? tareaPorId.get(p.tarea_id) ?? null : null })),
    })),
    postventa: postventa.data ?? [],
    ganados_sin_evento: ((ganados.data ?? []) as { id: string; nombre: string }[]).filter((f) => !conEvento.has(f.id)),
  };
}

export async function marcarPaso(id: string, estado: EstadoPaso) {
  const sb = supabaseCharlas();
  const { data: p, error } = await sb
    .from("eventos_pasos")
    .update({ estado, hecho_en: estado === "hecho" ? hoyMadrid() : null, hecho_por: estado === "pendiente" ? null : "panel", aviso_limite_en: estado === "pendiente" ? null : undefined, actualizado_en: ahora() })
    .eq("id", id)
    .select("tarea_id")
    .single();
  if (error) throw new Error(error.message);
  if (estado !== "pendiente") await cerrarTarea(sb, p.tarea_id, estado === "hecho" ? "hecha" : "descartada", estado === "hecho" ? "Marcado como hecho en Eventos" : "Marcado como «no aplica» en Eventos");
  else if (p.tarea_id) await sb.from("eventos_pasos").update({ tarea_id: null }).eq("id", id);
  return { ok: true };
}

export async function editarEvento(id: string, cambios: { fecha_evento?: string; estado_evento?: string }) {
  const sb = supabaseCharlas();
  const fila: Record<string, unknown> = { actualizado_en: ahora() };
  if (cambios.fecha_evento) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cambios.fecha_evento)) throw new Error("La fecha no es válida.");
    fila.fecha_evento = cambios.fecha_evento;
  }
  if (cambios.estado_evento) fila.estado_evento = cambios.estado_evento.trim();
  const { error } = await sb.from("eventos").update(fila).eq("id", id);
  if (error) throw new Error(error.message);
  await asegurarPasos(sb, hoyMadrid());
  return { ok: true };
}

export interface DatosNuevoEvento {
  ficha_id?: string | null;
  cliente_ficha?: string;
  cliente?: string;
  fecha_evento: string;
  hora?: string;
  lugar?: string;
  show_base?: string;
  titulo?: string;
  via_pago?: string;
  importe_total?: string;
  importe_neto?: string;
  cartel?: boolean;
  recurrente?: boolean;
}

export async function crearEvento(d: DatosNuevoEvento) {
  const sb = supabaseCharlas();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha_evento ?? "")) throw new Error("Falta la fecha del evento.");
  let ficha: { id: string; nombre: string; responsable: string | null } | null = null;
  if (d.ficha_id) {
    const { data } = await sb.from("crm_fichas").select("id, nombre, responsable").eq("id", d.ficha_id).maybeSingle();
    ficha = data;
  }
  const cliente = (ficha?.nombre ?? d.cliente_ficha ?? "").trim();
  if (!cliente) throw new Error("Falta el cliente.");
  const titulo = (d.titulo || d.show_base || "Show de magia").trim();
  const limpio = (s: string) => s.replace(/[\/\\:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
  let nombre = limpio(`${d.fecha_evento} ${cliente} — ${titulo}`);
  if (d.recurrente && !esRecurrente(nombre)) nombre = limpio(`${d.fecha_evento} ${cliente} · Sesión`);
  const { data: existe } = await sb.from("eventos").select("id").eq("nombre", nombre).maybeSingle();
  if (existe) throw new Error(`Ya hay un evento con ese nombre: ${nombre}`);
  const num = (v?: string) => {
    const n = Number(String(v ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
    return Number.isFinite(n) && String(v ?? "").trim() ? n : "";
  };
  const frontmatter: Record<string, unknown> = {
    cliente_ficha: `[[${cliente}]]`,
    cliente: d.cliente?.trim() || (ficha?.responsable ? `${cliente} (${ficha.responsable})` : cliente),
    fecha_evento: d.fecha_evento,
    hora: d.hora?.trim() ?? "",
    lugar: d.lugar?.trim() ?? "",
    estado_evento: "confirmado",
    show_base: d.show_base?.trim() ?? "",
    via_pago: d.via_pago?.trim() ?? "",
    importe_total: num(d.importe_total),
    importe_neto: num(d.importe_neto),
    factura_emitida: "",
    fecha_cobro: "",
    cartel_enviado: d.cartel === false ? "-" : "",
    rider_enviado: "",
    mensaje_7dias: "",
    mensaje_vispera: "",
    testimonio_pedido: false,
    testimonio_recibido: false,
  };
  const { data: ev, error } = await sb
    .from("eventos")
    .insert({ nombre, carril: "magia", ficha_id: ficha?.id ?? null, cliente_ficha: cliente, fecha_evento: d.fecha_evento, estado_evento: "confirmado", tipo: d.recurrente ? "recurrente" : "show", fecha_cierre: hoyMadrid(), frontmatter, creado_desde: "panel" })
    .select("id, nombre")
    .single();
  if (error) throw new Error(error.message);
  await asegurarPasos(sb, hoyMadrid());
  // La tarjeta «Crear evento» de esa ficha queda atendida.
  if (ficha) await sb.from("crm_tareas").update({ estado: "hecha", motivo: `Evento creado: ${nombre}`, resuelto_en: ahora(), resuelto_por: "alain" }).eq("ficha_id", ficha.id).eq("tipo", "crear_evento").in("estado", ["revisar", "error"]);
  return ev;
}

/** Rellena el formulario de «Crear evento» con lo que diga el Registro de la ficha (IA barata). Alain lo revisa antes de guardar. */
export async function sugerirEvento(fichaId: string) {
  const sb = supabaseCharlas();
  const [{ data: f }, { data: reg }] = await Promise.all([
    sb.from("crm_fichas").select("nombre, responsable, tipo_entidad, localidad, idioma, ultimo_evento, proxima_accion, fecha_proxima_accion").eq("id", fichaId).single(),
    sb.from("crm_interacciones").select("fecha, canal, texto").eq("ficha_id", fichaId).order("fecha", { ascending: false, nullsFirst: false }).order("orden", { ascending: false }).limit(60),
  ]);
  if (!f) throw new Error("No encuentro la ficha.");
  const registro = (reg ?? []).reverse().map((r) => `- ${r.fecha ?? ""} · ${r.canal ?? ""} · ${String(r.texto).slice(0, 600)}`).join("\n");
  const r = await llamarClaude({
    system: [{ type: "text", text: `Extraes los datos de un evento de magia ya contratado a partir del registro de la ficha del cliente. Hoy es ${hoyMadrid()}. Si un dato no aparece claro, déjalo vacío: no inventes. Si hay varias versiones (precio corregido, fecha cambiada), quédate con la última. Responde solo con JSON: {"fecha_evento":"AAAA-MM-DD","hora":"HH:MM-HH:MM","lugar":"","show_base":"","titulo":"título corto para el nombre de la nota","via_pago":"cómo y cuándo se cobra, en pocas palabras","importe_total":"total con IVA, solo número","importe_neto":"a transferir, solo número","cartel":true|false|null,"recurrente":true|false,"contacto":"nombre de pila de quien organiza"}` }],
    usuario: `Ficha: ${f.nombre} (${[f.tipo_entidad, f.localidad, f.idioma].filter(Boolean).join(", ")}). Responsable: ${f.responsable ?? "—"}. Último evento: ${f.ultimo_evento ?? "—"}. Próxima acción: ${f.proxima_accion ?? "—"} (${f.fecha_proxima_accion ?? "—"}).\n\nRegistro:\n${registro || "(vacío)"}`,
    proposito: "magia_eventos_prefill",
    maxTokens: 600,
    modelo: MODELO_BARATO,
  });
  const ini = r.indexOf("{");
  const fin = r.lastIndexOf("}");
  if (ini < 0 || fin < ini) throw new Error("La IA no ha devuelto los datos.");
  return JSON.parse(r.slice(ini, fin + 1)) as Record<string, unknown>;
}
