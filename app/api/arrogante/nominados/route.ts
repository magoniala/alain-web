import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const soloPublicadas = url.searchParams.get("publicadas") === "true";

  let query = supabase
    .from("arrogante_respuestas")
    .select("id, respuesta_texto_libre, publicado, fecha, origen")
    .not("respuesta_texto_libre", "is", null)
    .order("fecha", { ascending: false });

  if (soloPublicadas) query = query.eq("publicado", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: Request) {
  const { id, publicado, respuesta_texto_libre } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });
  const update: Record<string, unknown> = {};
  if (publicado !== undefined) update.publicado = publicado;
  if (respuesta_texto_libre !== undefined) update.respuesta_texto_libre = respuesta_texto_libre;
  const { error } = await supabase
    .from("arrogante_respuestas")
    .update(update)
    .eq("id", id);
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
