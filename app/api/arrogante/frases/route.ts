import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET() {
  const { data, error } = await supabase.from("arrogante_frases").select("*").order("sujeto_num");
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const { texto, sujeto_num } = await req.json();
  if (!texto || !sujeto_num) return NextResponse.json({ error: "Faltan campos." }, { status: 400 });
  const { error } = await supabase.from("arrogante_frases").insert({ texto, sujeto_num });
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const { id, texto, sujeto_num } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });
  const { error } = await supabase.from("arrogante_frases").update({ texto, sujeto_num }).eq("id", id);
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });
  const { error } = await supabase.from("arrogante_frases").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
