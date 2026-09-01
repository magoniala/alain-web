// Piezas de correo de las landings de Tirada 02.

const BASE_ENTRENATZAILE = "https://entrenatzaile.alainzulaika.com";

// Convierte el teléfono tal y como lo escribe el lead en un enlace de
// WhatsApp. La gente lo escribe de mil maneras (con espacios, con guiones,
// con +34, con 0034 o sin nada) y wa.me solo acepta dígitos con prefijo de
// país. Devuelve null si no hay forma de interpretarlo, para no meter en el
// aviso un enlace que lleve a ninguna parte.
export function enlaceWhatsapp(telefono: string): string | null {
  let digitos = telefono.replace(/\D/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.length === 9) return `https://wa.me/34${digitos}`; // número español sin prefijo
  if (digitos.length >= 11 && digitos.length <= 15) return `https://wa.me/${digitos}`; // ya trae prefijo
  return null;
}

// ---------------------------------------------------------------------------
// Aviso a quien empezó a reservar la Hoja de Ruta y no llegó a elegir hueco.
// Sale una sola vez, 1 h después, desde procesarReservasAbandonadas() en
// /api/newsletter/cron.
// ---------------------------------------------------------------------------

export const MAIL_ABANDONO_ASUNTO = "Te quedaste a medias con tu Hoja de Ruta";

/**
 * Valor del marcador {{hoja_ruta}}: el enlace para terminar la reserva.
 *
 * Con token, lleva a la versión gratuita de esa persona; sin él, a la de
 * pago. Se le pasa ya resuelto para que quien escribe el correo en el panel
 * no tenga que decidir a cuál mandar a cada uno: pone {{hoja_ruta}} y ya.
 */
export function enlaceHojaDeRuta(token: string | null): string {
  const url = new URL(`${BASE_ENTRENATZAILE}/hoja-de-ruta`);
  url.searchParams.set("utm_source", "abandono");
  url.searchParams.set("utm_medium", "email");
  url.searchParams.set("utm_campaign", "espalda_t02");
  if (token) {
    url.searchParams.set("ventana", "1");
    url.searchParams.set("t", token);
  }
  return url.toString();
}

// ---------------------------------------------------------------------------
// Confirmación al lead en cuanto reserva su hueco. La landing le promete que
// Alain le escribe por WhatsApp, pero conviene que le quede también por
// escrito el día y la hora, que es lo que se olvida.
//
// Cambia según la versión que vio: en la ventana de bienvenida la llamada es
// gratis y el hueco queda cogido sin más, mientras que en la evergreen hay
// que pagarla, así que el hueco solo queda APARTADO hasta que llegue el pago.
// ---------------------------------------------------------------------------

const PAGO_VALORACION_URL = "https://buy.stripe.com/7sY9AS9iBad8g3ef6F7bW00";

export function mailReservaAsunto(variante: string | null): string {
  return variante === "ventana"
    ? "Tu Hoja de Ruta: hueco reservado (falta un paso)"
    : "Tu Hoja de Ruta: hueco apartado (falta un paso)";
}

export function mailReservaCuerpo(nombre: string | null, cuando: string, variante: string | null): string {
  const p = "margin:0 0 1.6rem 0;";
  const saludo = nombre ? `Hola, ${nombre.split(" ")[0]}.` : "Hola.";
  const videollamada = `<p style="${p}">Es una videollamada de una hora. No necesitas gimnasio, ni material, ni estar en forma: solo un sitio donde puedas moverte un poco delante de la cámara.</p>`;

  if (variante !== "ventana") {
    return `
    <p style="${p}">${saludo}</p>
    <p style="${p}">Te he apartado este hueco:</p>
    <p style="${p}"><strong>${cuando}</strong></p>
    ${videollamada}
    <p style="${p}">Para dejarlo confirmado, solo queda reservar la plaza con el pago (90€):</p>
    <p style="${p}"><a href="${PAGO_VALORACION_URL}" style="color:#2a9d8f;">Pagar la valoración y confirmar mi hueco</a></p>
    <p style="${p}">Te guardo el hueco 24 horas.<br>Si en ese plazo no está el pago, lo libero para dejarlo disponible en el calendario.</p>
    <p style="${p}">En cuanto lo tenga, te confirmo por WhatsApp y te paso el enlace de la videollamada.</p>
    <p style="${p}">Si te surge cualquier duda o no puedes con esa fecha, respóndeme a este correo y lo vemos sin problema.</p>
    <p style="margin:0;">Alain</p>
  `;
  }

  return `
    <p style="${p}">${saludo}</p>
    <p style="${p}">Tu hueco está cogido:</p>
    <p style="${p}"><strong>${cuando}</strong></p>
    ${videollamada}
    <p style="${p}">Te escribo por WhatsApp para confirmarte y mandarte el enlace.</p>
    <p style="${p}">Si te surge algo y no puedes, respóndeme a este correo y lo cambiamos sin problema.</p>
    <p style="margin:0;">Alain</p>
  `;
}

export function mailAbandonoCuerpo(nombre: string | null, variante: string | null): string {
  const p = "margin:0 0 1.6rem 0;";
  // Enlace limpio siempre. Quien lo llama le pasa después el correo por
  // personalizarEnlacesHojaDeRuta(), que le añade el token si esa persona
  // sigue dentro de su ventana. Poner "?ventana=1" a mano aquí no serviría:
  // desde el token de ventana, ese parámetro por sí solo ya no regala nada.
  const enlace = `${BASE_ENTRENATZAILE}/hoja-de-ruta`;
  const saludo = nombre ? `Hola, ${nombre.split(" ")[0]}.` : "Hola.";

  const lineaVentana =
    variante === "ventana"
      ? `<p style="${p}">Sigues dentro de tus primeros ocho días, así que no la pagas.</p>`
      : "";

  return `
    <p style="${p}">${saludo}</p>
    <p style="${p}">Has empezado a reservar tu Hoja de Ruta, pero te has quedado sin elegir fecha y hora exacta. Se te cruzaría algo, o no te encajaba ninguna de las horas.</p>
    <p style="${p}">Si fue lo primero, lo puedes retomar aquí: <a href="${enlace}" style="color:#2a9d8f;">elegir mi hueco</a>.</p>
    <p style="${p}">Si fue lo segundo, respóndeme a este correo y dime qué días te vienen bien. Lo cuadramos.</p>
    ${lineaVentana}
    <p style="margin:0;">Alain</p>
  `;
}
