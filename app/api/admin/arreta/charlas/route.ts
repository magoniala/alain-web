import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth as auth } from "@/lib/admin-auth";
import { FECHA_RE, SLUG_RE } from "@/lib/arreta";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export const dynamic = "force-dynamic";

const txt = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

// POST → nueva charla. El slug es el que va en el QR: /arreta?c=<slug>.
export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const slug = typeof b.slug === "string" ? b.slug.trim().toLowerCase() : "";
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "Slug: solo minúsculas, números y guiones." }, { status: 400 });
  const nombre = txt(b.nombre, 120);
  if (!nombre) return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
  const [ini, fin, margen] = [b.fecha_inicio, b.fecha_fin, b.margen_hasta].map((f) => (typeof f === "string" && FECHA_RE.test(f) ? f : null));
  if (!ini || !fin || !margen) return NextResponse.json({ error: "Faltan fechas." }, { status: 400 });
  if (!(ini <= fin && fin <= margen)) return NextResponse.json({ error: "Las fechas deben ir inicio ≤ fin ≤ margen." }, { status: 400 });

  const { error } = await supabase
    .from("arreta_charlas")
    .insert({ slug, nombre, centro: txt(b.centro, 120), fecha_inicio: ini, fecha_fin: fin, margen_hasta: margen });
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "Ya existe una charla con ese slug." : error.message }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json({ ok: true });
}
