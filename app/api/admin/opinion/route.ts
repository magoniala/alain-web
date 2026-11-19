import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth as auth } from "@/lib/admin-auth";
import { ESTADOS, EVENTOS, LIMITES, UUID_RE, type Estado } from "@/lib/opinion";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export const dynamic = "force-dynamic";

const CAMPOS = "id, creado, actualizado, evento, origen, idioma, nota, texto_peques, texto_adulto, palabra, mejora_privada, permiso, nombre, email, terminado, estado, destacado, texto_editado, notas_internas";

// Opiniones de familias para /admin → Opiniones familias. Los filtros se
// hacen en el navegador. La clave de cada fila no sale de aquí.
export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await supabase.from("opiniones_familias").select(CAMPOS).order("creado", { ascending: false }).limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const eventos = Object.values(EVENTOS).map((e) => ({ clave: e.clave, nombre: e.nombre, ruta: e.ruta }));
  return NextResponse.json({ opiniones: data ?? [], eventos }, { headers: { "Cache-Control": "no-store" } });
}

// PATCH ?id=<uuid> → solo los campos del admin.
export async function PATCH(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: "id inválido." }, { status: 400 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const cambios: Record<string, unknown> = {};
  if ("estado" in b) {
    if (!ESTADOS.includes(b.estado as Estado)) return NextResponse.json({ error: "Estado no válido." }, { status: 400 });
    cambios.estado = b.estado;
  }
  if ("destacado" in b) cambios.destacado = b.destacado === true;
  for (const k of ["texto_editado", "notas_internas"] as const) {
    if (!(k in b)) continue;
    if (b[k] != null && typeof b[k] !== "string") return NextResponse.json({ error: `${k} no válido.` }, { status: 400 });
    const t = ((b[k] as string | null) ?? "").trim();
    cambios[k] = t ? t.slice(0, LIMITES.texto * 2) : null;
  }
  if (!Object.keys(cambios).length) return NextResponse.json({ error: "Nada que cambiar." }, { status: 400 });

  const { data, error } = await supabase.from("opiniones_familias").update(cambios).eq("id", id).select(CAMPOS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ opinion: data });
}
