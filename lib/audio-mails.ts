// Correos de /audio: la confirmación a quien rellena el formulario.
//
// El aviso interno vive en la propia ruta, como en el resto de formularios:
// es una tabla de monospace que solo leo yo y no tiene nada que compartir con
// esto.
//
// NO se usa wrapNurture() a propósito, igual que en creadores: ese envoltorio
// mete el pie de baja de la newsletter, y quien rellena este formulario no
// entra en ninguna lista. Es un correo transaccional y se comporta como tal.

const CONTACTO = "contacto@alainzulaika.com";

export function envoltorioAudio(cuerpoHtml: string): string {
  return `
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
      <div style="font-size:1.15rem;line-height:2.1;color:#1a1a1a;">${cuerpoHtml}</div>
      <div style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid #eee;font-size:0.9rem;color:#555;line-height:2;">
        <p style="margin:0;">Alain Zulaika · <a href="mailto:${CONTACTO}" style="color:#555;">${CONTACTO}</a></p>
      </div>
    </div>
  `;
}

export const MAIL_AUDIO_ASUNTO = "He recibido tu formulario (audio en 72 h como máximo)";

/**
 * @param banderaRoja Si marcó alguna de las señales de alarma. El correo lo
 *                    dice ya, sin esperar al audio: es lo único de todo esto
 *                    que no puede llegar tarde.
 */
export function mailAudioCuerpo(nombre: string, banderaRoja: boolean): string {
  const p = "margin:0 0 1.6rem 0;";
  const saludo = nombre.trim() ? `Hola, ${nombre.trim().split(" ")[0]}.` : "Hola.";

  const alarma = banderaRoja
    ? `<p style="${p}">Una cosa que no espera al audio: has marcado alguna de las señales de la lista. Eso no se entrena, se mira. <strong>Pide cita con tu médico antes de ponerte a hacer nada</strong> — el audio te va a decir lo mismo.</p>`
    : "";

  return `
    <p style="${p}">${saludo}</p>
    <p style="${p}">Tengo tu formulario. Gracias por el rato que le has dedicado: con respuestas así puedo decirte algo que sirva, en vez de un consejo general.</p>
    ${alarma}
    <p style="${p}">Lo leo entero y te grabo el audio. Te lo mando <strong>por WhatsApp, al número que me has dejado</strong>, en cuanto pueda y como máximo en 72 horas.</p>
    <p style="${p}">Si se te ha quedado algo fuera, respóndeme a este correo y lo añado antes de grabar.</p>
    <p style="margin:0;">Alain</p>
  `;
}
