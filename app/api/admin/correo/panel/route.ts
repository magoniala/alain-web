import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";
import { accionPanel } from "@/lib/correo-acciones";
import { panelPorRevisar, procesarCorreo } from "@/lib/correo-panel";

// Correo › Por revisar y Correo › Testimonios (adelanto de F1, 28-11-2026).
//
// GET                        → tarjetas abiertas, pendientes y pendientes hechos (30 días)
// GET ?vista=testimonios     → testimonios guardados (filtros: via, permiso, donde)
// POST { accion, … }         → ver lib/correo-acciones.ts; { accion: "procesar" } = «Actualizar ahora»

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const url = new URL(req.url);
  if (url.searchParams.get("vista") === "testimonios") {
    let q = supabaseCharlas().from("testimonios").select("*").order("creado_en", { ascending: false }).limit(500);
    const via = url.searchParams.get("via");
    const permiso = url.searchParams.get("permiso");
    const donde = url.searchParams.get("donde");
    if (via) q = q.eq("via", via);
    if (permiso) q = q.eq("permiso", permiso);
    if (donde) q = q.contains("donde", [donde]);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ testimonios: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(await panelPorRevisar(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (b.accion === "procesar") return NextResponse.json({ ok: true, resumen: await procesarCorreo({ presupuestoMs: 45000 }) });
    return NextResponse.json(await accionPanel(b));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
