import { createClient } from "@supabase/supabase-js";
import { altaEnSecuencia, normalizarEmail, wrapNurture } from "@/lib/nurture";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import { mailReservaAsunto, mailReservaCuerpo } from "@/lib/entrenatzaile-mails";
import {
  CONSENT_HOJA_RUTA,
  CONSENT_VERSION,
  ELEGIBILIDAD_ETIQUETA,
  limpiarUtm,
  type Elegibilidad,
} from "@/lib/entrenatzaile-formularios";
import { ventanaDeContacto } from "@/lib/entrenatzaile-ventana";
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
import { getStripe, PRECIO_HOJA_RUTA_CENT } from "@/lib/stripe";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const ERROR_GENERICO = "Ha ocurrido un error. Inténtalo de nuevo.";

const VARIANTES_GUARDABLES: ReadonlySet<unknown> = new Set(["ventana", "evergreen", "capacidades"]);

const NOMBRE_VARIANTE: Record<string, string> = {
  ventana: "ventana (gratis 8 días)",
  evergreen: "evergreen (90 €)",
  capacidades: "capacidades (90 €)",
};

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

// Elegibilidad calculada en servidor contra la lista de suscriptores. No
// bloquea la reserva: viaja en el asunto del aviso que me llega a mí.
//
// El cálculo en sí vive en lib/entrenatzaile-ventana.ts, que es el mismo que
// usa la landing para decidir qué versión enseñar. Así el aviso no puede
// decir "NO GRATIS" de alguien a quien la página acaba de prometerle que sí.
async function calcularElegibilidad(emailLower: string) {
  // Solo fecha_alta y recibe_secuencia: newsletter_contactos no tiene
  // created_at. Pedirla haría fallar el select entero y todo el mundo saldría
  // como "no_en_lista".
  //
  // recibe_secuencia hace falta porque de este cálculo depende ahora el
  // cobro, no solo el asunto de un aviso: ver ventanaDeContacto().
  const { data: contacto, error } = await supabase
    .from("newsletter_contactos")
    .select("fecha_alta, recibe_secuencia")
    .eq("email", emailLower)
    .maybeSingle();

  if (error) {
    console.error("hoja-de-ruta: error consultando elegibilidad:", emailLower, error);
  }

  // ultimo_dia solo sirve para pintar la fecha en la landing; en la fila de
  // la reserva no se guarda, así que se descarta aquí.
  const { ultimo_dia, ...ventana } = ventanaDeContacto(contacto);
  void ultimo_dia;
  return ventana;
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
      // Qué landing vio, no lo que le corresponde: eso es `elegibilidad`.
      // Lista cerrada para que el navegador no pueda escribir aquí lo que
      // quiera. "capacidades" es /hoja-de-ruta/capacidades, que se pinta
      // igual que la evergreen pero es otra página y conviene distinguirla.
      variante: VARIANTES_GUARDABLES.has(variante) ? variante : "evergreen",
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
    // Alta en la lista, pero FUERA de la secuencia de nurture. Quien llega
    // aquí ya ha pedido la Hoja de Ruta: la secuencia está escrita para
    // convencer de pedirla, empezando por un M0 que le entrega la guía de
    // /espalda que este no ha pedido y le manda a otra agenda distinta.
    //
    // recibeSecuencia:false no le deja fuera de la newsletter diaria, que se
    // envía justamente a quien NO está en mitad de una secuencia
    // (/api/newsletter/send). Simplemente entra en la lista y no recibe
    // ningún correo de bienvenida.
    //
    // Quien ya estaba en la lista (lo normal: viene de /espalda) sale como
    // "existente" y no se le toca nada: ni la posición, ni recibe_secuencia.
    // Sigue su secuencia donde estuviera.
    //
    // La casilla de consentimiento nombra el alta en la newsletter de forma
    // expresa: sin eso, esto no se podría hacer.
    await altaEnSecuencia({
      email: emailLower,
      origen: "landing_hoja_ruta",
      nombre: nombreTrim,
      idioma: "es",
      tags: ["entrenamiento", "tirada02", "hoja_de_ruta"],
      telefono: telefonoTrim,
      recibeSecuencia: false,
    });
  } catch (err) {
    console.error("hoja-de-ruta: reserva guardada, pero falló el alta en la lista:", emailLower, err);
  }

  return NextResponse.json({ ok: true, id: reserva.id });
}

const BASE_ENTRENATZAILE = "https://entrenatzaile.alainzulaika.com";

// Ventana de Stripe para pagar. 24 h es el máximo que admite expires_at, y
// coincide con lo que el correo de reserva lleva prometiendo desde siempre
// ("te guardo el hueco 24 horas").
const HORAS_PARA_PAGAR = 24;

/**
 * ¿Se le cobra a esta reserva?
 *
 * Se cobra SIEMPRE salvo que se cumplan las dos condiciones a la vez:
 *
 *   variante === "ventana"       lo que la landing le pintó
 *   elegibilidad === "elegible"  lo que la lista dice de verdad
 *
 * Hacen falta las dos porque cada una tapa un agujero distinto. `variante`
 * la manda el navegador: sin la segunda condición, un fetch a mano con
 * variante:"ventana" se saltaría el cobro. Y `elegibilidad` no basta sola:
 * quien entra por /capacidades estando dentro de su ventana vio 90 € en toda
 * la página, y regalárselo en silencio sería tan raro como cobrarle de más.
 *
 * `elegibilidad` es la que se calculó y se guardó en el POST, no una nueva:
 * recalcularla aquí abriría de nuevo el hueco de la medianoche, esta vez con
 * los minutos que tarda alguien en elegir día y hora en el calendario.
 */
function decidirCobro(variante: string | null, elegibilidad: string | null) {
  const gratis = variante === "ventana" && elegibilidad === "elegible";
  // La página le dijo gratis y la lista dice que no: se le cobra, pero el
  // cliente tiene que avisarle antes de llevarlo a Stripe y esperar a que lo
  // confirme él. Y a mí me tiene que llegar marcado en el asunto.
  const discrepancia = variante === "ventana" && elegibilidad !== "elegible";
  return { cobra: !gratis, discrepancia };
}

/**
 * Crea la sesión de Checkout de esta reserva y la guarda en su fila.
 *
 * Devuelve la URL, o null si algo falla. Nunca lanza: cuando llega aquí el
 * hueco YA está apartado en la base de datos, y un fallo de Stripe no puede
 * convertirse en un error en la cara del lead — volvería a enviar el
 * formulario y se duplicaría. Lo que salga mal queda en pago_error y en el
 * aviso interno, y el correo se cae al enlace de respaldo.
 */
async function crearSesionDePago(args: {
  reservaId: string;
  email: string;
  hueco: string;
  variante: string | null;
}): Promise<{ url: string | null; error: string | null }> {
  const expiraEn = new Date(Date.now() + HORAS_PARA_PAGAR * 3600_000);

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: process.env.STRIPE_PRICE_ID_HOJA_RUTA!, quantity: 1 }],
      customer_email: args.email,
      // El webhook resuelve la reserva por aquí. Va también el hueco, para
      // poder cuadrar a mano un pago descolocado sin salir del dashboard.
      metadata: {
        reserva_id: args.reservaId,
        hueco: args.hueco,
        variante: args.variante ?? "",
      },
      expires_at: Math.floor(expiraEn.getTime() / 1000),
      // Las páginas viven en el subdominio: /hoja-de-ruta no existe en el
      // apex, y el proxy mandaría a un visitante no vascófono a /es/... que
      // tampoco existe. Aquí NO vale NEXT_PUBLIC_BASE_URL.
      success_url: `${BASE_ENTRENATZAILE}/hoja-de-ruta/gracias`,
      cancel_url:
        args.variante === "capacidades"
          ? `${BASE_ENTRENATZAILE}/hoja-de-ruta/capacidades`
          : `${BASE_ENTRENATZAILE}/hoja-de-ruta`,
      locale: "es",
    });

    await supabase
      .from("hoja_ruta_reservas")
      .update({
        pago_estado: "pendiente",
        pago_importe_cent: PRECIO_HOJA_RUTA_CENT,
        stripe_session_id: session.id,
        stripe_session_url: session.url,
        stripe_session_expira_en: expiraEn.toISOString(),
        pago_error: null,
      })
      .eq("id", args.reservaId);

    return { url: session.url, error: null };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error("hoja-de-ruta: no se pudo crear la sesión de pago:", args.reservaId, err);
    // pago_estado se queda a 'pendiente' igual: hay un hueco apartado
    // esperando dinero, y el cron tiene que poder liberarlo aunque no haya
    // sesión que expirar.
    await supabase
      .from("hoja_ruta_reservas")
      .update({
        pago_estado: "pendiente",
        pago_importe_cent: PRECIO_HOJA_RUTA_CENT,
        stripe_session_expira_en: expiraEn.toISOString(),
        pago_error: mensaje.slice(0, 600),
      })
      .eq("id", args.reservaId);
    return { url: null, error: mensaje };
  }
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

  // El hueco ya está apartado (lo impone el índice único, no este código).
  // A partir de aquí se decide el dinero.
  const { cobra, discrepancia } = decidirCobro(reserva.variante, reserva.elegibilidad);

  const pago = cobra
    ? await crearSesionDePago({
        reservaId: id,
        email: reserva.email as string,
        hueco: huecoTrim,
        variante: reserva.variante,
      })
    : { url: null, error: null };

  const estado = (reserva.elegibilidad ?? "no_en_lista") as Elegibilidad;
  const detalle =
    reserva.dias_desde_alta === null || reserva.dias_desde_alta === undefined
      ? ""
      : ` · día ${reserva.dias_desde_alta} desde el alta`;

  // El asunto tiene que poder leerse de un vistazo en el móvil y decir si esa
  // llamada trae dinero o no. Los dos casos raros van delante del resto,
  // porque son los únicos que piden que Alain haga algo:
  //
  //   PLAZO VENCIDO  vio la versión gratuita y se le ha cobrado igual. Si
  //                  escribe diciendo que estaba rellenándolo cuando venció,
  //                  hay que poder devolverle los 90 € sabiendo de qué habla.
  //   SIN ENLACE     se le cobra pero no hubo forma de crear la sesión.
  //                  Ese correo salió sin enlace de pago o con el de respaldo.
  const sinEnlace = cobra && !pago.url;
  const marca = discrepancia
    ? `PLAZO VENCIDO — PAGA (vio la gratuita)${sinEnlace ? " · SIN ENLACE" : ""}`
    : sinEnlace
      ? "PAGA · SIN ENLACE DE PAGO"
      : ELEGIBILIDAD_ETIQUETA[estado];
  const asunto = `Entrenatzaile — Reserva Hoja de Ruta: ${reserva.nombre} [${marca}${detalle}]`;

  const celda = "padding:0.35rem 0.6rem;border-bottom:1px solid #eee;vertical-align:top;";
  const fila = (k: string, v: string) =>
    `<tr><td style="${celda}"><strong>${k}</strong></td><td style="${celda}">${v}</td></tr>`;
  const html = `
    <div style="font-family:monospace;max-width:620px;margin:0 auto;padding:1.5rem;color:#1a1a1a;background:#f8f8f8;border:1px solid #ddd;font-size:0.88rem;">
      <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.12em;color:#999;margin:0 0 1rem 0;">ENTRENATZAILE · HOJA DE RUTA</p>
      ${
        discrepancia
          ? `<p style="margin:0 0 1rem 0;padding:0.7rem 0.9rem;background:#fff4e5;border-left:3px solid #D4860A;line-height:1.5;">
              <strong>Su plazo venció mientras reservaba.</strong> La página le enseñó la versión
              gratuita y el sistema le ha pedido los 90 €. Antes de mandarlo a Stripe se le
              explicó en pantalla, con el precio delante, y el paso al pago lo da él. Si escribe
              reclamándolo, es este caso.
            </p>`
          : ""
      }
      <table style="width:100%;border-collapse:collapse;">
        ${fila("Nombre", escapar(reserva.nombre ?? ""))}
        ${fila("Email", escapar(reserva.email ?? ""))}
        ${fila("Teléfono", escapar(reserva.telefono ?? ""))}
        ${fila("Hueco", escapar(formatearHueco(huecoTrim)))}
        ${fila("Vio la versión", NOMBRE_VARIANTE[reserva.variante ?? ""] ?? "evergreen (90 €)")}
        ${fila("Elegibilidad", ELEGIBILIDAD_ETIQUETA[estado])}
        ${fila("Cobro", cobra ? "90 € — pendiente de pago" : "gratis (ventana)")}
        ${fila(
          "Enlace de pago",
          !cobra
            ? "—"
            : pago.url
              ? "sesión de Checkout creada"
              : `NO SE PUDO CREAR: ${escapar(pago.error ?? "motivo desconocido")}`
        )}
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
      mailReservaAsunto(cobra),
      wrapNurture(
        mailReservaCuerpo(reserva.nombre, formatearHueco(huecoTrim), cobra, pago.url),
        reserva.email as string,
        false
      ),
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

  // `pagoUrl` es lo que hace que el navegador lleve al lead a Stripe. Si va
  // null, la reserva se comporta como siempre: pantalla de "hueco reservado"
  // y a esperar el WhatsApp. Eso pasa tanto en la gratuita como cuando no se
  // ha podido crear la sesión — en ese segundo caso el correo lleva el enlace
  // de respaldo y a Alain le ha llegado el aviso marcado.
  return NextResponse.json({
    ok: true,
    cuando: formatearHueco(huecoTrim),
    pagoUrl: pago.url,
    // Que la página tenga que avisarle de que su plazo venció y esperar a que
    // lo confirme él, en vez de mandarlo a Stripe sin más.
    //
    // No se condiciona a que haya pagoUrl a propósito. Si la sesión no se ha
    // podido crear, esta persona vio la versión gratuita y va a recibir un
    // correo pidiéndole 90 €: enterarse por ese correo es exactamente la
    // sorpresa que este aviso existe para evitar. Se le explica igual, sin
    // botón, y el correo le dirá cómo pagar.
    avisoPlazoVencido: discrepancia,
  });
}
