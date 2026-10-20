import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/admin-auth";
import { pasarANewsletter } from "@/lib/nurture";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: contactos, error } = await supabase
    .from("newsletter_contactos")
    .select(
      "id, email, nombre, idioma, recibe_secuencia, posicion_secuencia, secuencia_completada, fecha_ultimo_mail_secuencia, unsubscribed, hoja_ruta_reservada_en, transicion_para, transicion_enviada_en"
    )
    .or("recibe_secuencia.eq.true,secuencia_completada.eq.true,hoja_ruta_reservada_en.not.is.null")
    .order("fecha_ultimo_mail_secuencia", { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ error: "Error." }, { status: 500 });

  const { data: mails } = await supabase.from("secuencia_mails").select("posicion, asunto, activo").eq("secuencia", "nurture").eq("idioma", "es");
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

// "Reservó Hoja de Ruta → pasar a newsletter". Toda la lógica (idempotencia,
// candados, qué día sale la transición) vive en pasarANewsletter().
export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id || typeof id !== "string") return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const r = await pasarANewsletter(id);
  if (!("motivo" in r)) return NextResponse.json({ ok: true, ...r });

  const status = { enviando: 409, "no-aplica": 409, "no-existe": 404, "sin-mail": 409, error: 500 }[r.estado];
  return NextResponse.json({ error: r.motivo, estado: r.estado }, { status });
}
