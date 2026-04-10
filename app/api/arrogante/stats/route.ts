import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const ALLOWED = ["personas_testadas", "conocen_gilipollas", "creen_que_diran_su_nombre", "tests_aceptados"];

export async function GET() {
  const { data, error } = await supabase.from("arrogante_stats").select("*").eq("id", 1).single();
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const update: Record<string, number> = {};
  for (const key of ALLOWED) {
    if (typeof body[key] === "number") update[key] = body[key];
  }
  const { error } = await supabase.from("arrogante_stats").update(update).eq("id", 1);
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
