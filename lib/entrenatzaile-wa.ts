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
