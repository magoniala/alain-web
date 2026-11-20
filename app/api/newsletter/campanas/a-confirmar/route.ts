import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth as auth } from "@/lib/admin-auth";
import { MARCA_DEVUELTO_A_CONFIRMAR } from "@/lib/newsletter-fechas";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Devuelve a «Por confirmar» un mail que ya estaba en Programadas o en la cola B
// (20-11-2026), para revisarlo antes de que salga. Es la vuelta de
// /api/newsletter/campanas/confirmar: pasa el mail a estado 'pendiente' y NO toca
// asunto, preheader, cuerpo ES/EU ni la fecha (programado_para), que se quedan
// como estaban. Si venía de la cola B no tiene fecha y, al confirmarlo, vuelve
// al final de la cola B (como cualquier pendiente sin fecha).
//
// La marca en orden_cola le dice a /confirmar que este mail viene de aquí (ver
// MARCA_DEVUELTO_A_CONFIRMAR). El cron solo envía 'programado' y 'cola', así
// que en cuanto el mail es 'pendiente' no sale sin tu OK.
export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });

  const { data: c, error: leerError } = await supabase
    .from("newsletter_campanas")
    .select("id, estado")
    .eq("id", id)
    .maybeSingle();
  if (leerError) return NextResponse.json({ error: `Error al leer el mail: ${leerError.message}` }, { status: 500 });
  if (!c) return NextResponse.json({ error: "No existe ese mail." }, { status: 404 });
  if (c.estado !== "programado" && c.estado !== "cola") {
    return NextResponse.json(
      { error: "Este mail ya no está en Programadas ni en la cola B (puede que ya se esté enviando): recarga el panel." },
      { status: 409 }
    );
  }

  // Condicionado al estado leído: si el cron lo ha cogido entre medias, no cambia nada.
  const { data: hecho, error } = await supabase
    .from("newsletter_campanas")
    .update({ estado: "pendiente", orden_cola: MARCA_DEVUELTO_A_CONFIRMAR })
    .eq("id", id)
    .eq("estado", c.estado)
    .select("id, estado, programado_para");
  if (error) return NextResponse.json({ error: `Error al mandarlo a Por confirmar: ${error.message}` }, { status: 500 });
  if (!hecho?.length) return NextResponse.json({ error: "Otro cambio se adelantó (¿ya se estaba enviando?): recarga el panel." }, { status: 409 });
  return NextResponse.json({ ok: true, estado: "pendiente", programado_para: hecho[0].programado_para });
}
