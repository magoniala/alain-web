import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth as auth } from "@/lib/admin-auth";
import { ESTADOS, LIMITES, type Estado } from "@/lib/quetal";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export const dynamic = "force-dynamic";

// Todas las valoraciones de organizadores, enteras, para /admin →
// Opiniones eventos. Los filtros se hacen en el navegador.
export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data, error } = await supabase
    .from("feedback_organizadores")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ valoraciones: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH ?id=<uuid> → solo los campos del admin.
export async function PATCH(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !UUID.test(id)) return NextResponse.json({ error: "id inválido." }, { status: 400 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const cambios: Record<string, unknown> = {};
  if ("estado" in b) {
    if (!ESTADOS.includes(b.estado as Estado)) return NextResponse.json({ error: "Estado no válido." }, { status: 400 });
    cambios.estado = b.estado;
  }
  if ("destacado" in b) cambios.destacado = b.destacado === true;
  for (const k of ["testimonio_editado", "notas_internas"] as const) {
    if (!(k in b)) continue;
    if (b[k] != null && typeof b[k] !== "string") return NextResponse.json({ error: `${k} no válido.` }, { status: 400 });
    const t = ((b[k] as string | null) ?? "").trim();
    cambios[k] = t ? t.slice(0, LIMITES.largo) : null;
  }
  if (!Object.keys(cambios).length) return NextResponse.json({ error: "Nada que cambiar." }, { status: 400 });

  const { data, error } = await supabase.from("feedback_organizadores").update(cambios).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ valoracion: data });
}
