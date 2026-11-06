import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth as auth } from "@/lib/admin-auth";
import { SLUG_RE } from "@/lib/arreta";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const entero = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : 0;
  return Number.isInteger(n) && n >= 0 && n <= 10000 ? n : null;
};

// POST → apuntar los post-its de una sesión.
export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof b.charla !== "string" || !SLUG_RE.test(b.charla)) return NextResponse.json({ error: "Elige la charla." }, { status: 400 });
  const sesion = typeof b.sesion === "string" ? b.sesion.trim().slice(0, 80) : "";
  if (!sesion) return NextResponse.json({ error: "Falta la sesión." }, { status: 400 });
  const fila: Record<string, unknown> = { charla: b.charla, sesion };
  for (const k of ["alumnos", "n1", "n2", "n3", "n4", "n5"]) {
    const n = entero(b[k]);
    if (n === null) return NextResponse.json({ error: `${k}: número entero no negativo.` }, { status: 400 });
    fila[k] = n;
  }

  const { error } = await supabase.from("arreta_postits").insert(fila);
  if (error?.code === "23503") return NextResponse.json({ error: "Esa charla no existe." }, { status: 400 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE ?id=<uuid> → borrar una sesión mal apuntada.
export async function DELETE(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !UUID.test(id)) return NextResponse.json({ error: "id inválido." }, { status: 400 });
  const { error } = await supabase.from("arreta_postits").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
