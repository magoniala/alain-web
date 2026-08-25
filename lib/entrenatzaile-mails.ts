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

// ---------------------------------------------------------------------------
// Confirmación al lead en cuanto reserva su hueco. La landing le promete que
// Alain le escribe por WhatsApp, pero conviene que le quede también por
// escrito el día y la hora, que es lo que se olvida.
// ---------------------------------------------------------------------------

export const MAIL_RESERVA_ASUNTO = "Tu Hoja de Ruta: hueco reservado";

export function mailReservaCuerpo(nombre: string | null, cuando: string): string {
  const p = "margin:0 0 1.6rem 0;";
  const saludo = nombre ? `Hola, ${nombre.split(" ")[0]}.` : "Hola.";

  return `
    <p style="${p}">${saludo}</p>
    <p style="${p}">Tu hueco está cogido:</p>
    <p style="${p}"><strong>${cuando}</strong></p>
    <p style="${p}">Es una videollamada de una hora. No necesitas gimnasio, ni material, ni estar en forma: solo un sitio donde puedas moverte un poco delante de la cámara.</p>
    <p style="${p}">Te escribo por WhatsApp para confirmarte y mandarte el enlace.</p>
    <p style="${p}">Si te surge algo y no puedes, respóndeme a este correo y lo cambiamos sin problema.</p>
    <p style="margin:0;">Alain</p>
  `;
}

export function mailAbandonoCuerpo(nombre: string | null, variante: string | null): string {
  const p = "margin:0 0 1.6rem 0;";
  const enlace = variante === "ventana" ? `${BASE_ENTRENATZAILE}/hoja-de-ruta?ventana=1` : `${BASE_ENTRENATZAILE}/hoja-de-ruta`;
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
