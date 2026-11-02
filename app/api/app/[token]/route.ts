import { NextResponse } from "next/server";
import { supabaseCharlas } from "@/lib/charlas";
import { sumarDias } from "@/lib/ent";

// App del cliente de Entrenatzaile (fase 7b). Entra con su enlace personal
// (/app/<token>); el token es la única credencial, como un enlace mágico.
//
//   GET  /api/app/<token>                → semana en curso (y siguiente), sesiones, ejercicios, lo registrado, formularios pendientes
//   GET  /api/app/<token>?semana=<id>    → otra semana (historial)
//   POST /api/app/<token> { accion, … }  → serie, sesion_cerrar, formulario, push, foto
//
// Las zonas de riesgo del cliente van en el formulario de recuperación y el
// post-sesión sigue el "Protocolo de notificaciones y formularios" del vault.

export const dynamic = "force-dynamic";

const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });

async function cliente(token: string) {
  if (!/^[a-f0-9]{24,64}$/.test(token)) return null;
  const { data } = await supabaseCharlas().from("ent_clientes").select("id, nombre, idioma, estado, zonas_riesgo, aviso_canal, token").eq("token", token).maybeSingle();
  return data && data.estado !== "baja" ? data : null;
}

async function semanaCompleta(id: string, clienteId: string) {
  const sb = supabaseCharlas();
  const [semana, sesiones] = await Promise.all([
    sb.from("ent_semanas").select("id, numero, lunes, titulo, notas, rir_objetivo, fase, estado, resumen").eq("id", id).eq("cliente_id", clienteId).single(),
    sb.from("ent_sesiones").select("id, clave, nombre, fecha, duracion_min, foco, calentamiento, notas, estado, rpe, minutos, hecha_en, ejercicios:ent_ejercicios(id, orden, nombre, series, reps, carga, tempo, descanso, rir, notas, video, superserie, campos)").eq("semana_id", id).order("fecha"),
  ]);
  if (semana.error) return null;
  const ids = (sesiones.data ?? []).map((s) => s.id);
  const [series, forms] = ids.length
    ? await Promise.all([sb.from("ent_series").select("*").in("sesion_id", ids).order("serie"), sb.from("ent_formularios").select("id, sesion_id, tipo, creado_en").in("sesion_id", ids)])
    : [{ data: [] }, { data: [] }];
  return {
    semana: semana.data,
    sesiones: (sesiones.data ?? []).map((s) => ({ ...s, ejercicios: (s.ejercicios ?? []).sort((a, b) => a.orden - b.orden) })),
    series: series.data ?? [],
    formularios: forms.data ?? [],
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const c = await cliente(token);
  if (!c) return NextResponse.json({ error: "Enlace no válido." }, { status: 404 });
  const sb = supabaseCharlas();
  const url = new URL(req.url);
  const h = hoy();
  const pedida = url.searchParams.get("semana");
  const { data: semanas } = await sb.from("ent_semanas").select("id, numero, lunes, titulo, estado").eq("cliente_id", c.id).neq("estado", "borrador").order("lunes");
  const lista = semanas ?? [];
  const actual = lista.find((s) => s.lunes <= h && sumarDias(s.lunes, 6) >= h) ?? lista.filter((s) => s.lunes <= h).at(-1) ?? lista[0] ?? null;
  const id = pedida ?? actual?.id;
  const detalle = id ? await semanaCompleta(id, c.id) : null;
  // Formulario de recuperación pendiente: de la última sesión hecha sin él, si ya pasó la hora (14:00 del día siguiente).
  // Formulario de recuperación pendiente: sesiones hechas entre hace 3 días y ayer, sin él.
  const { data: hechas } = await sb.from("ent_sesiones").select("id, nombre, fecha").eq("cliente_id", c.id).in("estado", ["hecha", "incompleta"]).gte("fecha", sumarDias(h, -3)).lt("fecha", h).order("fecha", { ascending: false });
  let recuperacionPendiente: { sesion_id: string; nombre: string; fecha: string } | null = null;
  if (hechas?.length) {
    const { data: ya } = await sb.from("ent_formularios").select("sesion_id").eq("tipo", "recuperacion").in("sesion_id", hechas.map((x) => x.id));
    const con = new Set((ya ?? []).map((x) => x.sesion_id));
    const falta = hechas.find((x) => !con.has(x.id));
    if (falta) recuperacionPendiente = { sesion_id: falta.id, nombre: falta.nombre, fecha: falta.fecha };
  }
  // Constancia: últimas 4 semanas programadas.
  const { data: ult } = await sb.from("ent_sesiones").select("estado, fecha").eq("cliente_id", c.id).gte("fecha", sumarDias(h, -28)).lt("fecha", h);
  const constancia = { hechas: (ult ?? []).filter((s) => s.estado === "hecha" || s.estado === "incompleta").length, programadas: (ult ?? []).length };
  // Marcar leídos los avisos de hoy (para que el panel sepa que abrió la app).
  await sb.from("ent_avisos").update({ leido_en: new Date().toISOString() }).eq("cliente_id", c.id).eq("estado", "enviado").is("leido_en", null).lte("programado_para", new Date().toISOString());
  return NextResponse.json({ cliente: { nombre: c.nombre, idioma: c.idioma, zonas_riesgo: c.zonas_riesgo, aviso_canal: c.aviso_canal }, hoy: h, semanas: lista, actual_id: actual?.id ?? null, ...(detalle ?? { semana: null, sesiones: [], series: [], formularios: [] }), recuperacion_pendiente: recuperacionPendiente, constancia, vapid: process.env.VAPID_PUBLIC_KEY ?? null });
}

const num = (v: unknown) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

function alertaPost(r: Record<string, unknown>, zonas: string | null) {
  const al: string[] = [];
  const molestia = num(r.molestia_intensidad);
  if (r.molestia === true || (molestia ?? 0) > 0) al.push(`Molestia${r.molestia_donde ? ` en ${r.molestia_donde}` : ""}${molestia ? ` (${molestia}/10)` : ""}`);
  if (molestia !== null && molestia >= 4) al[al.length - 1] += " ⚠︎ cambiar el ejercicio antes de la siguiente";
  const rpe = num(r.rpe);
  if (rpe !== null && rpe >= 9) al.push(`RPE ${rpe}: carga pasada`);
  if (r.todo === false) al.push(`No lo hizo todo${r.que_falto ? `: ${r.que_falto}` : ""}`);
  void zonas;
  return al.length ? al.join(" · ") : null;
}
function alertaRecuperacion(r: Record<string, unknown>) {
  const al: string[] = [];
  const ag = num(r.agujetas);
  const en = num(r.energia);
  if ((ag !== null && ag >= 4) || (en !== null && en <= 2)) al.push(`Agujetas ${ag ?? "?"}/5, energía ${en ?? "?"}/5: recortar la siguiente sesión`);
  if (r.molestia_nueva === true) al.push(`Molestia nueva${r.molestia_donde ? ` en ${r.molestia_donde}` : ""}`);
  if (r.trabajo_duro === true || r.trabajo_duro === "hoy" || r.trabajo_duro === "manana") al.push(`Trabajo físico duro ${r.trabajo_duro === "manana" ? "mañana" : "hoy"}: la pesada no va pegada`);
  return al.length ? al.join(" · ") : null;
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const c = await cliente(token);
  if (!c) return NextResponse.json({ error: "Enlace no válido." }, { status: 404 });
  const sb = supabaseCharlas();
  const b = await req.json().catch(() => ({}));
  // Toda sesión que se toque tiene que ser de este cliente.
  const sesionDe = async (id: string) => (await sb.from("ent_sesiones").select("id, estado, fecha, nombre, semana_id").eq("id", id).eq("cliente_id", c.id).maybeSingle()).data;
  try {
    switch (b.accion) {
      case "serie": {
        // Una serie registrada (o corregida): { ejercicio_id, serie, lado?, reps?, peso?, rir?, tiempo_s?, tempo?, nota?, completada? }
        const { data: ej } = await sb.from("ent_ejercicios").select("id, sesion_id").eq("id", b.ejercicio_id).single();
        if (!ej) return NextResponse.json({ error: "Ejercicio no encontrado." }, { status: 404 });
        const s = await sesionDe(ej.sesion_id);
        if (!s) return NextResponse.json({ error: "No es tu sesión." }, { status: 403 });
        const fila = { ejercicio_id: ej.id, sesion_id: s.id, serie: Number(b.serie), lado: b.lado ?? null, reps: num(b.reps), peso: num(b.peso), rir: num(b.rir), tiempo_s: num(b.tiempo_s), tempo: b.tempo ?? null, nota: b.nota ?? null, origen: "cliente" };
        const { data: prev } = await sb.from("ent_series").select("id").eq("ejercicio_id", ej.id).eq("serie", fila.serie).is("lado", fila.lado).maybeSingle();
        const r = prev ? await sb.from("ent_series").update(fila).eq("id", prev.id).select().single() : await sb.from("ent_series").insert(fila).select().single();
        if (r.error) throw new Error(r.error.message);
        return NextResponse.json({ ok: true, serie: r.data });
      }
      case "sesion_empezar": {
        const s = await sesionDe(b.sesion_id);
        if (!s) return NextResponse.json({ error: "No es tu sesión." }, { status: 403 });
        return NextResponse.json({ ok: true });
      }
      case "sesion_cerrar": {
        // Cierra la sesión con el formulario post-sesión: { sesion_id, rpe, minutos, todo, que_falto, molestia, molestia_donde, molestia_intensidad, costo, videos }
        const s = await sesionDe(b.sesion_id);
        if (!s) return NextResponse.json({ error: "No es tu sesión." }, { status: 403 });
        const r = (b.respuestas ?? {}) as Record<string, unknown>;
        const alerta = alertaPost(r, c.zonas_riesgo);
        const { error } = await sb.from("ent_sesiones").update({ estado: r.todo === false ? "incompleta" : "hecha", hecha_en: new Date().toISOString(), rpe: num(r.rpe), minutos: num(r.minutos) }).eq("id", s.id);
        if (error) throw new Error(error.message);
        const fotos = Array.isArray(b.fotos) ? (b.fotos as string[]) : [];
        const f1 = await sb.from("ent_formularios").insert({ cliente_id: c.id, sesion_id: s.id, tipo: "post", respuestas: fotos.length ? { ...r, fotos } : r, alerta });
        if (f1.error) throw new Error(f1.error.message);
        // El "¿al final no ha podido ser?" de hoy ya no hace falta.
        await sb.from("ent_avisos").update({ estado: "omitido", error: "Ya registró la sesión" }).eq("sesion_id", s.id).eq("tipo", "si_no_registra").eq("estado", "programado");
        return NextResponse.json({ ok: true, alerta });
      }
      case "sesion_mover": {
        // El cliente la mueve a otro día de la misma semana (o la salta con motivo).
        const s = await sesionDe(b.sesion_id);
        if (!s) return NextResponse.json({ error: "No es tu sesión." }, { status: 403 });
        if (b.saltar) {
          await sb.from("ent_sesiones").update({ estado: "saltada", notas: b.motivo ? `Saltada: ${b.motivo}` : null }).eq("id", s.id);
          await sb.from("ent_avisos").update({ estado: "cancelado" }).eq("sesion_id", s.id).eq("estado", "programado");
          return NextResponse.json({ ok: true });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.fecha))) return NextResponse.json({ error: "Fecha no válida." }, { status: 400 });
        await sb.from("ent_sesiones").update({ fecha: b.fecha, estado: "programada" }).eq("id", s.id);
        const { generarAvisos } = await import("@/lib/ent");
        await generarAvisos(s.semana_id).catch(() => null);
        return NextResponse.json({ ok: true });
      }
      case "recuperacion": {
        // Formulario de recuperación (D+1): { sesion_id, respuestas: {agujetas, agujetas_donde, energia, sueno_calidad, sueno_horas, molestia_nueva, molestia_donde, trabajo_duro, comentario} }
        const s = await sesionDe(b.sesion_id);
        if (!s) return NextResponse.json({ error: "No es tu sesión." }, { status: 403 });
        const r = (b.respuestas ?? {}) as Record<string, unknown>;
        const alerta = alertaRecuperacion(r);
        const { error } = await sb.from("ent_formularios").insert({ cliente_id: c.id, sesion_id: s.id, tipo: "recuperacion", respuestas: r, alerta });
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, alerta });
      }
      case "push": {
        const s = b.suscripcion as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined;
        if (!s?.endpoint || !s.keys?.p256dh || !s.keys.auth) return NextResponse.json({ error: "Suscripción incompleta." }, { status: 400 });
        const { error } = await sb.from("ent_push").upsert({ cliente_id: c.id, endpoint: s.endpoint, claves: { p256dh: s.keys.p256dh, auth: s.keys.auth }, dispositivo: String(b.dispositivo ?? "").slice(0, 120), fallos: 0 }, { onConflict: "endpoint" });
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "foto_url": {
        // URL firmada para subir una foto al bucket privado (solo la ve Alain desde Supabase o el panel).
        const nombre = `${c.id}/${hoy()}-${Math.random().toString(36).slice(2, 8)}.${String(b.ext ?? "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 4) || "jpg"}`;
        const { data, error } = await sb.storage.from("ent-fotos").createSignedUploadUrl(nombre);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, ruta: nombre, url: data.signedUrl, token: data.token });
      }
      default:
        return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
