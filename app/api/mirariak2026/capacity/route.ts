import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const TALLER_SESIONES = ["10:00 – 10:55", "11:10 – 12:05", "12:20 – 13:15"];
const MICROMAGIA_HORARIOS = [
  "10:00 – 10:30",
  "11:00 – 11:30",
  "12:00 – 12:30",
  "17:30 – 18:00",
  "18:30 – 19:00",
];

export async function GET() {
  const { data, error } = await supabase
    .from("mirariak2026_reservas")
    .select("actividad, participantes_taller, participantes_micromagia, horario_micromagia");

  if (error) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }

  const tallerCounts: Record<string, number> = Object.fromEntries(
    TALLER_SESIONES.map((s) => [s, 0])
  );
  const micromagiaCounts: Record<string, number> = Object.fromEntries(
    MICROMAGIA_HORARIOS.map((h) => [h, 0])
  );

  for (const row of data ?? []) {
    if (row.actividad === "taller" || row.actividad === "ambas") {
      for (const p of row.participantes_taller ?? []) {
        if (p.sesion_asignada && p.sesion_asignada in tallerCounts) {
          tallerCounts[p.sesion_asignada]++;
        }
      }
    }
    if (row.actividad === "micromagia" || row.actividad === "ambas") {
      const h = row.horario_micromagia;
      if (h && h in micromagiaCounts) {
        micromagiaCounts[h] += (row.participantes_micromagia ?? []).length;
      }
    }
  }

  return NextResponse.json(
    {
      taller: Object.fromEntries(
        TALLER_SESIONES.map((s) => [s, { reservados: tallerCounts[s], total: 16 }])
      ),
      micromagia: Object.fromEntries(
        MICROMAGIA_HORARIOS.map((h) => [h, { reservados: micromagiaCounts[h], total: 20 }])
      ),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
