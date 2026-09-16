// Correos de creadores.alainzulaika.com.
//
// Dos: la confirmación que recibe quien reserva y el aviso interno que me
// llega a mí. Son los mismos dos que manda la Hoja de Ruta, adaptados a lo
// que esta cita sí es:
//
//   · media hora, no una hora;
//   · sin pago, así que no hay enlace de Stripe ni promesa de guardar el
//     hueco 24 horas mientras llega el dinero;
//   · sin teléfono, así que la confirmación va por correo y no por WhatsApp.
//     Esto no es un detalle de redacción: el formulario no pide el teléfono,
//     de modo que prometer un WhatsApp sería prometer algo imposible.

const CONTACTO = "contacto@alainzulaika.com";

/**
 * Envoltorio de estos correos.
 *
 * NO se usa wrapNurture() a propósito, aunque el aspecto sea parecido: ese
 * envoltorio mete el pie de "dejar de recibir estos emails" y "cambiar
 * idioma", que apuntan a la baja de la newsletter. Quien reserva aquí no
 * entra en ninguna lista, así que ese pie le ofrecería darse de baja de algo
 * a lo que no está apuntado, contra una dirección que no existe en
 * newsletter_contactos. Esto es un correo transaccional y se comporta como
 * tal: dice quién escribe y cómo responderle, y nada más.
 */
export function envoltorioCreadores(cuerpoHtml: string): string {
  return `
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
      <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">${cuerpoHtml}</div>
      <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.9rem;color:#555;line-height:2;">
        <p style="margin:0;">Alain Zulaika · <a href="mailto:${CONTACTO}" style="color:#555;">${CONTACTO}</a></p>
      </div>
    </div>
  `;
}

export const MAIL_RESERVA_CREADORES_ASUNTO = "Tu media hora está reservada";

export function mailReservaCreadoresCuerpo(nombre: string | null, cuando: string): string {
  const p = "margin:0 0 1.6rem 0;";
  const saludo = nombre ? `Hola, ${nombre.split(" ")[0]}.` : "Hola.";

  return `
    <p style="${p}">${saludo}</p>
    <p style="${p}">Tu hueco está cogido:</p>
    <p style="${p}"><strong>${cuando}</strong></p>
    <p style="${p}">Es una videollamada de media hora. Te mando el enlace por aquí antes de la cita.</p>
    <p style="${p}">Si te surge algo y no puedes, respóndeme a este correo y lo cambiamos sin problema. Prefiero eso a quedarme esperando.</p>
    <p style="margin:0;">Alain</p>
  `;
}
