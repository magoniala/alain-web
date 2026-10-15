import { createClient } from "@supabase/supabase-js";
import {
  enviarMailSecuencia,
  wrapNurture,
  normalizarEmail,
  CANDADO_STALE_MS,
  CAMPOS_CONTACTO,
  POSICION_MAIL_FICHA,
} from "@/lib/nurture";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import {
  cuerpoDelMail,
  marcadoresDeFecha,
  marcadoresDeNombre,
  sustituirMarcadores,
} from "@/lib/email-markdown";
import { calcularVentana, marcadoresDeVentana } from "@/lib/entrenatzaile-ventana";
import {
  CONSENT_ADS,
  CONSENT_ADS_VERSION,
  PREGUNTA_ADS,
} from "@/lib/entrenatzaile-formularios";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Mail de cortesía para quien ya estaba en la lista antes de rellenar el
// formulario. Vive en secuencia_mails con posicion=-2 y lo comparte con
// /api/entrenatzaile/espalda, que se topa con el mismo caso: se importa de
// lib/nurture para que no haya dos números sueltos que puedan separarse.
const POSICION_MAIL_DUPLICADO = POSICION_MAIL_FICHA;

// Etiquetas de la cohorte, para poder segmentarla desde la newsletter
// cuando cierre la tirada. Mismo formato que las de /espalda
// ("tirada02"), que es lo que hace que las dos se puedan comparar.
const TAGS = ["entrenamiento", "tirada03", "ads"];

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * La fecha que manda Meta, interpretada sin lanzar y sin silencios raros.
 *
 * El `new Date(x).toISOString()` a pelo que había aquí tenía dos agujeros, y
 * los dos rompen la tirada sin dejar rastro:
 *
 *  - Un unix en SEGUNDOS (lo que trae el webhook crudo de Meta) se lee como
 *    milisegundos y sale 1970. Con esa fecha_alta el lead queda fuera de su
 *    ventana desde el primer minuto: recibe el M0 con el enlace de pago y en
 *    la siguiente pasada del cron posicionAlDia() lo adelanta hasta el mail 8.
 *    Un mail, y se acabó la secuencia.
 *  - Una cadena vacía o basura hace que toISOString() lance RangeError, o sea
 *    un 500. Make reintenta, el fallo es determinista, y el lead no entra
 *    nunca.
 *
 * Ante la duda, ahora, la fecha de hoy: la ventana empieza cuando lo
 * recibimos. Es un día de desfase como mucho, y no pierde al lead.
 */
function fechaDeMeta(raw: unknown): string {
  const candidato =
    // Unix de Meta, en segundos o en milisegundos. El corte está en 1e12
    // porque cualquier fecha real en segundos queda muy por debajo (1e12 en
    // segundos sería el año 33658) y cualquiera en milisegundos, por encima.
    typeof raw === "number" || (typeof raw === "string" && /^\d{9,13}$/.test(raw.trim()))
      ? new Date(Number(raw) < 1e12 ? Number(raw) * 1000 : Number(raw))
      : typeof raw === "string" && raw.trim()
        ? new Date(raw.trim())
        : null;

  // Horquilla de cordura, además de "es una fecha válida". Un 0, o un unix
  // mal escalado que aun así da una fecha legal, pasarían el Number.isNaN y
  // llegarían a fecha_alta igual de rotos. Y una fecha futura es peor que
  // una vieja: calcularVentana() exige dias >= 0, así que dejaría al lead
  // fuera de su propia ventana estando recién apuntado.
  const minimo = Date.UTC(2026, 0, 1);
  const maximo = Date.now() + 24 * 60 * 60 * 1000;
  const fueraDeRango =
    !!candidato && !Number.isNaN(candidato.getTime()) && (candidato.getTime() < minimo || candidato.getTime() > maximo);

  if (!candidato || Number.isNaN(candidato.getTime()) || fueraDeRango) {
    if (raw !== undefined && raw !== null && raw !== "") {
      console.warn("leads/entrada: created_time no interpretable o fuera de rango, se usa la fecha de hoy:", raw);
    }
    return new Date().toISOString();
  }
  return candidato.toISOString();
}

/**
 * El booleano del consentimiento, tolerando lo que suele mandar Make.
 *
 * Cualquier cosa que no se reconozca cuenta como NO: el lado seguro de un
 * consentimiento es no tenerlo.
 */
function esSi(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    return ["true", "1", "yes", "si", "sí", "on"].includes(raw.trim().toLowerCase());
  }
  return false;
}

// Gemelo de limpiarDetalle() en /api/entrenatzaile/eventos: un código corto,
// nunca texto libre. Aquí lo usa el campo oculto de seguimiento del
// formulario ("t03").
function codigoCorto(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return /^[a-zA-Z0-9_-]{1,40}$/.test(v) ? v : null;
}

// Las etiquetas que ya tenía más las de esta tirada, sin repetir y en
// minúsculas. Mismo criterio que altaEnSecuencia(): se añaden, no se pisan.
function fusionarTags(previas: string[] | null | undefined): string[] {
  return Array.from(new Set([...(previas ?? []).map((t) => t.toLowerCase()), ...TAGS]));
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

/**
 * Qué pasó de verdad con este lead, en su propia fila de leads_ads.
 *
 * Mismo criterio que marcarResultadoToque() y que los m0_* de espalda_leads:
 * poder responder "¿y a este qué le pasó?" con una consulta, en vez de
 * depender de los logs de Vercel.
 */
async function registrarAlta(
  leadAdsId: string | null,
  campos: { alta_estado: string; contacto_id?: string | null; m0_enviado?: boolean; m0_error?: string | null }
) {
  if (!leadAdsId) return;
  const { error } = await supabase.from("leads_ads").update(campos).eq("id", leadAdsId);
  if (error) console.error("leads/entrada: no se pudo anotar el resultado del alta:", error);
}

async function enviarMailDuplicado(
  contacto: {
    id: string;
    email: string;
    nombre: string | null;
    idioma: string | null;
    unsubscribed: boolean;
    fecha_alta: string | null;
  },
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
    .select("asunto, cuerpo_html, remitente, formato, preheader")
    .eq("secuencia", "nurture")
    .eq("posicion", POSICION_MAIL_DUPLICADO)
    .eq("activo", true)
    .maybeSingle();
  if (!mail) {
    await supabase.from("newsletter_contactos").update({ mail_duplicado_ads_enviando_desde: null }).eq("id", contacto.id);
    await marcarResultadoToque(touchId, false, "error: contenido del mail -2 no cargado o inactivo");
    return;
  }

  const isEu = contacto.idioma === "eu";
  // Este correo usa {{saludo}} y antes no se sustituía: salía el marcador tal
  // cual en la bandeja de quien lo recibía. Los enlaces NO se personalizan a
  // propósito (la posición -2 está en POSICIONES_SIN_VENTANA): este mail dice
  // expresamente que la Hoja de Ruta cuesta 90 €.
  const valores = {
    ...marcadoresDeNombre(contacto.nombre),
    ...marcadoresDeFecha(),
    ...marcadoresDeVentana(contacto.fecha_alta),
  };
  const enVentana = calcularVentana(contacto.fecha_alta).elegibilidad === "elegible";
  const html = wrapNurture(
    cuerpoDelMail(mail.cuerpo_html, mail.formato, mail.preheader, valores, {
      si_ventana: enVentana,
      si_no_ventana: !enVentana,
    }),
    contacto.email,
    isEu
  );

  try {
    await sendEmail(
      contacto.nombre ? `${contacto.nombre} <${contacto.email}>` : contacto.email,
      sustituirMarcadores(mail.asunto ?? "", valores),
      html,
      resolveNewsletterFrom(mail.remitente),
      undefined,
      { campana: "nurture-duplicado", customId: contacto.id }
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
  const {
    email,
    edad,
    nombre,
    // El formulario usa el campo de WhatsApp de Meta, no el de teléfono
    // genérico. Se acepta también `telefono` como alternativa: si la clave
    // se renombra otra vez en Meta, o el mapeo de Make se descoloca al
    // duplicar el formulario (que es lo que pasó en la Tirada 01), los
    // números no desaparecen en silencio.
    whatsapp,
    telefono,
    respuesta,
    consent_whatsapp,
    leadgen_id,
    form_id,
    created_time,
    tirada,
  } = body;

  if (typeof email !== "string" || !isValidEmail(email.trim())) {
    // Se registran las claves y el identificador del lead, NUNCA el cuerpo:
    // ahí viaja la respuesta de texto libre, que puede traer datos de salud,
    // y el teléfono. Ni una ni otro tienen nada que hacer en un log.
    console.warn(
      "leads/entrada: descartado, email inválido · leadgen_id:",
      leadgen_id ?? "(ninguno)",
      "· campos recibidos:",
      Object.keys(body ?? {}).join(", ")
    );
    return NextResponse.json({ ok: true, descartado: true });
  }

  const emailLower = normalizarEmail(email);
  const leadgenId = leadgen_id ? String(leadgen_id) : null;
  const fecha = fechaDeMeta(created_time);
  const nombreTrim = typeof nombre === "string" && nombre.trim() ? nombre.trim() : null;
  const respuestaTexto = typeof respuesta === "string" && respuesta.trim() ? respuesta.trim() : null;
  const tiradaCodigo = codigoCorto(tirada);
  const consentWhatsapp = esSi(consent_whatsapp);

  // La decisión de minimización, en una sola variable y una sola vez: sin
  // casilla marcada no se guarda el número por ningún camino. Meta lo
  // autorrellena y lo manda igual, así que se descarta aquí.
  const telefonoBruto = typeof whatsapp === "string" && whatsapp.trim()
    ? whatsapp.trim()
    : typeof telefono === "string" && telefono.trim()
      ? telefono.trim()
      : null;
  const telefonoGuardable = consentWhatsapp ? telefonoBruto : null;

  // ---- El recibo de este envío, antes de nada más ----
  //
  // Igual que /espalda guarda la fila del formulario antes de dar de alta:
  // la respuesta queda a salvo aunque todo lo que venga después falle. Y de
  // paso, el índice único sobre leadgen_id convierte este insert en la
  // puerta anti-reintentos de Make.
  const { data: leadAds, error: leadAdsError } = await supabase
    .from("leads_ads")
    .insert({
      leadgen_id: leadgenId,
      form_id: form_id ? String(form_id) : null,
      email: emailLower,
      nombre: nombreTrim,
      telefono: telefonoGuardable,
      // El texto de la pregunta lo pone el servidor desde la constante, no
      // Make: lo que queda escrito es lo que se le mostró.
      pregunta: { pregunta: PREGUNTA_ADS, respuesta: respuestaTexto },
      consent_whatsapp: consentWhatsapp,
      consent_whatsapp_en: consentWhatsapp ? new Date().toISOString() : null,
      consent_whatsapp_texto: consentWhatsapp ? CONSENT_ADS.whatsapp : null,
      consentimientos_version: CONSENT_ADS_VERSION,
      created_time: fecha,
      tirada: tiradaCodigo,
    })
    .select("id")
    .single();

  if (leadAdsError?.code === "23505" && leadgenId) {
    // Reintento de Make con el mismo lead. Ya está procesado: ni se duplica
    // la fila ni se vuelve a tocar al contacto.
    return NextResponse.json({ ok: true, duplicado: true });
  }
  if (leadAdsError) {
    // Un fallo aquí no puede costar el lead: se sigue sin recibo y el alta
    // ocurre igual. Queda a gritos en el log porque es lo único que se
    // pierde, y es justo lo que después no se puede reconstruir.
    console.error("leads/entrada: no se pudo guardar el recibo en leads_ads:", leadAdsError);
  }
  const leadAdsId = leadAds?.id ?? null;

  // Deduplicación por leadgen_id contra las tiradas anteriores, que son las
  // que el índice único de leads_ads no conoce: un lead de agosto está en
  // newsletter_contactos o en leads_ads_duplicados, pero no en la tabla
  // nueva. Sin esto, reenviar un leadgen_id viejo lo reactivaría.
  if (leadgenId) {
    const [{ data: enContactos }, { data: enDuplicados }] = await Promise.all([
      supabase.from("newsletter_contactos").select("id").eq("leadgen_id", leadgenId).maybeSingle(),
      supabase.from("leads_ads_duplicados").select("id").eq("leadgen_id", leadgenId).maybeSingle(),
    ]);
    if (enContactos || enDuplicados) {
      await registrarAlta(leadAdsId, { alta_estado: "duplicado" });
      return NextResponse.json({ ok: true, duplicado: true });
    }
  }

  const { data: existente } = await supabase
    .from("newsletter_contactos")
    // telefono y tags entran aquí porque los dos caminos de abajo los
    // fusionan: rellenar el hueco si está vacío, nunca pisar lo que ya había.
    .select("id, email, nombre, telefono, tags, idioma, unsubscribed, mail_duplicado_ads_enviado, fecha_alta")
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
        // Datos que antes no teníamos: se rellenan, nunca se pisan los que
        // ya había. El token tampoco se menciona: conserva el suyo, que es
        // lo correcto aunque aquí sí se reinicie fecha_alta.
        nombre: existente.nombre ?? nombreTrim,
        telefono: existente.telefono ?? telefonoGuardable,
        tags: fusionarTags(existente.tags),
        leadgen_id: leadgenId,
        form_id: form_id ? String(form_id) : null,
        fecha_alta: fecha,
      })
      .eq("id", existente.id)
      .select(CAMPOS_CONTACTO)
      .single();

    if (reactivarError) {
      console.error("leads/entrada: error reactivando contacto dado de baja:", existente.email, reactivarError);
      await registrarAlta(leadAdsId, {
        alta_estado: "error",
        contacto_id: existente.id,
        m0_error: `error al reactivar: ${reactivarError.message}`,
      });
      return NextResponse.json({ error: "Error al reactivar el lead." }, { status: 500 });
    }

    const { enviado, motivo } = await enviarMailSecuencia(reactivado);
    await registrarAlta(leadAdsId, {
      alta_estado: "reactivado",
      contacto_id: existente.id,
      m0_enviado: enviado,
      m0_error: enviado ? null : (motivo ?? "no enviado"),
    });
    return NextResponse.json({ ok: true, reactivado: true });
  }

  if (existente) {
    // Ya estaba en la lista y activo: no tocamos su suscripción ni
    // recibe_secuencia. Registramos el toque de ads para métricas de
    // campaña (cuenta aunque no entre en la secuencia) y, si es la primera
    // vez, le mandamos el mail de cortesía — el resultado del envío queda
    // grabado en la propia fila del toque (mail_enviado / mail_error),
    // visible con una consulta.

    // Lo que falte, se completa. No se toca recibe_secuencia, ni la
    // posición, ni fecha_alta: rellenar otro formulario no reinicia nada.
    const nombreFusionado = existente.nombre ?? nombreTrim;
    const { error: completarError } = await supabase
      .from("newsletter_contactos")
      .update({
        nombre: nombreFusionado,
        telefono: existente.telefono ?? telefonoGuardable,
        tags: fusionarTags(existente.tags),
      })
      .eq("id", existente.id);
    if (completarError) {
      console.error("leads/entrada: error completando datos del contacto existente:", existente.email, completarError);
    }

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

    // Con el nombre ya fusionado: el mail de cortesía es uno de los dos
    // únicos de la secuencia que usan {{saludo}}, así que si el nombre lo
    // acaba de traer el formulario, saluda con él en vez de "Hola" a secas.
    await enviarMailDuplicado({ ...existente, nombre: nombreFusionado }, touchId);

    // No hay M0 que enviar en este camino (no se le reinicia la secuencia):
    // m0_enviado se queda en false a propósito. El resultado del correo de
    // cortesía vive en su propia fila de leads_ads_duplicados.
    await registrarAlta(leadAdsId, { alta_estado: "existente", contacto_id: existente.id });

    return NextResponse.json({ ok: true, existente: true });
  }

  // ---- Flujo normal: lead nuevo ----
  const edadNum = typeof edad === "number" ? edad : parseInt(edad, 10);

  const { data: contacto, error } = await supabase
    .from("newsletter_contactos")
    .insert({
      email: emailLower,
      nombre: nombreTrim,
      telefono: telefonoGuardable,
      tags: TAGS,
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
    // El token no se escribe: lo pone la base de datos
    // (DEFAULT gen_random_uuid()) y vuelve en este mismo select, dentro de
    // CAMPOS_CONTACTO, para que el enlace del M0 ya salga personalizado.
    .select(CAMPOS_CONTACTO)
    .single();

  if (error) {
    if (error.code === "23505") {
      // Carrera: otro reintento del mismo leadgen_id (o del mismo email) ganó la inserción primero.
      await registrarAlta(leadAdsId, { alta_estado: "duplicado" });
      return NextResponse.json({ ok: true, duplicado: true });
    }
    console.error("leads/entrada insert error:", error);
    await registrarAlta(leadAdsId, { alta_estado: "error", m0_error: `error al dar de alta: ${error.message}` });
    return NextResponse.json({ error: "Error al guardar el lead." }, { status: 500 });
  }

  // Intento inmediato del Mail 0. Si falla (Mailjet caído, etc.), no revertimos
  // nada: el propio cron de /api/newsletter/cron recoge en su próxima pasada
  // (máx. 15 min) a cualquiera con posicion_secuencia=0 sin fecha de envío,
  // usando exactamente la misma función — no hace falta lógica de reintento
  // aparte.
  const { enviado, motivo } = await enviarMailSecuencia(contacto);
  await registrarAlta(leadAdsId, {
    alta_estado: "nuevo",
    contacto_id: contacto.id,
    m0_enviado: enviado,
    m0_error: enviado ? null : (motivo ?? "no enviado"),
  });

  return NextResponse.json({ ok: true });
}
