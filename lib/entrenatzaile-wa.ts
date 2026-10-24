// Enlace de WhatsApp al que lleva /wa (entrenatzaile.alainzulaika.com/wa).
//
// El destino de ese botón es la pantalla final del formulario instantáneo de
// Meta, así que la mayoría del tráfico llega desde el navegador interno de
// Facebook. Por eso /wa es una redirección del servidor y no un enlace con
// JavaScript detrás: ese navegador bloquea ventanas y scripts, pero obedece
// un 307 sin discutir.
//
// El número y el mensaje viven aquí para poder cambiarlos sin tocar la ruta.
// El mensaje se guarda EN CLARO y se codifica al construir la URL: así se lee
// en el código, y no hay forma de que acabe codificado dos veces el día que
// se edite.

export const WA_NUMERO = "34623810500";

export const WA_MENSAJE = "Hola Alain, acabo de descargar la ficha. Te cuento mi caso:";

// Con qué nombre se guardan los clics en espalda_eventos. Es un cajón
// aparte del embudo de /espalda a propósito: /api/entrenatzaile/embudo
// filtra por landing, así que estos clics no se mezclan con nada de lo que
// ya mides.
export const WA_LANDING = "ads_t03";

export const WA_EVENTO = "wa_click";

export function enlaceWaDirecto(): string {
  return `https://wa.me/${WA_NUMERO}?text=${encodeURIComponent(WA_MENSAJE)}`;
}

// ============================================================
// WhatsApp de confirmación de la Hoja de Ruta
// ============================================================
//
// El botón que va en el aviso interno de una reserva confirmada (gratis: al
// elegir hueco; de pago: al llegar el pago). Abre el chat de ESA persona con
// el mensaje ya escrito, y Alain solo tiene que darle a enviar.
//
// Mismo criterio que arriba: el texto se guarda en claro y se codifica al
// construir la URL. [nombre] y [cuando] se rellenan con los datos de la
// reserva.

const ZONA = "Europe/Madrid";

export const WA_MENSAJE_CONFIRMACION = `Buenas, [nombre].
He visto tu reserva: queda confirmada la Hoja de Ruta [cuando].
Es una videollamada de una hora.

Para que la aprovechemos entera, necesito dos cosas tuyas antes:

1. Este cuestionario de salud, desde el móvil: https://entrenatzaile.alainzulaika.com/parq
Son cinco minutos. Me dice qué puedo pedirte sin riesgo y es lo que me permite proponerte ejercicios concretos en vez de generalidades.

2. Tu peso en ayunas, cualquier mañana antes de la llamada. Me lo mandas por aquí.

Si llegan antes, la hora entera va a tu plan. Si no, se nos va el tiempo en ello.
Diez minutos antes te mandaré por aquí el enlace de la videollamada.`;

/** "2026-10-28T16:00:00Z" -> "el martes 28 de octubre a las 18:00". */
export function cuandoParaWhatsApp(huecoIso: string): string {
  const fecha = new Date(huecoIso);
  const dia = fecha
    .toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA })
    .replace(",", "");
  const hora = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: ZONA });
  return `el ${dia} a las ${hora}`;
}

/**
 * El teléfono tal como lo escribió el lead -> el formato de wa.me (solo
 * cifras, con prefijo de país). Los de 9 cifras que empiezan por 6, 7, 8 o 9
 * son españoles y se les pone el 34. Lo que no se sabe interpretar devuelve
 * null, y el enlace abre WhatsApp sin destinatario para elegirlo a mano.
 */
export function telefonoParaWhatsApp(telefono: string | null | undefined): string | null {
  const bruto = (telefono ?? "").trim();
  let cifras = bruto.replace(/\D/g, "");
  if (cifras.startsWith("00")) cifras = cifras.slice(2);
  if (/^[6789]\d{8}$/.test(cifras)) return `34${cifras}`;
  // Con prefijo de país: 10 a 15 cifras (E.164).
  if (cifras.length >= 10 && cifras.length <= 15) return cifras;
  return null;
}

export function enlaceWaConfirmacion(args: { telefono: string | null; nombre: string | null; hueco: string }): {
  url: string;
  conNumero: boolean;
} {
  const nombre = (args.nombre ?? "").trim().split(/\s+/)[0] ?? "";
  const texto = WA_MENSAJE_CONFIRMACION
    .replace("Buenas, [nombre].", nombre ? `Buenas, ${nombre}.` : "Buenas.")
    .replace("[cuando]", cuandoParaWhatsApp(args.hueco));
  const numero = telefonoParaWhatsApp(args.telefono);
  return {
    url: `https://wa.me/${numero ?? ""}?text=${encodeURIComponent(texto)}`,
    conNumero: numero !== null,
  };
}

/** El botón, en HTML de correo, para los avisos internos. */
export function botonWaConfirmacionHtml(args: { telefono: string | null; nombre: string | null; hueco: string }): string {
  const { url, conNumero } = enlaceWaConfirmacion(args);
  const nota = conNumero
    ? ""
    : `<p style="margin:0.5rem 0 0 0;font-size:0.8rem;color:#b45309;">No he sabido leer su teléfono: el botón abre WhatsApp con el mensaje escrito y eliges tú el contacto.</p>`;
  return `
    <div style="margin:1.2rem 0 0.4rem 0;">
      <a href="${url}" style="display:inline-block;background:#25D366;color:#ffffff;font-family:Arial,sans-serif;font-weight:bold;font-size:0.95rem;padding:0.7rem 1.2rem;border-radius:6px;text-decoration:none;">Abrir WhatsApp con el mensaje de confirmación</a>
      ${nota}
    </div>
  `;
}
