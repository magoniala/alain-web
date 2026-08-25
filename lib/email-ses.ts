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

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  from = ALAIN_FROM,
  attachments?: EmailAttachment[]
) {
  const fromParsed = parseAddress(from);
  await getClient().post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: fromParsed,
        To: [parseAddress(to)],
        Subject: subject,
        HTMLPart: html,
        ReplyTo: { Email: "newsletter@alainzulaika.com" },
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
}

// Sends up to 50 messages in a single Mailjet API call
export async function sendEmailBatch(
  messages: Array<{ to: string; subject: string; html: string }>,
  from = "Alain Zulaika <newsletter@alainzulaika.com>"
) {
  if (!messages.length) return;
  const fromParsed = parseAddress(from);
  await getClient().post("send", { version: "v3.1" }).request({
    Messages: messages.map(({ to, subject, html }) => ({
      From: fromParsed,
      To: [parseAddress(to)],
      Subject: subject,
      HTMLPart: html,
      ReplyTo: fromParsed,
    })),
  });
}
