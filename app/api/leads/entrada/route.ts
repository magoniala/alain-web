import { createClient } from "@supabase/supabase-js";
import { enviarMailSecuencia } from "@/lib/nurture";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.LEADS_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { email, edad, leadgen_id, form_id, created_time } = body;

  if (typeof email !== "string" || !isValidEmail(email.trim())) {
    console.warn("leads/entrada: descartado, email inválido:", body);
    return NextResponse.json({ ok: true, descartado: true });
  }

  const emailLower = email.trim().toLowerCase();
  const leadgenId = leadgen_id ? String(leadgen_id) : null;

  if (leadgenId) {
    const { data: existente } = await supabase
      .from("newsletter_contactos")
      .select("id")
      .eq("leadgen_id", leadgenId)
      .maybeSingle();
    if (existente) {
      return NextResponse.json({ ok: true, duplicado: true });
    }
  }

  const edadNum = typeof edad === "number" ? edad : parseInt(edad, 10);
  const fechaAlta = created_time ? new Date(created_time).toISOString() : new Date().toISOString();

  const { data: contacto, error } = await supabase
    .from("newsletter_contactos")
    .insert({
      email: emailLower,
      idioma: "es",
      origen: "meta_ads",
      edad: Number.isFinite(edadNum) ? edadNum : null,
      leadgen_id: leadgenId,
      form_id: form_id ? String(form_id) : null,
      fecha_alta: fechaAlta,
      recibe_secuencia: true,
      posicion_secuencia: 0,
      secuencia_completada: false,
      unsubscribed: false,
    })
    .select("id, email, nombre, idioma, posicion_secuencia, fecha_ultimo_mail_secuencia")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Carrera: otro reintento del mismo leadgen_id ganó la inserción primero.
      return NextResponse.json({ ok: true, duplicado: true });
    }
    console.error("leads/entrada insert error:", error);
    return NextResponse.json({ error: "Error al guardar el lead." }, { status: 500 });
  }

  // Intento inmediato del Mail 0. Si falla (Mailjet caído, etc.), no revertimos
  // nada: el propio cron de /api/newsletter/cron recoge en su próxima pasada
  // (máx. 15 min) a cualquiera con posicion_secuencia=0 sin fecha de envío,
  // usando exactamente la misma función — no hace falta lógica de reintento
  // aparte.
  await enviarMailSecuencia(contacto);

  return NextResponse.json({ ok: true });
}
