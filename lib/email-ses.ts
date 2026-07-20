import Mailjet from "node-mailjet";

const client = Mailjet.apiConnect(
  process.env.MJ_APIKEY_PUBLIC!,
  process.env.MJ_APIKEY_PRIVATE!
);

function parseAddress(addr: string) {
  const m = addr.match(/^(.+?)\s*<(.+?)>$/);
  return m ? { Email: m[2].trim(), Name: m[1].trim() } : { Email: addr };
}

export const NEWSLETTER_SENDERS = ["newsletter@alainzulaika.com", "newsletter@niala.es"] as const;
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
  from = "Alain Zulaika <contacto@niala.es>",
  attachments?: EmailAttachment[]
) {
  const fromParsed = parseAddress(from);
  await client.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: fromParsed,
        To: [parseAddress(to)],
        Subject: subject,
        HTMLPart: html,
        ReplyTo: { Email: "newsletter@niala.es" },
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
  await client.post("send", { version: "v3.1" }).request({
    Messages: messages.map(({ to, subject, html }) => ({
      From: fromParsed,
      To: [parseAddress(to)],
      Subject: subject,
      HTMLPart: html,
      ReplyTo: fromParsed,
    })),
  });
}
