import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";

// Lectura del CRM de charlas para el panel.
//
//   GET /api/admin/charlas/centros            → lista completa (campos de tabla) + resumen por estado
//   GET /api/admin/charlas/centros?id=<uuid>  → una ficha con su Registro, contactos, tareas y eventos
//
// PATCH /api/admin/charlas/centros  { id, ...campos }  → edita una ficha desde el panel
//   Cambia `actualizado_por` a 'panel' y, si viene `registro`, añade esa
//   línea al Registro con origen 'panel'. Es la única puerta de edición: las
//   fichas del vault ya no se tocan a mano.

const CAMPOS_LISTA =
  "id, nombre, territorio, localidad, tipo, euskera, estado, via, responsable, responsable_email, email_centro, telefono, intentos_llamada, mails_enviados, fecha_ultimo_contacto, proxima_accion, bloqueado_por, fecha_proxima_accion, nivel_autonomia, actualizado_en";

const CAMPOS_EDITABLES = new Set([
  "estado",
  "via",
  "responsable",
  "responsable_cargo",
  "responsable_email",
  "responsable_tel",
  "ampa",
  "ampa_contacto",
  "ampa_email",
  "calendario_abierto",
  "intentos_llamada",
  "mails_enviados",
  "fecha_ultimo_contacto",
  "proxima_accion",
  "bloqueado_por",
  "fecha_proxima_accion",
  "prioridad",
  "notas",
  "nivel_autonomia",
  "email_centro",
  "telefono",
  "web",
]);

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const supabase = supabaseCharlas();
  const id = new URL(req.url).searchParams.get("id");

  if (id) {
    const [centro, registro, contactos, tareas, eventos] = await Promise.all([
      supabase.from("charlas_centros").select("*").eq("id", id).single(),
      supabase.from("charlas_interacciones").select("*").eq("centro_id", id).order("fecha", { ascending: true, nullsFirst: false }).order("orden"),
      supabase.from("charlas_contactos").select("*").eq("centro_id", id).order("creado_en"),
      supabase.from("charlas_tareas").select("*").eq("centro_id", id).order("creado_en", { ascending: false }).limit(50),
      supabase.from("charlas_eventos").select("*").eq("centro_id", id).order("fecha_evento"),
    ]);
    if (centro.error) return NextResponse.json({ error: centro.error.message }, { status: 404 });
    return NextResponse.json({
      centro: centro.data,
      registro: registro.data ?? [],
      contactos: contactos.data ?? [],
      tareas: tareas.data ?? [],
      eventos: eventos.data ?? [],
    });
  }

  // La lista entera cabe de sobra en una respuesta (344 filas, campos cortos).
  // Supabase corta a 1000 por defecto; se pide en dos tramos por si crece.
  const filas: unknown[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from("charlas_centros").select(CAMPOS_LISTA).order("nombre").range(desde, desde + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    filas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const porEstado: Record<string, number> = {};
  for (const f of filas as { estado: string }[]) porEstado[f.estado] = (porEstado[f.estado] ?? 0) + 1;

  return NextResponse.json({ centros: filas, por_estado: porEstado, total: filas.length });
}

export async function PATCH(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Falta id." }, { status: 400 });

  const supabase = supabaseCharlas();
  const cambios: Record<string, unknown> = { actualizado_por: "panel" };
  for (const [k, v] of Object.entries(body)) {
    if (CAMPOS_EDITABLES.has(k)) cambios[k] = v === "" ? null : v;
  }

  const { data, error } = await supabase.from("charlas_centros").update(cambios).eq("id", body.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (typeof body.registro === "string" && body.registro.trim()) {
    const hoy = new Date().toISOString().slice(0, 10);
    const canal = typeof body.registro_canal === "string" ? body.registro_canal : "Manual";
    await supabase.from("charlas_interacciones").insert({
      centro_id: body.id,
      fecha: hoy,
      canal,
      texto: body.registro.trim(),
      raw: `- ${hoy} · ${canal} · ${body.registro.trim()}`,
      orden: 999,
      origen: "panel",
    });
  }

  return NextResponse.json({ ok: true, centro: data });
}
