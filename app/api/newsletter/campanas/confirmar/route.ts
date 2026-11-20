import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth as auth } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Confirmación de Alain (20-11-2026). Las tareas de Claude dejan los mails en
// estado 'pendiente': con fecha (van al calendario) o sin ella (van a la cola B).
// El cron solo envía 'programado' y 'cola', así que nada sale sin pasar por aquí.
export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });

  const { data: c, error: leerError } = await supabase
    .from("newsletter_campanas")
    .select("id, estado, programado_para, subject_es, body_es, subject_eu, body_eu")
    .eq("id", id)
    .maybeSingle();
  if (leerError) return NextResponse.json({ error: `Error al leer el mail: ${leerError.message}` }, { status: 500 });
  if (!c) return NextResponse.json({ error: "No existe ese mail." }, { status: 404 });
  if (c.estado !== "pendiente") return NextResponse.json({ error: "Este mail ya no está pendiente de confirmar." }, { status: 409 });
  if (!((c.subject_es && c.body_es) || (c.subject_eu && c.body_eu))) {
    return NextResponse.json({ error: "Le falta el asunto o el texto: complétalo antes de confirmar." }, { status: 400 });
  }

  let update: Record<string, unknown>;
  if (c.programado_para) {
    if (new Date(c.programado_para).getTime() < Date.now()) {
      return NextResponse.json({ error: "La fecha de envío ya ha pasado: ponle otra fecha y vuelve a confirmar." }, { status: 409 });
    }
    update = { estado: "programado", orden_cola: null };
  } else {
    const { data: ultimo } = await supabase
      .from("newsletter_campanas")
      .select("orden_cola")
      .eq("estado", "cola")
      .order("orden_cola", { ascending: false })
      .limit(1);
    update = { estado: "cola", orden_cola: (ultimo?.[0]?.orden_cola ?? 0) + 1 };
  }

  const { data: hecho, error } = await supabase
    .from("newsletter_campanas")
    .update(update)
    .eq("id", id)
    .eq("estado", "pendiente")
    .select("id, estado");
  if (error) return NextResponse.json({ error: `Error al confirmar: ${error.message}` }, { status: 500 });
  if (!hecho?.length) return NextResponse.json({ error: "Otro cambio se adelantó: recarga el panel." }, { status: 409 });
  return NextResponse.json({ ok: true, estado: hecho[0].estado });
}
