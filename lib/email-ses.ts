import Mailjet from "node-mailjet";

const client = Mailjet.apiConnect(
  process.env.MJ_APIKEY_PUBLIC!,
  process.env.MJ_APIKEY_PRIVATE!
);

function parseAddress(addr: string) {
  const m = addr.match(/^(.+?)\s*<(.+?)>$/);
  return m ? { Email: m[2].trim(), Name: m[1].trim() } : { Email: addr };
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  from = "Alain Zulaika <contacto@niala.es>"
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
      },
    ],
  });
}

// Sends up to 50 messages in a single Mailjet API call
export async function sendEmailBatch(
  messages: Array<{ to: string; subject: string; html: string }>,
  from = "Alain Zulaika <newsletter@niala.es>"
) {
  if (!messages.length) return;
  const fromParsed = parseAddress(from);
  await client.post("send", { version: "v3.1" }).request({
    Messages: messages.map(({ to, subject, html }) => ({
      From: fromParsed,
      To: [parseAddress(to)],
      Subject: subject,
      HTMLPart: html,
      ReplyTo: { Email: "newsletter@niala.es" },
    })),
  });
}
