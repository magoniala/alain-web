import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { contarOcupadas, HORARIOS_MM, PLAZAS_MM, PLAZAS_TALLER, TALLER_SESIONES } from "@/lib/mirariak";

// Plazas del formulario público. Las reservas anuladas o en lista de espera
// (marcadas desde el panel) no cuentan: al anular, la plaza vuelve a salir.

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("mirariak2026_reservas")
    .select("participantes_taller, participantes_micromagia, horario_micromagia");

  if (error) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }

  const { taller, micromagia } = contarOcupadas(data ?? []);

  return NextResponse.json(
    {
      taller: Object.fromEntries(
        TALLER_SESIONES.map((s) => [s, { reservados: taller[s], total: PLAZAS_TALLER }])
      ),
      micromagia: Object.fromEntries(
        HORARIOS_MM.map((h) => [h, { reservados: micromagia[h], total: PLAZAS_MM }])
      ),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
