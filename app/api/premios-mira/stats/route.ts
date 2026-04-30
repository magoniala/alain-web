import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET() {
  const { data, error } = await supabase
    .from("premios_mira_stats")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const update: Record<string, number> = {};
  if (typeof body.visualizaciones_fase2 === "number") update.visualizaciones_fase2 = body.visualizaciones_fase2;
  if (typeof body.videos_publicados === "number") update.videos_publicados = body.videos_publicados;
  if (!Object.keys(update).length) return NextResponse.json({ error: "Sin campos." }, { status: 400 });
  const { error } = await supabase.from("premios_mira_stats").update(update).eq("id", 1);
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
