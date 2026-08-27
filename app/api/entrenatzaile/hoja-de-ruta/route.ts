import { createClient } from "@supabase/supabase-js";
import { altaEnSecuencia, enviarMailSecuencia, normalizarEmail, wrapNurture } from "@/lib/nurture";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import { MAIL_RESERVA_ASUNTO, mailReservaCuerpo } from "@/lib/entrenatzaile-mails";
import {
  CONSENT_HOJA_RUTA,
  CONSENT_VERSION,
  ELEGIBILIDAD_ETIQUETA,
  VENTANA_DIAS,
  limpiarUtm,
  type Elegibilidad,
} from "@/lib/entrenatzaile-formularios";
import {
  esHuecoOfrecido,
  formatearHueco,
  huecosDisponibles,
  type Bloqueo,
} from "@/lib/entrenatzaile-huecos";
import {
  datosDeLaPeticion,
  enviarEventoMeta,
  haAceptadoSeguimiento,
} from "@/lib/meta-capi";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const ERROR_GENERICO = "Ha ocurrido un error. Inténtalo de nuevo.";

// Todo lo que hace falta para calcular la agenda. Se traen las reservas
// enteras, sin filtrar por fecha: son cinco a la semana como mucho, así que
// la tabla es diminuta, y el tope semanal necesita ver también las de los
// bordes del rango.
async function cargarContexto() {
  const [reservas, bloqueos] = await Promise.all([
    supabase.from("hoja_ruta_reservas").select("hueco").not("hueco", "is", null),
    supabase.from("hoja_ruta_bloqueos").select("dia, hora_desde, hora_hasta"),
  ]);

  return {
    ahora: new Date(),
    reservados: (reservas.data ?? []).map((r) => r.hueco as string),
    bloqueos: (bloqueos.data ?? []) as Bloqueo[],
    error: reservas.error ?? bloqueos.error,
  };
}

// Huecos que se le ofrecen al lead: se calculan a partir de las reglas de
// disponibilidad, de lo ya reservado y de los bloqueos del panel.
export async function GET() {
  const contexto = await cargarContexto();
  if (contexto.error) {
    console.error("hoja-de-ruta: error calculando la agenda:", contexto.error);
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }

  return NextResponse.json(
    { huecos: huecosDisponibles(contexto) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

function escapar(texto: string) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Elegibilidad calculada en servidor contra la lista de suscriptores. No se
// le muestra al lead, no bifurca la landing y no bloquea la reserva: solo
// viaja en el asunto del aviso que me llega a mí.
async function calcularElegibilidad(emailLower: string): Promise<{
  elegibilidad: Elegibilidad;
  dias_desde_alta: number | null;
  fecha_alta_contacto: string | null;
  ventana_dia: number | null;
}> {
  // Solo fecha_alta: newsletter_contactos no tiene created_at. Pedirla haría
  // fallar el select entero y todo el mundo saldría como "no_en_lista".
  const { data: contacto, error } = await supabase
    .from("newsletter_contactos")
    .select("fecha_alta")
    .eq("email", emailLower)
    .maybeSingle();

  if (error) {
    console.error("hoja-de-ruta: error consultando elegibilidad:", emailLower, error);
  }

  const alta = contacto?.fecha_alta ?? null;
  if (!contacto || !alta) {
    return { elegibilidad: "no_en_lista", dias_desde_alta: null, fecha_alta_contacto: null, ventana_dia: null };
  }

  const dias = Math.floor((Date.now() - new Date(alta).getTime()) / 86_400_000);
  const dentro = dias >= 0 && dias < VENTANA_DIAS;
  return {
    elegibilidad: dentro ? "elegible" : "fuera_ventana",
    dias_desde_alta: dias,
    fecha_alta_contacto: alta,
    // Día de su ventana: 1 = mismo día del alta, 8 = último.
    ventana_dia: dentro ? dias + 1 : null,
  };
}

// Paso 1: se guarda el lead ANTES de que elija hueco. Si abandona el
// calendario, la fila queda igual con nombre, email y teléfono.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { nombre, email, telefono, consentDatos, variante } = body;

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
  if (consentDatos !== true) {
    return NextResponse.json({ error: "Marca la casilla de consentimiento para poder reservar." }, { status: 400 });
  }

  const emailLower = normalizarEmail(email);
  const ahora = new Date().toISOString();
  const elegibilidad = await calcularElegibilidad(emailLower);

  const { data: reserva, error: dbError } = await supabase
    .from("hoja_ruta_reservas")
    .insert({
      nombre: nombreTrim,
      email: emailLower,
      telefono: telefonoTrim,
      variante: variante === "ventana" ? "ventana" : "evergreen",
      consent_datos: true,
      consent_datos_en: ahora,
      consent_datos_texto: CONSENT_HOJA_RUTA.datos,
      consentimientos_version: CONSENT_VERSION,
      ...limpiarUtm(body.utm),
      creado_en: ahora,
      ...elegibilidad,
    })
    .select("id")
    .single();

  if (dbError) {
    console.error("hoja_ruta_reservas insert error:", dbError);
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }

  // A partir de aquí la reserva YA está guardada, así que nada de lo que
  // venga puede convertirse en un error para el lead: si le devolviéramos un
  // fallo, volvería a enviar el formulario y se duplicaría a sí mismo. Lo que
  // salga mal se registra y se sigue.
  try {
    // Esta landing es la segunda puerta de entrada al mismo sistema de
    // nurture: misma tabla, mismas columnas y misma función de envío que los
    // leads de Meta Ads, solo cambia el origen. Quien ya estaba en la lista
    // (lo normal: viene de /espalda) sale como "existente" y no se le
    // reinicia nada; quien llega en frío desde la evergreen entra desde cero.
    //
    // La casilla de consentimiento nombra el alta en la newsletter de forma
    // expresa: sin eso, esto no se podría hacer.
    const alta = await altaEnSecuencia({
      email: emailLower,
      origen: "landing_hoja_ruta",
      nombre: nombreTrim,
      idioma: "es",
      tags: ["entrenamiento", "tirada02", "hoja_de_ruta"],
      telefono: telefonoTrim,
      recibeSecuencia: true,
    });

    if (alta.contacto) {
      // Igual que en /api/leads/entrada: si el envío falla no se revierte ni
      // se marca nada, y el cron lo recoge en su próxima pasada.
      await enviarMailSecuencia(alta.contacto);
    }
  } catch (err) {
    console.error("hoja-de-ruta: reserva guardada, pero falló el alta o el M0:", emailLower, err);
  }

  return NextResponse.json({ ok: true, id: reserva.id });
}

// Paso 2: el hueco elegido en el calendario. Solo entonces sale el aviso,
// con el estado de elegibilidad en el asunto.
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { id, hueco, eventId } = body;

  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 400 });
  }
  const huecoTrim = typeof hueco === "string" ? hueco.trim() : "";
  // La disponibilidad se recalcula aquí, no se da por buena la del navegador:
  // cubre tanto al cliente manipulado como al caso normal de que el hueco se
  // haya ocupado (o el día se haya bloqueado) mientras rellenaba el formulario.
  const contexto = await cargarContexto();
  if (contexto.error) {
    console.error("hoja-de-ruta: error validando el hueco:", contexto.error);
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }
  if (!esHuecoOfrecido(huecoTrim, contexto)) {
    return NextResponse.json({ error: "Ese hueco ya no está disponible. Elige otro, por favor." }, { status: 400 });
  }

  const ahora = new Date().toISOString();
  const { data: reserva, error } = await supabase
    .from("hoja_ruta_reservas")
    .update({ hueco: huecoTrim, hueco_en: ahora })
    .eq("id", id)
    .select("nombre, email, telefono, variante, elegibilidad, dias_desde_alta, ventana_dia")
    .single();

  if (error || !reserva) {
    if (error?.code === "23505") {
      // Un índice único acaba de rechazarlo: o alguien cogió ese mismo hueco,
      // o cogió otro del mismo día (solo hay una llamada al día), entre que
      // se le pintó el calendario y pulsó. La base de datos es la que corta
      // de verdad esa carrera; la comprobación de arriba solo la evita en el
      // caso normal.
      return NextResponse.json(
        { error: "Ese día lo acaban de coger. Elige otro hueco, por favor." },
        { status: 409 }
      );
    }
    console.error("hoja_ruta_reservas update error:", error);
    return NextResponse.json({ error: ERROR_GENERICO }, { status: 500 });
  }

  const estado = (reserva.elegibilidad ?? "no_en_lista") as Elegibilidad;
  const detalle =
    reserva.dias_desde_alta === null || reserva.dias_desde_alta === undefined
      ? ""
      : ` · día ${reserva.dias_desde_alta} desde el alta`;
  const asunto = `Entrenatzaile — Reserva Hoja de Ruta: ${reserva.nombre} [${ELEGIBILIDAD_ETIQUETA[estado]}${detalle}]`;

  const celda = "padding:0.35rem 0.6rem;border-bottom:1px solid #eee;vertical-align:top;";
  const fila = (k: string, v: string) =>
    `<tr><td style="${celda}"><strong>${k}</strong></td><td style="${celda}">${v}</td></tr>`;
  const html = `
    <div style="font-family:monospace;max-width:620px;margin:0 auto;padding:1.5rem;color:#1a1a1a;background:#f8f8f8;border:1px solid #ddd;font-size:0.88rem;">
      <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.12em;color:#999;margin:0 0 1rem 0;">ENTRENATZAILE · HOJA DE RUTA</p>
      <table style="width:100%;border-collapse:collapse;">
        ${fila("Nombre", escapar(reserva.nombre ?? ""))}
        ${fila("Email", escapar(reserva.email ?? ""))}
        ${fila("Teléfono", escapar(reserva.telefono ?? ""))}
        ${fila("Hueco", escapar(formatearHueco(huecoTrim)))}
        ${fila("Vio la versión", reserva.variante === "ventana" ? "ventana (gratis 8 días)" : "evergreen (90 €)")}
        ${fila("Elegibilidad", ELEGIBILIDAD_ETIQUETA[estado])}
        ${fila("Días desde el alta", reserva.dias_desde_alta ?? "—")}
        ${fila("Día de su ventana", reserva.ventana_dia ?? "—")}
      </table>
    </div>
  `;

  // Reserva confirmada: es la conversión más profunda del embudo. Como el
  // resto, va con su identificador compartido y solo si aceptó el
  // seguimiento.
  let metaEvento: string;
  if (!haAceptadoSeguimiento(req)) {
    metaEvento = "omitido: no aceptó las cookies";
  } else if (typeof eventId !== "string" || !eventId) {
    metaEvento = "omitido: el navegador no mandó eventId";
  } else {
    metaEvento = await enviarEventoMeta({
      nombre: "Schedule",
      eventId,
      url: req.headers.get("referer") ?? "https://entrenatzaile.alainzulaika.com/hoja-de-ruta",
      email: reserva.email as string,
      telefono: (reserva.telefono as string) ?? undefined,
      ...datosDeLaPeticion(req),
    });
  }
  await supabase.from("hoja_ruta_reservas").update({ meta_evento: metaEvento.slice(0, 600) }).eq("id", id);

  // Confirmación al lead: le queda por escrito el día y la hora. Va antes que
  // el aviso interno pero en su propio try, porque un fallo aquí no debe
  // dejarme a mí sin enterarme de que hay una reserva nueva.
  try {
    await sendEmail(
      reserva.nombre ? `${reserva.nombre} <${reserva.email}>` : (reserva.email as string),
      MAIL_RESERVA_ASUNTO,
      wrapNurture(mailReservaCuerpo(reserva.nombre, formatearHueco(huecoTrim)), reserva.email as string, false),
      resolveNewsletterFrom("entrenatzaile@alainzulaika.com")
    );
  } catch (err) {
    console.error("hoja-de-ruta: error enviando la confirmación al lead:", reserva.email, err);
  }

  try {
    await sendEmail(
      "newsletter@alainzulaika.com",
      asunto,
      html,
      "Entrenatzaile <alain@alainzulaika.com>"
    );
    await supabase.from("hoja_ruta_reservas").update({ aviso_enviado: true, aviso_error: null }).eq("id", id);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error("hoja-de-ruta: error enviando el aviso:", mensaje);
    // La reserva ya está guardada: que falle el aviso no debe romperle la
    // reserva al lead. Queda registrado en la fila para poder verlo.
    await supabase.from("hoja_ruta_reservas").update({ aviso_enviado: false, aviso_error: mensaje }).eq("id", id);
  }

  return NextResponse.json({ ok: true, cuando: formatearHueco(huecoTrim) });
}
