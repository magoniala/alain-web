import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: contactos, error } = await supabase
    .from("newsletter_contactos")
    .select(
      "id, email, nombre, idioma, recibe_secuencia, posicion_secuencia, secuencia_completada, fecha_ultimo_mail_secuencia, unsubscribed"
    )
    .or("recibe_secuencia.eq.true,secuencia_completada.eq.true")
    .order("fecha_ultimo_mail_secuencia", { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });

  const { data: mails } = await supabase.from("secuencia_mails").select("posicion, asunto, activo");
  const porPosicion = new Map((mails ?? []).map((m) => [m.posicion, m]));

  const result = (contactos ?? []).map((c) => {
    const siguiente = porPosicion.get(c.posicion_secuencia);
    return {
      ...c,
      siguiente_asunto: !c.secuencia_completada && siguiente?.activo ? siguiente.asunto : null,
    };
  });

  return NextResponse.json(result);
}

export async function PATCH(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id, recibe_secuencia } = await req.json();
  if (!id || typeof recibe_secuencia !== "boolean") {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const { error } = await supabase.from("newsletter_contactos").update({ recibe_secuencia }).eq("id", id);
  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
