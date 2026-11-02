import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";

// Fichas del CRM genérico (carril magia por ahora).
//
//   GET   /api/admin/crm/fichas?carril=magia           → lista + resumen por estado y segmento
//   GET   /api/admin/crm/fichas?id=<uuid>              → ficha con Registro, tareas y mensajes
//   PATCH /api/admin/crm/fichas  { id, ...campos, registro?, registro_canal? }

const CAMPOS_LISTA =
  "id, carril, nombre, segmento, tipo_entidad, territorio, localidad, prioridad, estado, canal, idioma, responsable, responsable_email, responsable_tel, email, telefono, ultimo_evento, fecha_ultimo_evento, mes_temporada, mails_enviados, intentos_llamada, fecha_ultimo_contacto, proxima_accion, bloqueado_por, fecha_proxima_accion, nivel_autonomia, actualizado_en";

const EDITABLES = new Set([
  "estado", "segmento", "tipo_entidad", "prioridad", "canal", "idioma", "responsable", "responsable_cargo", "responsable_email", "responsable_tel",
  "email", "telefono", "web", "localidad", "territorio", "ultimo_evento", "fecha_ultimo_evento", "mes_temporada", "intentos_llamada", "mails_enviados",
  "fecha_ultimo_contacto", "proxima_accion", "bloqueado_por", "fecha_proxima_accion", "nivel_autonomia", "ficha_charlas",
]);

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const sb = supabaseCharlas();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const carril = url.searchParams.get("carril") ?? "magia";
  if (id) {
    const [ficha, registro, tareas, mensajes] = await Promise.all([
      sb.from("crm_fichas").select("*").eq("id", id).single(),
      sb.from("crm_interacciones").select("*").eq("ficha_id", id).order("fecha", { ascending: true, nullsFirst: false }).order("orden"),
      sb.from("crm_tareas").select("id, tipo, canal, nivel, estado, urgencia, creado_en, resuelto_en, texto_final").eq("ficha_id", id).order("creado_en", { ascending: false }).limit(30),
      sb.from("crm_mensajes").select("id, direccion, de, para, asunto, fecha, texto, clasificacion, resumen").eq("ficha_id", id).order("fecha", { ascending: false }).limit(20),
    ]);
    if (ficha.error) return NextResponse.json({ error: ficha.error.message }, { status: 404 });
    return NextResponse.json({ ficha: ficha.data, registro: registro.data ?? [], tareas: tareas.data ?? [], mensajes: mensajes.data ?? [] });
  }
  const filas: Record<string, unknown>[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.from("crm_fichas").select(CAMPOS_LISTA).eq("carril", carril).order("nombre").range(desde, desde + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    filas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const porEstado: Record<string, number> = {};
  const porSegmento: Record<string, number> = {};
  for (const f of filas as { estado: string; segmento: string | null }[]) {
    porEstado[f.estado] = (porEstado[f.estado] ?? 0) + 1;
    porSegmento[f.segmento ?? "—"] = (porSegmento[f.segmento ?? "—"] ?? 0) + 1;
  }
  return NextResponse.json({ fichas: filas, por_estado: porEstado, por_segmento: porSegmento, total: filas.length });
}

export async function PATCH(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Falta id." }, { status: 400 });
  const sb = supabaseCharlas();
  const cambios: Record<string, unknown> = { actualizado_por: "panel" };
  for (const [k, v] of Object.entries(body)) if (EDITABLES.has(k)) cambios[k] = v === "" ? null : v;
  const { data, error } = await sb.from("crm_fichas").update(cambios).eq("id", body.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (typeof body.registro === "string" && body.registro.trim()) {
    const hoy = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
    const canal = typeof body.registro_canal === "string" ? body.registro_canal : "Manual";
    await sb.from("crm_interacciones").insert({ ficha_id: body.id, fecha: hoy, canal, texto: body.registro.trim(), raw: `- ${hoy} · ${canal} · ${body.registro.trim()}`, orden: 999, origen: "panel" });
  }
  return NextResponse.json({ ok: true, ficha: data });
}
