import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth as auth } from "@/lib/admin-auth";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cada cuánto se congela una copia en valoraciones_sesion_historial. La fila de
// valoraciones se sobrescribe en cada guardado; el historial es lo que
// permite recuperar un texto que se borró sin querer a mitad de sesión.
const HISTORIAL_CADA_MS = 2 * 60 * 1000;

const sinCache = { "Cache-Control": "no-store" };

// GET            → lista (sin los datos, que pueden pesar)
// GET ?id=<uuid> → una valoración entera
export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");

  if (id) {
    if (!UUID.test(id)) return NextResponse.json({ error: "id inválido." }, { status: 400 });
    const { data, error } = await supabase
      .from("valoraciones_sesion")
      .select("id, datos, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "No existe." }, { status: 404 });
    return NextResponse.json(data, { headers: sinCache });
  }

  const { data, error } = await supabase
    .from("valoraciones_sesion")
    .select("id, cliente, fecha, pareja_id, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ valoraciones: data }, { headers: sinCache });
}

// PUT { id, datos } → crea o sobrescribe. El id lo genera el navegador, para
// que una valoración empezada sin conexión tenga ya su identidad y se suba
// tal cual en cuanto vuelva la red.
export async function PUT(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = body?.id;
  const datos = body?.datos;
  if (typeof id !== "string" || !UUID.test(id)) {
    return NextResponse.json({ error: "id inválido." }, { status: 400 });
  }
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
    return NextResponse.json({ error: "datos inválidos." }, { status: 400 });
  }
  if (JSON.stringify(datos).length > 500_000) {
    return NextResponse.json({ error: "Demasiado grande." }, { status: 413 });
  }

  const cliente = typeof datos.cliente === "string" ? datos.cliente.trim().slice(0, 200) : "";
  const fecha = typeof datos.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) ? datos.fecha : null;
  const parejaId = typeof datos.parejaId === "string" && UUID.test(datos.parejaId) ? datos.parejaId : null;
  const ahora = new Date().toISOString();

  const { error } = await supabase
    .from("valoraciones_sesion")
    .upsert({ id, cliente, fecha, pareja_id: parejaId, datos, updated_at: ahora }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Copia de seguridad cada pocos minutos. Si falla, el guardado ya está
  // hecho: no se devuelve error por esto.
  const { data: ultima } = await supabase
    .from("valoraciones_sesion_historial")
    .select("guardado_en")
    .eq("valoracion_id", id)
    .order("guardado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ultima || Date.now() - new Date(ultima.guardado_en).getTime() > HISTORIAL_CADA_MS) {
    const { error: errHist } = await supabase.from("valoraciones_sesion_historial").insert({ valoracion_id: id, datos });
    if (errHist) console.error("valoraciones: historial:", errHist.message);
  }

  return NextResponse.json({ ok: true, updated_at: ahora }, { headers: sinCache });
}
