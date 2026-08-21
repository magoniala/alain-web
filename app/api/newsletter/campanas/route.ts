import { createClient } from "@supabase/supabase-js";
import { NEWSLETTER_SENDERS } from "@/lib/email-ses";
import { requireAdminAuth as auth } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

function resolveRemitente(remitente?: string): string {
  return NEWSLETTER_SENDERS.includes(remitente as (typeof NEWSLETTER_SENDERS)[number]) ? remitente! : NEWSLETTER_SENDERS[0];
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

// Siguiente hueco al final de la cola B
async function siguienteOrdenCola(): Promise<number> {
  const { data } = await supabase
    .from("newsletter_campanas")
    .select("orden_cola")
    .eq("estado", "cola")
    .order("orden_cola", { ascending: false })
    .limit(1);
  return (data?.[0]?.orden_cola ?? 0) + 1;
}

export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = await req.json();
  const { subject_eu, body_eu, preheader_eu, subject_es, body_es, preheader_es, programado_para, remitente, en_cola } = body;
  if (!en_cola && !programado_para) return NextResponse.json({ error: "Falta fecha." }, { status: 400 });
  if (!((subject_eu && body_eu) || (subject_es && body_es))) {
    return NextResponse.json({ error: "Necesitas al menos un idioma completo." }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("newsletter_campanas")
    .insert({
      subject_eu, body_eu, preheader_eu, subject_es, body_es, preheader_es,
      remitente: resolveRemitente(remitente),
      ...(en_cola
        ? { estado: "cola", programado_para: null, orden_cola: await siguienteOrdenCola() }
        : { programado_para }),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Error al guardar." }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id, subject_eu, body_eu, preheader_eu, subject_es, body_es, preheader_es, programado_para, excluidos, remitente, en_cola } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });

  const update: Record<string, unknown> = {
    subject_eu, body_eu, preheader_eu, subject_es, body_es, preheader_es, excluidos,
    remitente: resolveRemitente(remitente),
  };

  // Mover entre cola y calendario. Sin ninguna de las dos, solo se edita el
  // contenido y la campaña se queda donde está.
  if (en_cola) {
    update.estado = "cola";
    update.programado_para = null;
    update.orden_cola = await siguienteOrdenCola();
  } else if (programado_para) {
    update.estado = "programado";
    update.programado_para = programado_para;
    update.orden_cola = null;
  }

  const { error } = await supabase
    .from("newsletter_campanas")
    .update(update)
    .eq("id", id)
    .in("estado", ["programado", "cola"]);
  if (error) return NextResponse.json({ error: "Error al actualizar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });
  const { error } = await supabase
    .from("newsletter_campanas")
    .update({ estado: "cancelado", orden_cola: null })
    .eq("id", id)
    .in("estado", ["programado", "cola"]);
  if (error) return NextResponse.json({ error: "Error al cancelar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
