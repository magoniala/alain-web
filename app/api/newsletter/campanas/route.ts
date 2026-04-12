import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

function auth(req: Request) {
  const pw = req.headers.get("x-nl-password");
  return pw === process.env.NEWSLETTER_PASSWORD;
}

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await supabase
    .from("newsletter_campanas")
    .select("*")
    .order("programado_para", { ascending: true });
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = await req.json();
  const { subject_eu, body_eu, preheader_eu, subject_es, body_es, preheader_es, programado_para } = body;
  if (!programado_para) return NextResponse.json({ error: "Falta fecha." }, { status: 400 });
  if (!((subject_eu && body_eu) || (subject_es && body_es))) {
    return NextResponse.json({ error: "Necesitas al menos un idioma completo." }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("newsletter_campanas")
    .insert({ subject_eu, body_eu, preheader_eu, subject_es, body_es, preheader_es, programado_para })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Error al guardar." }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id, subject_eu, body_eu, preheader_eu, subject_es, body_es, preheader_es, programado_para } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });
  const { error } = await supabase
    .from("newsletter_campanas")
    .update({ subject_eu, body_eu, preheader_eu, subject_es, body_es, preheader_es, programado_para })
    .eq("id", id)
    .eq("estado", "programado");
  if (error) return NextResponse.json({ error: "Error al actualizar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });
  const { error } = await supabase
    .from("newsletter_campanas")
    .update({ estado: "cancelado" })
    .eq("id", id)
    .eq("estado", "programado");
  if (error) return NextResponse.json({ error: "Error al cancelar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
