import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET() {
  const { data, error } = await supabase
    .from("newsletter_contactos")
    .select("id, email, nombre, idioma, fecha_alta, origen, unsubscribed")
    .order("fecha_alta", { ascending: false });
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const { email, nombre, idioma, origen } = await req.json();
  if (!email) return NextResponse.json({ error: "Falta email." }, { status: 400 });
  const { data, error } = await supabase
    .from("newsletter_contactos")
    .upsert(
      { email, nombre: nombre || null, idioma: idioma || "es", origen: origen || "manual" },
      { onConflict: "email", ignoreDuplicates: true }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });
  return NextResponse.json({ ok: true, contacto: data });
}
