import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/admin-auth";
import { wrapNurture } from "@/lib/nurture";
import { sendEmail, resolveNewsletterFrom, NEWSLETTER_SENDERS } from "@/lib/email-ses";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Posiciones fuera de la progresión normal (0, 1, 2…): mails puntuales que se
// disparan por su propia regla y nunca por posicion_secuencia.
const POSICIONES_ESPECIALES = [-1, -2];

function esPosicionValida(p: unknown): p is number {
  return typeof p === "number" && Number.isInteger(p) && p >= -2 && p <= 99;
}

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: mails, error } = await supabase
    .from("secuencia_mails")
    .select("posicion, asunto, cuerpo_html, remitente, activo")
    .order("posicion", { ascending: true });

  if (error) {
    console.error("admin/nurture/mails GET:", error);
    return NextResponse.json({ error: "Error al cargar los mails." }, { status: 500 });
  }

  // Cuánta gente está parada ahora mismo en cada posición: editar (o desactivar)
  // un mail afecta justo a esas personas, así que se ve al lado de cada uno.
  const { data: contactos } = await supabase
    .from("newsletter_contactos")
    .select("posicion_secuencia")
    .eq("recibe_secuencia", true)
    .eq("secuencia_completada", false)
    .eq("unsubscribed", false);

  const esperando: Record<string, number> = {};
  for (const c of contactos ?? []) {
    const k = String(c.posicion_secuencia);
    esperando[k] = (esperando[k] ?? 0) + 1;
  }

  return NextResponse.json(
    { mails: mails ?? [], esperando, remitentes: NEWSLETTER_SENDERS },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// Crea o actualiza el mail de una posición.
export async function PUT(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { posicion, asunto, cuerpo_html, remitente, activo } = body;

  if (!esPosicionValida(posicion)) {
    return NextResponse.json({ error: "Posición inválida." }, { status: 400 });
  }
  if (typeof asunto !== "string" || typeof cuerpo_html !== "string" || typeof activo !== "boolean") {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  if (activo && (!asunto.trim() || !cuerpo_html.trim())) {
    return NextResponse.json({ error: "Un mail activo necesita asunto y cuerpo." }, { status: 400 });
  }

  const { error } = await supabase.from("secuencia_mails").upsert(
    {
      posicion,
      asunto,
      cuerpo_html,
      remitente: NEWSLETTER_SENDERS.includes(remitente) ? remitente : NEWSLETTER_SENDERS[0],
      activo,
    },
    { onConflict: "posicion" }
  );

  if (error) {
    console.error("admin/nurture/mails PUT:", error);
    return NextResponse.json({ error: "Error al guardar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Envío de prueba: manda el mail tal cual saldría (mismo wrapper, mismo
// remitente) a las direcciones indicadas, sin tocar a nadie de la secuencia.
export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { asunto, cuerpo_html, remitente, idioma } = body;
  const destinatarios: string[] = Array.isArray(body.test_emails)
    ? body.test_emails.map((e: unknown) => String(e).trim()).filter(Boolean)
    : [];

  if (destinatarios.length === 0) {
    return NextResponse.json({ error: "Falta el destinatario de la prueba." }, { status: 400 });
  }
  if (typeof asunto !== "string" || typeof cuerpo_html !== "string" || !cuerpo_html.trim()) {
    return NextResponse.json({ error: "Nada que enviar: falta asunto o cuerpo." }, { status: 400 });
  }

  const from = resolveNewsletterFrom(remitente);
  try {
    for (const email of destinatarios) {
      await sendEmail(email, `[PRUEBA] ${asunto}`, wrapNurture(cuerpo_html, email, idioma === "eu"), from);
    }
  } catch (err) {
    console.error("admin/nurture/mails prueba:", err);
    return NextResponse.json({ error: "Error al enviar la prueba." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, enviados: destinatarios.length });
}

// Solo se puede borrar una posición donde no haya nadie parado: si alguien
// está esperando ese mail, borrarlo lo dejaría atascado ahí para siempre.
export async function DELETE(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { posicion } = await req.json().catch(() => ({}));
  if (!esPosicionValida(posicion)) {
    return NextResponse.json({ error: "Posición inválida." }, { status: 400 });
  }

  if (!POSICIONES_ESPECIALES.includes(posicion)) {
    const { count } = await supabase
      .from("newsletter_contactos")
      .select("id", { count: "exact", head: true })
      .eq("recibe_secuencia", true)
      .eq("secuencia_completada", false)
      .eq("unsubscribed", false)
      .eq("posicion_secuencia", posicion);

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Hay ${count} contacto(s) esperando este mail. Desactívalo en vez de borrarlo.` },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase.from("secuencia_mails").delete().eq("posicion", posicion);
  if (error) {
    console.error("admin/nurture/mails DELETE:", error);
    return NextResponse.json({ error: "Error al borrar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
