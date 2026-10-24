import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth as auth } from "@/lib/admin-auth";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export const dynamic = "force-dynamic";

// Todos los PAR-Q+ recibidos, enteros, para la pestaña PAR-Q+ de /admin.
// A cada uno se le añaden las valoraciones que lo tienen vinculado.
export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data, error } = await supabase
    .from("parq_respuestas")
    .select(
      "id, nombre, email, telefono, resultado, respuestas, consent_datos, consent_datos_en, consent_datos_texto, consentimientos_version, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, enviado_en, aviso_enviado, aviso_error"
    )
    .order("enviado_en", { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Si la tabla de valoraciones aún no existe, el PAR-Q+ se enseña igual.
  const { data: vals } = await supabase
    .from("valoraciones_sesion")
    .select("id, cliente, fecha, parq_id:datos->>parqId")
    .not("datos->>parqId", "is", null)
    .limit(2000);

  const porParq = new Map<string, { id: string; cliente: string | null; fecha: string | null }[]>();
  for (const v of (vals ?? []) as { id: string; cliente: string | null; fecha: string | null; parq_id: string | null }[]) {
    if (!v.parq_id) continue;
    const l = porParq.get(v.parq_id) ?? [];
    l.push({ id: v.id, cliente: v.cliente, fecha: v.fecha });
    porParq.set(v.parq_id, l);
  }

  const parq = (data ?? []).map((p) => ({ ...p, valoraciones: porParq.get(p.id) ?? [] }));
  return NextResponse.json({ parq }, { headers: { "Cache-Control": "no-store" } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DELETE ?id=<uuid> → borra el PAR-Q+. Las valoraciones que lo tenían
// vinculado guardan una copia de sus respuestas: se quita también, para que
// borrar el cuestionario lo borre de verdad. El resto de la valoración (mis
// notas de la sesión) no se toca.
export async function DELETE(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !UUID.test(id)) return NextResponse.json({ error: "id inválido." }, { status: 400 });

  const { data: vals } = await supabase.from("valoraciones_sesion").select("id, datos").eq("datos->>parqId", id);
  for (const v of (vals ?? []) as { id: string; datos: Record<string, unknown> | null }[]) {
    const datos = { ...(v.datos ?? {}) };
    delete datos.parqId;
    delete datos.parq;
    const { error } = await supabase.from("valoraciones_sesion").update({ datos }).eq("id", v.id);
    if (error) return NextResponse.json({ error: `No se ha podido desvincular de la valoración: ${error.message}` }, { status: 500 });
  }

  const { error } = await supabase.from("parq_respuestas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, desvinculadas: vals?.length ?? 0 }, { headers: { "Cache-Control": "no-store" } });
}
