// Correos de /acompanamiento: el acuse a quien pide plaza.
//
// El aviso interno vive en la propia ruta, como en /audio. Y tampoco aquí se
// usa wrapNurture(): ese envoltorio mete el pie de baja de la newsletter, y
// esto es un acuse de recibo, no un envío de ninguna lista.

import { marcadoresDeNombre } from "@/lib/email-markdown";
import { resolveNewsletterFrom } from "@/lib/email-ses";

export const ACOMPANAMIENTO_FROM = resolveNewsletterFrom("entrenatzaile@alainzulaika.com");

// El aviso de cada solicitud llega aquí. Es la dirección de la que sale el
// acuse, así que si la persona responde a ese correo cae en el mismo buzón.
export const ACOMPANAMIENTO_AVISO_A = "entrenatzaile@alainzulaika.com";

const CONTACTO = "contacto@alainzulaika.com";

export function envoltorioAcompanamiento(cuerpoHtml: string): string {
  return `
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
      <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">${cuerpoHtml}</div>
      <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.9rem;color:#555;line-height:2;">
        <p style="margin:0;">Alain Zulaika · Entrenatzaile · <a href="mailto:${CONTACTO}" style="color:#555;">${CONTACTO}</a></p>
      </div>
    </div>
  `;
}

export const MAIL_ACOMPANAMIENTO_ASUNTO = "Recibido";

export function mailAcompanamientoCuerpo(nombre: string): string {
  const p = "margin:0 0 1.6rem 0;";
  // El nombre lo escribe la persona: se escapa antes de meterlo en el HTML.
  const saludo = marcadoresDeNombre(nombre).saludo.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `
    <p style="${p}">${saludo},</p>
    <p style="${p}">Ya tengo tu solicitud. En menos de 48 horas te escribo por WhatsApp para buscar un hueco y hablar.</p>
    <p style="margin:0;">Alain</p>
  `;
}
