import { createClient } from "@supabase/supabase-js";
import { enviarMailSecuencia, wrapNurture, normalizarEmail, CANDADO_STALE_MS } from "@/lib/nurture";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Mail de cortesía para quien ya estaba en la lista antes de rellenar el
// formulario de ads — vive en secuencia_mails con posicion=-2 (fuera del
// rango normal, igual que el recordatorio en -1).
const POSICION_MAIL_DUPLICADO = -2;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Registra en la fila del toque (leads_ads_duplicados) qué pasó de verdad
// con el intento de envío, para poder verlo con una consulta en vez de
// depender de logs de Vercel a los que ni tú ni yo tenemos acceso cómodo.
async function marcarResultadoToque(touchId: string | null, mailEnviado: boolean, error?: string) {
  if (!touchId) return;
  await supabase
    .from("leads_ads_duplicados")
    .update({ mail_enviado: mailEnviado, mail_error: error ?? null })
    .eq("id", touchId);
}

async function enviarMailDuplicado(
  contacto: { id: string; email: string; nombre: string | null; idioma: string | null; unsubscribed: boolean },
  touchId: string | null
) {
  if (contacto.unsubscribed) {
    await marcarResultadoToque(touchId, false, "omitido: contacto dado de baja (unsubscribed=true)");
    return;
  }

  const staleThreshold = new Date(Date.now() - CANDADO_STALE_MS).toISOString();

  // Candado anti-carrera separado del marcador de "enviado de verdad":
  // mail_duplicado_ads_enviado solo se pone a true tras confirmar el envío.
  const { data: claimed, error: claimError } = await supabase
    .from("newsletter_contactos")
    .update({ mail_duplicado_ads_enviando_desde: new Date().toISOString() })
    .eq("id", contacto.id)
    .eq("mail_duplicado_ads_enviado", false)
    .or(`mail_duplicado_ads_enviando_desde.is.null,mail_duplicado_ads_enviando_desde.lt.${staleThreshold}`)
    .select("id");
  if (claimError) {
    // Un error aquí (ej. falta una columna en el esquema) NO es "ya
    // enviado" — es un fallo real que se guarda para poder verlo.
    console.error("leads/entrada: error al reclamar el envío del duplicado (revisar esquema):", contacto.email, claimError);
    await marcarResultadoToque(touchId, false, `error de base de datos: ${claimError.message}`);
    return;
  }
  if (!claimed?.length) {
    await marcarResultadoToque(touchId, false, "omitido: ya se le había enviado antes, o hay otro intento en curso");
    return;
  }

  const { data: mail } = await supabase
    .from("secuencia_mails")
    .select("asunto, cuerpo_html, remitente")
    .eq("posicion", POSICION_MAIL_DUPLICADO)
    .eq("activo", true)
    .maybeSingle();
  if (!mail) {
    await supabase.from("newsletter_contactos").update({ mail_duplicado_ads_enviando_desde: null }).eq("id", contacto.id);
    await marcarResultadoToque(touchId, false, "error: contenido del mail -2 no cargado o inactivo");
    return;
  }

  const isEu = contacto.idioma === "eu";
  const html = wrapNurture(mail.cuerpo_html ?? "", contacto.email, isEu);

  try {
    await sendEmail(
      contacto.nombre ? `${contacto.nombre} <${contacto.email}>` : contacto.email,
      mail.asunto ?? "",
      html,
      resolveNewsletterFrom(mail.remitente)
    );
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error("leads/entrada: error enviando mail de duplicado:", contacto.email, err);
    await supabase.from("newsletter_contactos").update({ mail_duplicado_ads_enviando_desde: null }).eq("id", contacto.id);
    await marcarResultadoToque(touchId, false, `error Mailjet: ${mensaje}`);
    return; // no marcado como enviado: se puede reintentar cuando caduque el candado
  }

  await supabase
    .from("newsletter_contactos")
    .update({ mail_duplicado_ads_enviado: true, mail_duplicado_ads_enviando_desde: null })
    .eq("id", contacto.id);
  await marcarResultadoToque(touchId, true);
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

  const emailLower = normalizarEmail(email);
  const leadgenId = leadgen_id ? String(leadgen_id) : null;
  const fecha = created_time ? new Date(created_time).toISOString() : new Date().toISOString();

  // Deduplicación por leadgen_id: puede haberse registrado ya como alta nueva
  // (newsletter_contactos) o como toque de alguien que ya estaba en la lista
  // (leads_ads_duplicados) — miramos las dos.
  if (leadgenId) {
    const [{ data: enContactos }, { data: enDuplicados }] = await Promise.all([
      supabase.from("newsletter_contactos").select("id").eq("leadgen_id", leadgenId).maybeSingle(),
      supabase.from("leads_ads_duplicados").select("id").eq("leadgen_id", leadgenId).maybeSingle(),
    ]);
    if (enContactos || enDuplicados) {
      return NextResponse.json({ ok: true, duplicado: true });
    }
  }

  const { data: existente } = await supabase
    .from("newsletter_contactos")
    .select("id, email, nombre, idioma, unsubscribed, mail_duplicado_ads_enviado")
    .eq("email", emailLower)
    .maybeSingle();

  if (existente?.unsubscribed) {
    // Estaba dado de baja: rellenar el formulario de ads es una señal de
    // interés renovado, así que se reactiva del todo y entra en la
    // secuencia desde cero, como si fuera un lead nuevo. No cuenta como
    // "duplicado" para métricas — es, a todos los efectos, una alta nueva.
    const edadNumReactivar = typeof edad === "number" ? edad : parseInt(edad, 10);
    const { data: reactivado, error: reactivarError } = await supabase
      .from("newsletter_contactos")
      .update({
        unsubscribed: false,
        recibe_secuencia: true,
        posicion_secuencia: 0,
        secuencia_completada: false,
        fecha_ultimo_mail_secuencia: null,
        enviando_secuencia_desde: null,
        origen: "meta_ads",
        edad: Number.isFinite(edadNumReactivar) ? edadNumReactivar : null,
        leadgen_id: leadgenId,
        form_id: form_id ? String(form_id) : null,
        fecha_alta: fecha,
      })
      .eq("id", existente.id)
      .select("id, email, nombre, idioma, posicion_secuencia, fecha_ultimo_mail_secuencia")
      .single();

    if (reactivarError) {
      console.error("leads/entrada: error reactivando contacto dado de baja:", existente.email, reactivarError);
      return NextResponse.json({ error: "Error al reactivar el lead." }, { status: 500 });
    }

    await enviarMailSecuencia(reactivado);
    return NextResponse.json({ ok: true, reactivado: true });
  }

  if (existente) {
    // Ya estaba en la lista y activo: no tocamos su suscripción ni
    // recibe_secuencia. Registramos el toque de ads para métricas de
    // campaña (cuenta aunque no entre en la secuencia) y, si es la primera
    // vez, le mandamos el mail de cortesía — el resultado del envío queda
    // grabado en la propia fila del toque (mail_enviado / mail_error),
    // visible con una consulta.
    const { data: touch, error: logError } = await supabase
      .from("leads_ads_duplicados")
      .insert({ email: emailLower, leadgen_id: leadgenId, fecha })
      .select("id")
      .single();

    let touchId: string | null = touch?.id ?? null;

    if (logError) {
      if (logError.code === "23505" && leadgenId) {
        // Carrera: alguien más registró ya un toque con este leadgen_id.
        const { data: existenteTouch } = await supabase
          .from("leads_ads_duplicados")
          .select("id")
          .eq("leadgen_id", leadgenId)
          .maybeSingle();
        touchId = existenteTouch?.id ?? null;
      } else {
        console.error("leads/entrada: error registrando duplicado:", logError);
      }
    }

    await enviarMailDuplicado(existente, touchId);

    return NextResponse.json({ ok: true, existente: true });
  }

  // ---- Flujo normal: lead nuevo ----
  const edadNum = typeof edad === "number" ? edad : parseInt(edad, 10);

  const { data: contacto, error } = await supabase
    .from("newsletter_contactos")
    .insert({
      email: emailLower,
      idioma: "es",
      origen: "meta_ads",
      edad: Number.isFinite(edadNum) ? edadNum : null,
      leadgen_id: leadgenId,
      form_id: form_id ? String(form_id) : null,
      fecha_alta: fecha,
      recibe_secuencia: true,
      posicion_secuencia: 0,
      secuencia_completada: false,
      unsubscribed: false,
    })
    .select("id, email, nombre, idioma, posicion_secuencia, fecha_ultimo_mail_secuencia")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Carrera: otro reintento del mismo leadgen_id (o del mismo email) ganó la inserción primero.
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
