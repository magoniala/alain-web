import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function auth(req: Request) {
  return req.headers.get("x-stats-password") === process.env.STATS_PASSWORD;
}

// Agrupa un timestamp UTC por día en horario de Madrid. El formato sv-SE
// da directamente YYYY-MM-DD, cómodo como clave de agrupación.
function diaLocal(iso: string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date(iso));
}

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const url = new URL(req.url);
  const landing = url.searchParams.get("landing") || "guias";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Faltan fechas." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("landing_visitas")
    .select("created_at")
    .eq("landing", landing)
    .gte("created_at", `${from}T00:00:00.000Z`)
    .lte("created_at", `${to}T23:59:59.999Z`);

  if (error) {
    console.error("estadisticas query error:", error);
    return NextResponse.json({ error: "Error consultando las visitas." }, { status: 500 });
  }

  const porDia: Record<string, number> = {};
  for (const row of data ?? []) {
    const dia = diaLocal(row.created_at);
    porDia[dia] = (porDia[dia] || 0) + 1;
  }

  const dias = Object.entries(porDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, visitas]) => ({ fecha, visitas }));

  return NextResponse.json(
    { total: data?.length ?? 0, dias },
    { headers: { "Cache-Control": "no-store" } }
  );
}
