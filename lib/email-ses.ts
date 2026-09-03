import Mailjet from "node-mailjet";

// El cliente se crea en el primer envío, no al importar el módulo.
//
// Antes se creaba arriba del todo, y si faltaban las claves (en local viven
// solo en Vercel) reventaba al cargar el módulo: eso tumbaba la ruta entera
// que lo importase, que devolvía un 500 de HTML sin JSON. Resultado: un
// formulario que fallaba entero, sin decir por qué, cuando lo único roto era
// el correo. Así el fallo ocurre donde tiene que ocurrir —dentro de
// sendEmail, que ya está envuelto en try/catch en todos los sitios— y el
// cron lo reintenta.
let cliente: ReturnType<typeof Mailjet.apiConnect> | null = null;

function getClient() {
  if (!cliente) {
    cliente = Mailjet.apiConnect(process.env.MJ_APIKEY_PUBLIC!, process.env.MJ_APIKEY_PRIVATE!);
  }
  return cliente;
}

function parseAddress(addr: string) {
  const m = addr.match(/^(.+?)\s*<(.+?)>$/);
  return m ? { Email: m[2].trim(), Name: m[1].trim() } : { Email: addr };
}

export const NEWSLETTER_SENDERS = ["newsletter@alainzulaika.com", "entrenatzaile@alainzulaika.com"] as const;
export type NewsletterSender = (typeof NEWSLETTER_SENDERS)[number];

export function resolveNewsletterFrom(remitente?: string | null): string {
  const email = NEWSLETTER_SENDERS.includes(remitente as NewsletterSender) ? remitente! : NEWSLETTER_SENDERS[0];
  return `Alain Zulaika <${email}>`;
}

// Confirmaciones puntuales de formularios (contacto, belaustegi, valoración, arrogante, Mirariak)
export const ALAIN_FROM = "Alain Zulaika <alain@alainzulaika.com>";

export interface EmailAttachment {
  filename: string;
  contentType: string;
  base64Content: string;
}

/**
 * Seguimiento de un envío.
 *
 * `campana` es lo que permite sacar estadísticas POR MAIL: Mailjet agrupa
 * bajo esa etiqueta todos los envíos que la lleven, así que "nurture-m0"
 * junta a todo el que haya pasado por el M0, sin importar cuándo. Sin ella,
 * Mailjet solo sabe de mensajes sueltos y hay que mirarlos de uno en uno.
 *
 * `customId` identifica al destinatario dentro de esa campaña, para poder
 * cruzar un evento concreto con la persona.
 */
export interface SeguimientoEmail {
  campana?: string;
  customId?: string;
}

// ---------------------------------------------------------------------------
// Revisión de la respuesta de Mailjet.
//
// ESTO ES IMPORTANTE Y NO ES OBVIO: la Send API v3.1 NO usa el código HTTP
// para decir que un mensaje no se ha enviado. Devuelve 200 con un array
// `Messages`, y dentro de cada uno un Status que puede ser "error". Un
// remitente sin validar, un destinatario en la lista de bloqueados o una
// dirección mal formada llegan así: con 200.
//
// node-mailjet solo lanza cuando el HTTP no es 2xx, de modo que sin mirar el
// cuerpo un rechazo se ve exactamente igual que un envío correcto. Quien
// llama envuelve todo en try/catch y da por bueno lo que no lanza, así que
// el correo desaparecía sin dejar ni un log: ni error, ni envío en el panel.
//
// Aquí se convierte ese "error dentro de un 200" en una excepción de verdad,
// que es lo que todo el proyecto ya sabe manejar: se registra en la fila
// (aviso_error, pago_confirmacion_error…) y el cron lo reintenta.
// ---------------------------------------------------------------------------

interface MensajeDeRespuesta {
  Status?: string;
  Errors?: Array<{ ErrorMessage?: string; ErrorCode?: string; ErrorRelatedTo?: string[] }>;
  To?: Array<{ Email?: string; MessageUUID?: string }>;
}

function mensajesDe(respuesta: unknown): MensajeDeRespuesta[] {
  const cuerpo = (respuesta as { body?: { Messages?: unknown } } | null)?.body;
  return Array.isArray(cuerpo?.Messages) ? (cuerpo.Messages as MensajeDeRespuesta[]) : [];
}

function describirFallo(mensaje: MensajeDeRespuesta): string {
  const errores = (mensaje.Errors ?? [])
    .map((e) => [e.ErrorCode, e.ErrorMessage, e.ErrorRelatedTo?.join(", ")].filter(Boolean).join(" · "))
    .filter(Boolean);
  return errores.length ? errores.join(" | ") : `Status=${mensaje.Status ?? "desconocido"} sin detalle`;
}

// El detalle de un envío correcto solo se escribe fuera de producción: en
// local es justo lo que hace falta para no adivinar, y en Vercel serían
// cientos de líneas al día por los envíos de la secuencia.
function registrarEnvio(destino: string, asunto: string, mensajes: MensajeDeRespuesta[]) {
  if (process.env.NODE_ENV === "production") return;
  const uuid = mensajes[0]?.To?.[0]?.MessageUUID ?? "sin uuid";
  console.log(`mailjet: enviado a ${destino} · "${asunto}" · ${uuid}`);
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  from = ALAIN_FROM,
  attachments?: EmailAttachment[],
  seguimiento?: SeguimientoEmail
) {
  const fromParsed = parseAddress(from);
  const respuesta = await getClient().post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: fromParsed,
        To: [parseAddress(to)],
        Subject: subject,
        HTMLPart: html,
        ReplyTo: { Email: "newsletter@alainzulaika.com" },
        // Sin esto Mailjet no registra ni aperturas ni clics, y no hay
        // estadísticas que sacar después.
        TrackOpens: "enabled",
        TrackClicks: "enabled",
        ...(seguimiento?.campana ? { CustomCampaign: seguimiento.campana } : {}),
        ...(seguimiento?.customId ? { CustomID: seguimiento.customId } : {}),
        ...(attachments?.length
          ? {
              Attachments: attachments.map((a) => ({
                ContentType: a.contentType,
                Filename: a.filename,
                Base64Content: a.base64Content,
              })),
            }
          : {}),
      },
    ],
  });

  const mensajes = mensajesDe(respuesta);
  const fallidos = mensajes.filter((m) => m.Status !== "success");
  if (fallidos.length || !mensajes.length) {
    const detalle = mensajes.length ? fallidos.map(describirFallo).join(" | ") : "Mailjet no devolvió ningún mensaje";
    console.error(`mailjet: RECHAZADO para ${to} · de ${fromParsed.Email} · "${subject}" · ${detalle}`);
    throw new Error(`Mailjet rechazó el envío a ${to}: ${detalle}`);
  }
  registrarEnvio(to, subject, mensajes);
}

// Sends up to 50 messages in a single Mailjet API call
export async function sendEmailBatch(
  messages: Array<{ to: string; subject: string; html: string }>,
  from = "Alain Zulaika <newsletter@alainzulaika.com>"
) {
  if (!messages.length) return;
  const fromParsed = parseAddress(from);
  const respuesta = await getClient().post("send", { version: "v3.1" }).request({
    Messages: messages.map(({ to, subject, html }) => ({
      From: fromParsed,
      To: [parseAddress(to)],
      Subject: subject,
      HTMLPart: html,
      ReplyTo: fromParsed,
    })),
  });

  // Aquí NO se lanza, al revés que en sendEmail: esto manda hasta 50 mensajes
  // de una campaña en una sola llamada, y una dirección quemada no puede
  // tumbar el envío de las otras 49. Se registran los rechazos para poder
  // verlos, que es lo que antes no existía.
  const fallidos = mensajesDe(respuesta).filter((m) => m.Status !== "success");
  if (fallidos.length) {
    console.error(
      `mailjet: ${fallidos.length} de ${messages.length} rechazados en la tanda · ${fallidos
        .map(describirFallo)
        .join(" | ")}`
    );
  }
}
