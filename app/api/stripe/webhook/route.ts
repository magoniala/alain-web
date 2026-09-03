import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, resolveNewsletterFrom } from "@/lib/email-ses";
import { wrapNurture } from "@/lib/nurture";
import { formatearHueco } from "@/lib/entrenatzaile-huecos";
import { getStripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

// Webhook de Stripe: la ÚNICA fuente de verdad del pago.
//
// La página de gracias no confirma nada y no tiene forma de hacerlo: se llega
// a ella escribiendo la URL igual que pagando. Aquí, en cambio, la petición
// viene firmada por Stripe y la firma se verifica contra el cuerpo crudo. Un
// pago existe cuando lo dice esto y solo cuando lo dice esto.
//
// Registrado en el apex (https://alainzulaika.com/api/stripe/webhook), no en
// el subdominio: /api no pasa por el proxy, así que las dos rutas llegan aquí
// igual, y el apex es el dominio del proyecto, que no depende de un rewrite.

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const AVISO_INTERNO = "newsletter@alainzulaika.com";
const DE_ALAIN = "Entrenatzaile <alain@alainzulaika.com>";

const p = "margin:0 0 1.6rem 0;";

export async function POST(req: Request) {
  // La firma se calcula sobre el cuerpo TAL CUAL llegó. Nada de req.json():
  // volver a serializar el objeto cambiaría un espacio o el orden de una
  // clave y la verificación fallaría siempre.
  const cuerpo = await req.text();
  const firma = req.headers.get("stripe-signature");

  let evento: Stripe.Event;
  try {
    evento = getStripe().webhooks.constructEvent(cuerpo, firma!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    // 400 y punto: sin firma válida esto no es Stripe, y Stripe no reintenta
    // los 400. Un 500 aquí haría que se reintentara para siempre algo que
    // nunca va a verificar.
    console.error("stripe webhook: firma inválida:", err);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  // ---------------------------------------------------------------------
  // Idempotencia, antes de tocar nada.
  //
  // Stripe reenvía: ante un 500, ante un timeout, y a mano desde el panel.
  // El id del evento es la clave primaria de stripe_eventos, así que este
  // insert o entra o choca con un 23505. Si choca, este evento ya está
  // atendido y aquí no se vuelve a hacer nada — que es lo que impide el
  // segundo correo al lead.
  //
  // Va ANTES de procesar y no después: si fuera después, dos entregas
  // simultáneas del mismo evento pasarían las dos la comprobación.
  // ---------------------------------------------------------------------
  const { error: errEvento } = await supabase
    .from("stripe_eventos")
    .insert({ id: evento.id, tipo: evento.type });

  if (errEvento) {
    if (errEvento.code === "23505") {
      return NextResponse.json({ recibido: true, repetido: true });
    }
    // No se ha podido registrar el evento: mejor un 500 y que Stripe lo
    // reintente que procesarlo sin poder garantizar que no se repite.
    console.error("stripe webhook: error registrando el evento:", evento.id, errEvento);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed":
        await confirmarPago(evento.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
        await marcarExpirada(evento.data.object as Stripe.Checkout.Session);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`stripe webhook: error procesando ${evento.type}:`, err);
    // Se borra el registro del evento para que el reintento de Stripe pueda
    // volver a entrar. Si se dejara puesto, el 500 pediría un reintento que
    // la propia idempotencia rechazaría, y el pago se quedaría sin procesar
    // para siempre.
    await supabase.from("stripe_eventos").delete().eq("id", evento.id);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ recibido: true });
}

function reservaDeLaSesion(sesion: Stripe.Checkout.Session): string | null {
  const id = sesion.metadata?.reserva_id;
  if (!id) {
    console.error("stripe webhook: sesión sin reserva_id en metadata:", sesion.id);
    return null;
  }
  return id;
}

// ---------------------------------------------------------------------------
// Pagado
// ---------------------------------------------------------------------------

async function confirmarPago(sesion: Stripe.Checkout.Session) {
  const reservaId = reservaDeLaSesion(sesion);
  if (!reservaId) return;

  const paymentIntent = typeof sesion.payment_intent === "string" ? sesion.payment_intent : null;

  // Segundo candado, por debajo del de stripe_eventos: el estado solo pasa a
  // 'pagado' si venía de 'pendiente'. Es el mismo patrón que usan las
  // campañas y el aviso de abandono en este proyecto.
  const { data: reserva } = await supabase
    .from("hoja_ruta_reservas")
    .update({
      pago_estado: "pagado",
      stripe_payment_intent: paymentIntent,
      pagado_en: new Date().toISOString(),
      pago_error: null,
    })
    .eq("id", reservaId)
    .eq("pago_estado", "pendiente")
    .select("nombre, email, hueco, variante")
    .maybeSingle();

  if (reserva) {
    await avisarPagoConfirmado(reservaId, reserva);
    return;
  }

  // No estaba 'pendiente'. O ya se procesó (y entonces stripe_eventos habría
  // parado esto antes, así que es raro), o el cron acaba de expirarla y
  // liberar su hueco mientras esta persona terminaba de pagar.
  //
  // Ese segundo caso es el importante, y NO se resuelve sobrescribiendo: el
  // hueco puede ser ya de otra persona, y devolvérselo a esta la dejaría a
  // ella sin llamada. Se registra el cobro, se guarda el payment_intent para
  // poder devolver el dinero con un clic, y decide Alain.
  const { data: descolocada } = await supabase
    .from("hoja_ruta_reservas")
    .update({
      pago_estado: "pagado_fuera_de_plazo",
      stripe_payment_intent: paymentIntent,
      pagado_en: new Date().toISOString(),
    })
    .eq("id", reservaId)
    .eq("pago_estado", "expirado")
    .select("nombre, email, telefono, hueco_liberado, variante")
    .maybeSingle();

  if (!descolocada) {
    console.error("stripe webhook: pago sobre una reserva en estado inesperado:", reservaId, sesion.id);
    return;
  }

  await avisarPagoFueraDePlazo(reservaId, descolocada, paymentIntent);
}

async function avisarPagoConfirmado(
  reservaId: string,
  reserva: { nombre: string | null; email: string; hueco: string | null; variante: string | null }
) {
  const cuando = reserva.hueco ? formatearHueco(reserva.hueco) : "tu hueco";
  const saludo = reserva.nombre ? `Hola, ${reserva.nombre.split(" ")[0]}.` : "Hola.";

  // Lo que dice este correo es exactamente lo que ya prometía el de la
  // reserva: que en cuanto llegue el pago, Alain escribe por WhatsApp con el
  // enlace. El enlace de la videollamada no sale de aquí a propósito — se
  // manda a mano para poder hacer seguimiento y bajar el no-show.
  const html = `
    <p style="${p}">${saludo}</p>
    <p style="${p}">Pago recibido. Tu hueco queda confirmado:</p>
    <p style="${p}"><strong>${cuando}</strong></p>
    <p style="${p}">Es una videollamada de una hora. No necesitas gimnasio, ni material, ni estar en forma: solo un sitio donde puedas moverte un poco delante de la cámara.</p>
    <p style="${p}">Te escribo por WhatsApp para presentarme y mandarte el enlace de la llamada.</p>
    <p style="${p}">Si te surge algo y no puedes con esa fecha, respóndeme a este correo y lo cambiamos sin problema.</p>
    <p style="margin:0;">Alain</p>
  `;

  // El pago ya está guardado. Que falle el correo no puede deshacerlo ni
  // devolver un 500 —Stripe reintentaría y stripe_eventos rechazaría el
  // reintento—, así que se registra en la fila y se sigue.
  try {
    await sendEmail(
      reserva.nombre ? `${reserva.nombre} <${reserva.email}>` : reserva.email,
      "Pago recibido: tu Hoja de Ruta está confirmada",
      wrapNurture(html, reserva.email, false),
      resolveNewsletterFrom("entrenatzaile@alainzulaika.com")
    );
    await supabase
      .from("hoja_ruta_reservas")
      .update({ pago_confirmacion_enviada: true, pago_confirmacion_error: null })
      .eq("id", reservaId);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error("stripe webhook: pago guardado pero falló la confirmación:", reserva.email, err);
    await supabase
      .from("hoja_ruta_reservas")
      .update({ pago_confirmacion_enviada: false, pago_confirmacion_error: mensaje.slice(0, 600) })
      .eq("id", reservaId);
  }

  // Y el aviso a Alain, que es quien tiene que escribir por WhatsApp.
  try {
    await sendEmail(
      AVISO_INTERNO,
      `Entrenatzaile — PAGADO 90 €: ${reserva.nombre ?? reserva.email} · ${cuando}`,
      `<div style="font-family:monospace;font-size:0.9rem;line-height:1.7;">
        <p style="${p}"><strong>${reserva.nombre ?? "(sin nombre)"}</strong> ha pagado la Hoja de Ruta.</p>
        <p style="${p}">Hueco: <strong>${cuando}</strong><br>Email: ${reserva.email}<br>Vio: ${reserva.variante ?? "—"}</p>
        <p style="margin:0;">Le toca el WhatsApp con el enlace de la llamada.</p>
      </div>`,
      DE_ALAIN
    );
  } catch (err) {
    console.error("stripe webhook: error enviando el aviso interno de pago:", err);
  }
}

async function avisarPagoFueraDePlazo(
  reservaId: string,
  reserva: { nombre: string | null; email: string; telefono: string | null; hueco_liberado: string | null; variante: string | null },
  paymentIntent: string | null
) {
  // Solo a Alain. Al lead no se le escribe nada automático: no se le puede
  // decir ni "confirmado" (su hueco puede ser ya de otro) ni "te devuelvo el
  // dinero" (eso lo decide una persona). Cualquiera de las dos cosas dicha
  // por un servidor sería peor que un correo escrito a mano diez minutos
  // después.
  try {
    await sendEmail(
      AVISO_INTERNO,
      `Entrenatzaile — COBRO SIN HUECO: ${reserva.nombre ?? reserva.email}`,
      `<div style="font-family:monospace;font-size:0.9rem;line-height:1.7;">
        <p style="${p}"><strong>Ha pagado justo después de que se liberara su hueco.</strong></p>
        <p style="${p}">Pasaron las 24 horas, el cron liberó el hueco, y el pago entró después. El hueco puede ser ya de otra persona, así que el sistema no ha tocado nada: hay 90 € cobrados y ninguna llamada asignada.</p>
        <p style="${p}">Nombre: ${reserva.nombre ?? "—"}<br>Email: ${reserva.email}<br>Teléfono: ${reserva.telefono ?? "—"}<br>Hueco que tenía: ${reserva.hueco_liberado ? formatearHueco(reserva.hueco_liberado) : "—"}<br>Reserva: ${reservaId}<br>PaymentIntent: ${paymentIntent ?? "—"}</p>
        <p style="margin:0;">O le recolocas la llamada, o le devuelves los 90 € desde ese PaymentIntent. A él no le ha llegado nada.</p>
      </div>`,
      DE_ALAIN
    );
  } catch (err) {
    console.error("stripe webhook: error avisando de un cobro sin hueco:", reservaId, err);
  }
}

// ---------------------------------------------------------------------------
// Expirada sin pagar
// ---------------------------------------------------------------------------

// Stripe avisa de que la sesión venció. Aquí solo se marca el estado: liberar
// el hueco y avisar al lead lo hace el cron, en procesarHuecosCaducados(),
// para que haya un único sitio donde eso ocurre.
//
// Es a propósito. Este evento puede tardar en llegar, o no llegar; si la
// liberación viviera en los dos sitios, habría dos caminos que compiten por
// el mismo correo. Así, el webhook adelanta el estado cuando puede y el cron
// hace el trabajo siempre.
async function marcarExpirada(sesion: Stripe.Checkout.Session) {
  const reservaId = reservaDeLaSesion(sesion);
  if (!reservaId) return;

  await supabase
    .from("hoja_ruta_reservas")
    .update({ stripe_session_expira_en: new Date().toISOString() })
    .eq("id", reservaId)
    // Nunca tocar una reserva ya pagada.
    .eq("pago_estado", "pendiente");
}
