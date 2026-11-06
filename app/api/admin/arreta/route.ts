import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth as auth } from "@/lib/admin-auth";
import { asignarCharla, type Charla, type Respuesta } from "@/lib/arreta";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Todo lo de /admin → Arreta de una vez: respuestas (con su charla ya
// asignada), charlas y post-its. Los filtros se hacen en el navegador.
export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const [r, c, p] = await Promise.all([
    supabase
      .from("arreta_respuestas")
      .select("id, created_at, probatu, ikasi, gustatu, gehitu, saioa, destacada")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("arreta_charlas").select("slug, nombre, centro, fecha_inicio, fecha_fin, margen_hasta").order("fecha_inicio", { ascending: false }),
    supabase.from("arreta_postits").select("*").order("created_at", { ascending: true }),
  ]);
  const error = r.error ?? c.error ?? p.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const charlas = (c.data ?? []) as Charla[];
  const respuestas: Respuesta[] = (r.data ?? []).map((x) => ({ ...(x as Omit<Respuesta, "charla">), charla: asignarCharla(x, charlas) }));
  return NextResponse.json({ respuestas, charlas, postits: p.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

// PATCH ?id=<uuid> { destacada: boolean } → marcar o desmarcar testimonio.
export async function PATCH(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !UUID.test(id)) return NextResponse.json({ error: "id inválido." }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof b.destacada !== "boolean") return NextResponse.json({ error: "destacada inválida." }, { status: 400 });

  const { error } = await supabase.from("arreta_respuestas").update({ destacada: b.destacada }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
