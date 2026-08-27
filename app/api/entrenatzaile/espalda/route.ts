import { createClient } from "@supabase/supabase-js";
import { altaEnSecuencia, enviarMailSecuencia, normalizarEmail } from "@/lib/nurture";
import { sendEmail } from "@/lib/email-ses";
import { enlaceWhatsapp } from "@/lib/entrenatzaile-mails";
import {
  CONSENT_ESPALDA,
  CONSENT_VERSION,
  DECLARACION_NEWSLETTER_ESPALDA,
  PREGUNTAS_ESPALDA,
  limpiarUtm,
} from "@/lib/entrenatzaile-formularios";
import {
  datosDeLaPeticion,
  enviarEventoMeta,
  haAceptadoSeguimiento,
} from "@/lib/meta-capi";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const ORIGEN = "landing_espalda";
const TAGS = ["entrenamiento", "tirada02", "espalda"];

const ERROR_GENERICO = "Ha ocurrido un error. Inténtalo de nuevo.";

function escapar(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { respuestas, nombre, email, telefono, edad, genero, consentDatos, consentWhatsapp, eventId } = body;

  const r = Array.isArray(respuestas) ? respuestas.map((x) => (typeof x === "string" ? x.trim() : "")) : [];
  if (r.length !== PREGUNTAS_ESPALDA.length || r.some((x) => !x)) {
    return NextResponse.json({ error: "Contesta a las tres preguntas, por favor." }, { status: 400 });
  }
  const nombreTrim = typeof nombre === "string" ? nombre.trim() : "";
  if (!nombreTrim) {
    return NextResponse.json({ error: "Escribe tu nombre, por favor." }, { status: 400 });
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "El email no es válido." }, { status: 400 });
  }
  const telefonoTrim = typeof telefono === "string" ? telefono.trim() : "";
  if (telefonoTrim.replace(/[\s().+-]/g, "").length < 9) {
    return NextResponse.json({ error: "El teléfono no es válido." }, { status: 400 });
  }
  const edadNum = Number(edad);
  if (!Number.isFinite(edadNum) || edadNum < 14 || edadNum > 100) {
    return NextResponse.json({ error: "Introduce una edad válida." }, { status: 400 });
  }
  const generoTrim = typeof genero === "string" ? genero.trim() : "";
  if (!generoTrim) {
    return NextResponse.json({ error: "Elige una opción en género." }, { status: 400 });
  }
  // Única casilla obligatoria del formulario: es la base legal del art. 9
  // para tratar las respuestas. Sin ella no se guarda nada. La de WhatsApp
  // es opcional de verdad, y el alta en la newsletter no tiene casilla: va
  // declarada en el cuerpo de la landing como contraprestación por la ficha.
  if (consentDatos !== true) {
    return NextResponse.json(
      { error: "Necesito tu permiso para tratar las respuestas antes de poder enviarte nada." },
      { status: 400 }
    );
  }

  const emailLower = normalizarEmail(email);
  const ahora = new Date().toISOString();
  const utm = limpiarUtm(body.utm);

  // El texto de cada casilla se graba desde el módulo del servidor, no desde
  // lo que mande el navegador: así lo guardado es lo que de verdad se mostró.
  const { data: lead, error: dbError } = await supabase
    .from("espalda_leads")
    .insert({
      email: emailLower,
      nombre: nombreTrim,
      telefono: telefonoTrim,
      edad: edadNum,
      genero: generoTrim,
      respuesta_1: r[0],
      respuesta_2: r[1],
      respuesta_3: r[2],
      preguntas_mostradas: PREGUNTAS_ESPALDA,
      consent_datos: true,
      consent_datos_en: ahora,
      consent_datos_texto: CONSENT_ESPALDA.datos,
      consent_whatsapp: consentWhatsapp === true,
      consent_whatsapp_en: consentWhatsapp === true ? ahora : null,
      consent_whatsapp_texto: consentWhatsapp === true ? CONSENT_ESPALDA.whatsapp : null,
      consent_newsletter: true,
      consent_newsletter_en: ahora,
      consent_newsletter_texto: DECLARACION_NEWSLETTER_ESPALDA,
      consentimientos_version: CONSENT_VERSION,
      ...utm,
      enviado_en: ahora,
    })
    .select("id")
    .single();

  if (dbError) {
    console.error("espalda_leads insert error:", dbError);
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }

  // A partir de aquí las respuestas YA están guardadas, así que nada de lo
  // que venga puede convertirse en un error para el lead: si le devolviéramos
  // un fallo, volvería a rellenar el formulario entero y se duplicaría a sí
  // mismo. Lo que salga mal se registra en su propia fila y se sigue.
  try {
    // Alta en la misma tabla y la misma secuencia que los leads de Meta Ads;
    // solo cambia la puerta de entrada y el origen.
    const alta = await altaEnSecuencia({
      email: emailLower,
      nombre: nombreTrim,
      origen: ORIGEN,
      idioma: "es",
      tags: TAGS,
      edad: edadNum,
      telefono: telefonoTrim,
      recibeSecuencia: true,
    });

    // Intento inmediato del M0. Si falla (Mailjet caído, etc.) no revertimos
    // nada: el cron de /api/newsletter/cron recoge en su próxima pasada a
    // cualquiera con posicion_secuencia=0 sin fecha de envío, con la misma
    // función. La posición solo avanza tras confirmación de Mailjet.
    let m0Enviado = false;
    let m0Error: string | null = alta.error ?? null;
    if (alta.contacto) {
      const envio = await enviarMailSecuencia(alta.contacto);
      m0Enviado = envio.enviado;
      if (!envio.enviado) m0Error = `M0 no enviado: ${envio.motivo}`;
    } else if (alta.estado === "existente") {
      m0Error = "omitido: ya estaba en la lista, no se le reinicia la secuencia";
    }

    await supabase
      .from("espalda_leads")
      .update({
        contacto_id: alta.contactoId,
        alta_estado: alta.estado,
        m0_enviado: m0Enviado,
        m0_error: m0Error,
      })
      .eq("id", lead.id);

    // Conversión a Meta. Va DESPUÉS de guardar y con su propio try dentro:
  // un fallo de medición no puede afectar al lead, que ya está a salvo.
  //
  // Solo se envían el email y el teléfono, cifrados, y nunca las respuestas:
  // esa es la regla dura del formulario y aquí también se cumple.
  let metaEvento: string;
  if (!haAceptadoSeguimiento(req)) {
    metaEvento = "omitido: no aceptó las cookies";
  } else if (typeof eventId !== "string" || !eventId) {
    metaEvento = "omitido: el navegador no mandó eventId";
  } else {
    metaEvento = await enviarEventoMeta({
      nombre: "Lead",
      eventId,
      url: req.headers.get("referer") ?? "https://entrenatzaile.alainzulaika.com/espalda",
      email: emailLower,
      telefono: telefonoTrim,
      ...datosDeLaPeticion(req),
    });
  }
  await supabase.from("espalda_leads").update({ meta_evento: metaEvento.slice(0, 600) }).eq("id", lead.id);

  await avisarme({
      email: emailLower,
      nombre: nombreTrim,
      telefono: telefonoTrim,
      edad: edadNum,
      genero: generoTrim,
      respuestas: r,
      consentWhatsapp: consentWhatsapp === true,
      alta: alta.estado,
      utm,
    });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error("espalda: lead guardado, pero falló el alta, el M0 o el aviso:", emailLower, err);
    await supabase
      .from("espalda_leads")
      .update({ m0_error: `excepción tras guardar: ${mensaje}` })
      .eq("id", lead.id);
  }

  return NextResponse.json({ ok: true });
}

// Aviso interno. Las respuestas van en el cuerpo del email, nunca en el
// asunto ni en ninguna URL.
async function avisarme(d: {
  email: string;
  nombre: string;
  telefono: string;
  edad: number;
  genero: string;
  respuestas: string[];
  consentWhatsapp: boolean;
  alta: string;
  utm: Record<string, string | undefined>;
}) {
  const celda = "padding:0.35rem 0.6rem;border-bottom:1px solid #eee;vertical-align:top;";
  const fila = (k: string, v: string) =>
    `<tr><td style="${celda}"><strong>${k}</strong></td><td style="${celda}">${v}</td></tr>`;

  const origen = Object.entries(d.utm)
    .map(([k, v]) => `${k}=${escapar(String(v))}`)
    .join("<br>");

  const preguntas = d.respuestas
    .map((resp, i) => fila(escapar(PREGUNTAS_ESPALDA[i]), escapar(resp)))
    .join("");

  // Enlace directo para escribirle por WhatsApp sin tener que copiar el
  // número a mano. Solo aparece si consintió ese canal.
  const wa = d.consentWhatsapp ? enlaceWhatsapp(d.telefono) : null;
  const telefonoCelda = wa
    ? `${escapar(d.telefono)} · <a href="${wa}" style="color:#128C7E;">abrir WhatsApp</a>`
    : escapar(d.telefono);

  const html = `
    <div style="font-family:monospace;max-width:620px;margin:0 auto;padding:1.5rem;color:#1a1a1a;background:#f8f8f8;border:1px solid #ddd;font-size:0.88rem;">
      <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.12em;color:#999;margin:0 0 1rem 0;">ENTRENATZAILE · TIRADA 02 · /ESPALDA</p>
      <table style="width:100%;border-collapse:collapse;">
        ${fila("Nombre", escapar(d.nombre))}
        ${fila("Email", escapar(d.email))}
        ${fila("Teléfono", telefonoCelda)}
        ${fila("Edad", String(d.edad))}
        ${fila("Género", escapar(d.genero))}
        ${fila("WhatsApp", d.consentWhatsapp ? "Sí, consentido" : "No")}
        ${fila("Newsletter", "Sí (declarada en la página, sin casilla)")}
        ${fila("Alta", d.alta)}
        ${preguntas}
        ${origen ? fila("Origen", origen) : ""}
      </table>
    </div>
  `;

  await sendEmail(
    "newsletter@alainzulaika.com",
    `Entrenatzaile — Nuevo lead /espalda: ${d.nombre}`,
    html,
    "Entrenatzaile <alain@alainzulaika.com>"
  );
}
