import Mailjet from "node-mailjet";

const client = Mailjet.apiConnect(
  process.env.MJ_APIKEY_PUBLIC!,
  process.env.MJ_APIKEY_PRIVATE!
);

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  from = "Alain Zulaika <contacto@niala.es>"
) {
  const fromMatch = from.match(/^(.+?)\s*<(.+?)>$/);
  const fromName = fromMatch ? fromMatch[1].trim() : "Alain Zulaika";
  const fromEmail = fromMatch ? fromMatch[2].trim() : from;

  const toMatch = to.match(/^(.+?)\s*<(.+?)>$/);
  const toEntry = toMatch
    ? { Email: toMatch[2].trim(), Name: toMatch[1].trim() }
    : { Email: to };

  await client.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: { Email: fromEmail, Name: fromName },
        To: [toEntry],
        Subject: subject,
        HTMLPart: html,
        ReplyTo: { Email: "contacto@niala.es" },
      },
    ],
  });
}
