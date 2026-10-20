import { createClient } from "@supabase/supabase-js";
import { normalizarEmail } from "@/lib/nurture";
import { sendEmail } from "@/lib/email-ses";
import { enlaceWhatsapp } from "@/lib/entrenatzaile-mails";
import {
  ACOMPANAMIENTO_AVISO_A,
  ACOMPANAMIENTO_FROM,
  MAIL_ACOMPANAMIENTO_ASUNTO,
  envoltorioAcompanamiento,
  mailAcompanamientoCuerpo,
} from "@/lib/acompanamiento-mails";
import {
  ACTIVIDAD_ACTUAL,
  ACTIVIDAD_SIN_DIAS,
  CONSENT_ACOMPANAMIENTO,
  CONSENT_ACOMPANAMIENTO_VERSION,
  CONSENT_AVISO_PLAZAS,
  DIAS_SEMANA,
  FRENOS,
  FRENO_OTRO,
  LUGARES,
  PREGUNTAS_ACOMPANAMIENTO,
  RANGOS_EDAD,
} from "@/lib/acompanamiento";
import { limpiarUtm, type Utm } from "@/lib/entrenatzaile-formularios";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const ERROR_GENERICO = "Ha ocurrido un error. Inténtalo de nuevo.";
const FALTA_RESPUESTA = "Falta alguna respuesta. Revisa el formulario, por favor.";

function escapar(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function texto(v: unknown, max = 4000): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// Las opciones cerradas se validan contra la lista del servidor: lo que se
// graba es una de las que de verdad se mostraron.
function opcion(v: unknown, permitidas: readonly string[]): string | null {
  const t = texto(v, 200);
  return permitidas.includes(t) ? t : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const utm = limpiarUtm(body.utm);

  if (body.tipo === "aviso") return listaDeEspera(body, utm);

  const nombre = texto(body.nombre, 120);
  if (!nombre) {
    return NextResponse.json({ error: "Escribe tu nombre, por favor." }, { status: 400 });
  }
  const email = texto(body.email, 200);
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "El email no es válido." }, { status: 400 });
  }
  // El prefijo va aparte en el formulario (+34 por defecto) y aquí se junta
  // con el número. Si el número ya trae su propio prefijo, manda ese.
  const prefijo = texto(body.prefijo, 6) || "+34";
  const numero = texto(body.telefono, 40);
  const telefono = /^\s*(\+|00)/.test(numero) ? numero : `${prefijo} ${numero}`;
  if (numero.replace(/[\s().+-]/g, "").length < 9) {
    return NextResponse.json(
      { error: "El número de WhatsApp no es válido: es por donde te voy a escribir." },
      { status: 400 }
    );
  }

  const edad = opcion(body.edad, RANGOS_EDAD);
  const actividad = opcion(body.actividad, ACTIVIDAD_ACTUAL);
  const lugar = opcion(body.lugar, LUGARES);
  const objetivo = texto(body.objetivo);
  if (!edad || !actividad || !lugar || !objetivo) {
    return NextResponse.json({ error: FALTA_RESPUESTA }, { status: 400 });
  }

  // Lo que le ha frenado: lista sin repetidos y validada contra la del
  // servidor. "Otro" exige decir qué.
  const frenosRecibidos: string[] = Array.isArray(body.frenos) ? body.frenos.map((f: unknown) => texto(f, 200)) : [];
  const frenos = [...new Set(frenosRecibidos)].filter((f) => (FRENOS as readonly string[]).includes(f));
  if (!frenos.length) {
    return NextResponse.json({ error: "Marca al menos una opción en qué te ha frenado." }, { status: 400 });
  }
  const frenosOtro = frenos.includes(FRENO_OTRO) ? texto(body.frenosOtro, 500) : "";
  if (frenos.includes(FRENO_OTRO) && !frenosOtro) {
    return NextResponse.json({ error: "Cuéntame qué otra cosa te ha frenado." }, { status: 400 });
  }

  // Los días solo tienen sentido si hace algo.
  const dias = actividad === ACTIVIDAD_SIN_DIAS ? null : opcion(body.dias, DIAS_SEMANA);
  if (actividad !== ACTIVIDAD_SIN_DIAS && !dias) {
    return NextResponse.json({ error: "Dime cuántos días por semana." }, { status: 400 });
  }

  const salud = texto(body.salud);

  if (body.consentDatos !== true || body.consentWhatsapp !== true) {
    return NextResponse.json(
      { error: "Necesito que marques las dos casillas para poder valorar tu caso y escribirte." },
      { status: 400 }
    );
  }

  const emailLower = normalizarEmail(email);
  const ahora = new Date().toISOString();

  // Solo se mira, no se toca: pedir plaza no da de alta en la newsletter.
  // Si la consulta falla se anota como "no estaba" y el aviso lo dice.
  const { data: contacto, error: contactoError } = await supabase
    .from("newsletter_contactos")
    .select("email")
    .eq("email", emailLower)
    .maybeSingle();
  const enNewsletter = !!contacto;

  const datos = {
    nombre,
    email: emailLower,
    telefono,
    edad_rango: edad,
    actividad,
    dias_semana: dias,
    lugar,
    frenos,
    frenos_otro: frenosOtro || null,
    objetivo,
    salud: salud || null,
    preguntas_mostradas: PREGUNTAS_ACOMPANAMIENTO,
    en_newsletter: enNewsletter,
    consent_datos: true,
    consent_datos_texto: CONSENT_ACOMPANAMIENTO.datos,
    consent_whatsapp: true,
    consent_whatsapp_texto: CONSENT_ACOMPANAMIENTO.whatsapp,
    consent_en: ahora,
    consentimientos_version: CONSENT_ACOMPANAMIENTO_VERSION,
    ...utm,
    enviado_en: ahora,
  };

  // Como en /audio: un fallo al guardar no tira la solicitud. Lo que importa
  // es que me llegue el aviso para poder escribirle, y el aviso lo dice.
  let id: string | null = null;
  let dbError: string | null = null;
  const { data: fila, error } = await supabase.from("solicitudes_acompanamiento").insert(datos).select("id").single();
  if (error) {
    dbError = error.message;
    console.error("acompanamiento: insert error:", error);
  } else {
    id = fila.id;
  }

  let confirmacionEnviada = false;
  try {
    await sendEmail(
      `${nombre} <${emailLower}>`,
      MAIL_ACOMPANAMIENTO_ASUNTO,
      envoltorioAcompanamiento(mailAcompanamientoCuerpo(nombre)),
      ACOMPANAMIENTO_FROM
    );
    confirmacionEnviada = true;
  } catch (err) {
    console.error("acompanamiento: error enviando el acuse:", emailLower, err);
  }

  let avisoEnviado = false;
  let avisoError: string | null = null;
  try {
    await avisarme({
      nombre,
      email: emailLower,
      telefono,
      edad,
      objetivo,
      frenos,
      frenosOtro,
      actividad,
      dias,
      salud,
      lugar,
      enNewsletter,
      contactoError: contactoError?.message ?? null,
      utm,
      dbError,
      confirmacionEnviada,
    });
    avisoEnviado = true;
  } catch (err) {
    avisoError = err instanceof Error ? err.message : String(err);
    console.error("acompanamiento: error enviando el aviso:", avisoError);
  }

  if (id) {
    await supabase
      .from("solicitudes_acompanamiento")
      .update({ aviso_enviado: avisoEnviado, aviso_error: avisoError, confirmacion_enviada: confirmacionEnviada })
      .eq("id", id);
  }

  // Solo es un error para quien rellena si la solicitud no existe en ninguna
  // parte: ni guardada ni en mi buzón.
  if (!id && !avisoEnviado) {
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Con las plazas cubiertas, la página solo pide un email para avisar de las
// siguientes. Se guarda y me llega una línea; a la persona no se le manda
// nada más hasta que haya plazas.
async function listaDeEspera(body: Record<string, unknown>, utm: Utm) {
  const email = texto(body.email, 200);
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "El email no es válido." }, { status: 400 });
  }
  if (body.consentAviso !== true) {
    return NextResponse.json({ error: "Marca la casilla para que pueda avisarte." }, { status: 400 });
  }
  const emailLower = normalizarEmail(email);

  const { error } = await supabase.from("acompanamiento_avisos").insert({
    email: emailLower,
    consent_texto: CONSENT_AVISO_PLAZAS,
    consentimientos_version: CONSENT_ACOMPANAMIENTO_VERSION,
    ...utm,
  });
  if (error) console.error("acompanamiento: insert aviso error:", error);

  let avisoEnviado = false;
  try {
    await sendEmail(
      ACOMPANAMIENTO_AVISO_A,
      `Acompañamiento — Lista de espera: ${emailLower}`,
      `<div style="font-family:monospace;font-size:0.88rem;">
        <p>${escapar(emailLower)} quiere que le avise cuando abra plazas nuevas.</p>
        ${error ? `<p style="color:#B3261E;">NO SE HA GUARDADO EN SUPABASE (${escapar(error.message)}). Este correo es la única copia.</p>` : ""}
      </div>`,
      ACOMPANAMIENTO_FROM
    );
    avisoEnviado = true;
  } catch (err) {
    console.error("acompanamiento: error enviando el aviso de lista de espera:", err);
  }

  if (error && !avisoEnviado) {
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Aviso interno. Las respuestas van en el cuerpo del correo, nunca en el
// asunto ni en ninguna URL.
async function avisarme(d: {
  nombre: string;
  email: string;
  telefono: string;
  edad: string;
  objetivo: string;
  frenos: string[];
  frenosOtro: string;
  actividad: string;
  dias: string | null;
  salud: string;
  lugar: string;
  enNewsletter: boolean;
  contactoError: string | null;
  utm: Utm;
  dbError: string | null;
  confirmacionEnviada: boolean;
}) {
  const celda = "padding:0.35rem 0.6rem;border-bottom:1px solid #eee;vertical-align:top;";
  const fila = (k: string, v: string) =>
    `<tr><td style="${celda}"><strong>${k}</strong></td><td style="${celda}">${v}</td></tr>`;

  const wa = enlaceWhatsapp(d.telefono);
  const botonWa = wa
    ? `<p style="margin:0 0 1.2rem 0;"><a href="${wa}" style="display:inline-block;background:#128C7E;color:#ffffff;text-decoration:none;padding:0.7rem 1.4rem;font-family:monospace;font-size:0.9rem;">Abrir WhatsApp con ${escapar(d.nombre)}</a></p>`
    : `<p style="margin:0 0 1.2rem 0;color:#B3261E;">No he podido construir el enlace de WhatsApp con ese número. Hay que escribirlo a mano.</p>`;

  const aviso = (texto: string) =>
    `<p style="margin:0 0 1.2rem 0;padding:0.8rem 1rem;background:#fff7e6;border-left:3px solid #D4860A;color:#7a4e00;">${texto}</p>`;

  const incidencias = [
    d.dbError
      ? aviso(
          `NO SE HA GUARDADO EN SUPABASE (${escapar(d.dbError)}). Las respuestas de abajo son la única copia: guárdalas antes de borrar este correo.`
        )
      : "",
    d.confirmacionEnviada ? "" : aviso("El acuse a esta persona NO ha salido. No sabe que lo he recibido."),
  ].join("");

  const frenos = d.frenos
    .map((f) => (f === FRENO_OTRO && d.frenosOtro ? `${FRENO_OTRO}: ${escapar(d.frenosOtro)}` : escapar(f)))
    .join("<br>");
  const actividad = d.dias ? `${d.actividad} · ${d.dias} día(s)/semana` : d.actividad;
  const newsletter = d.contactoError
    ? `No lo sé (falló la consulta: ${escapar(d.contactoError)})`
    : d.enNewsletter
      ? "Sí, ya estaba en la lista"
      : "No";

  const origen = Object.entries(d.utm)
    .map(([k, v]) => `${k}=${escapar(String(v))}`)
    .join("<br>");

  const html = `
    <div style="font-family:monospace;max-width:620px;margin:0 auto;padding:1.5rem;color:#1a1a1a;background:#f8f8f8;border:1px solid #ddd;font-size:0.88rem;">
      <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.12em;color:#999;margin:0 0 1rem 0;">ENTRENATZAILE · /ACOMPANAMIENTO</p>
      ${incidencias}
      ${botonWa}
      <table style="width:100%;border-collapse:collapse;">
        ${fila(PREGUNTAS_ACOMPANAMIENTO.nombre, escapar(d.nombre))}
        ${fila(PREGUNTAS_ACOMPANAMIENTO.email, escapar(d.email))}
        ${fila(PREGUNTAS_ACOMPANAMIENTO.telefono, wa ? `<a href="${wa}">${escapar(d.telefono)}</a>` : escapar(d.telefono))}
        ${fila(PREGUNTAS_ACOMPANAMIENTO.edad, escapar(d.edad))}
        ${fila(PREGUNTAS_ACOMPANAMIENTO.objetivo, escapar(d.objetivo))}
        ${fila(PREGUNTAS_ACOMPANAMIENTO.frenos, frenos)}
        ${fila(PREGUNTAS_ACOMPANAMIENTO.actividad, escapar(actividad))}
        ${fila(PREGUNTAS_ACOMPANAMIENTO.salud, d.salud ? escapar(d.salud) : "—")}
        ${fila(PREGUNTAS_ACOMPANAMIENTO.lugar, escapar(d.lugar))}
        ${fila("Newsletter", newsletter)}
        ${origen ? fila("Origen", origen) : ""}
      </table>
    </div>
  `;

  await sendEmail(ACOMPANAMIENTO_AVISO_A, `Acompañamiento — Solicitud de plaza: ${d.nombre}`, html, ACOMPANAMIENTO_FROM);
}
