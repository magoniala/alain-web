// Cliente de Stripe para el cobro de la Hoja de Ruta.
//
// SERVIDOR. No importar desde un componente de cliente: aquí vive la clave
// secreta.
//
// Perezoso a propósito, igual que el de Mailjet en lib/email-ses.ts y el de
// Supabase en lib/entrenatzaile-ventana.ts. Creado al importar, un despliegue
// sin STRIPE_SECRET_KEY reventaría al cargar el módulo y tumbaría la ruta
// entera: el formulario de reserva devolvería un 500 de HTML sin JSON y el
// lead vería un fallo genérico cuando lo único roto es el cobro. Así el error
// ocurre dentro de la llamada, que va envuelta en try/catch, y la reserva se
// guarda igual.

import Stripe from "stripe";

let cliente: Stripe | null = null;

export function getStripe(): Stripe {
  // Antes que nada: si hay una clave de live donde no debe, aquí se para.
  // Quien llama ya tiene que estar preparado para que esto falle (un fallo
  // de red de Stripe es igual de posible), así que el error se propaga por el
  // camino que ya existe: hueco apartado, correo sin enlace y aviso marcado.
  const bloqueo = stripeBloqueado();
  if (bloqueo) throw new Error(`Stripe bloqueado: ${bloqueo}`);

  if (!cliente) {
    // Sin apiVersion a propósito: el SDK fija la suya al publicarse. Escribir
    // una a mano aquí obliga a tocar este fichero en cada actualización de la
    // librería y, si se queda vieja, los tipos dejan de describir lo que
    // devuelve la API de verdad.
    cliente = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return cliente;
}

// Se mira el prefijo de la propia clave y no una variable aparte: un
// STRIPE_MODO=test que alguien se deja puesto mentiría, la clave no.
function claveEsLive(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_");
}

/**
 * Motivo por el que NO se puede usar Stripe aquí, o null si se puede.
 *
 * Solo hay uno, y es el que de verdad importa: una clave de live fuera de
 * producción. Pasa por descuido —una variable de Vercel creada sin marcar el
 * entorno se aplica a los tres, y una preview con sk_live_ cobra de verdad—
 * y no hay ninguna razón legítima para que ocurra.
 *
 * VERCEL_ENV vale 'production' | 'preview' | 'development' y lo pone Vercel;
 * en local no existe. Es decir: en local y en preview, una clave de live
 * queda bloqueada, que es exactamente lo que se busca.
 *
 * Al revés no se bloquea nada: una clave de test en producción no cobra a
 * nadie ni manda enlaces reales. Sale mal, pero sale mal por el lado seguro,
 * y bloquearlo dejaría la web sin reservas por una variable mal puesta.
 */
export function stripeBloqueado(): string | null {
  if (!claveEsLive()) return null;
  if (process.env.VERCEL_ENV === "production") return null;
  return `clave sk_live_ en un entorno que no es producción (VERCEL_ENV=${process.env.VERCEL_ENV ?? "sin definir"})`;
}

/**
 * ¿Estamos cobrando de verdad?
 *
 * Lo usa el enlace de pago de respaldo: el Payment Link escrito en
 * lib/entrenatzaile-mails.ts es de live, así que durante las pruebas no puede
 * salir en ningún correo.
 *
 * Va atado a stripeBloqueado() a propósito. Si solo mirase el prefijo de la
 * clave, una preview con sk_live_ tendría a getStripe() reventando (bien) y
 * a este devolviendo true (mal): no se crearía la sesión de Checkout y el
 * correo se caería justo al Payment Link real. El agujero que este guardia
 * viene a tapar se abriría por el respaldo.
 */
export function stripeEsLive(): boolean {
  return claveEsLive() && stripeBloqueado() === null;
}

/** Precio de la Hoja de Ruta, en céntimos. Solo para cuadrar lo que cobra
 *  Stripe con lo que promete el copy; el importe real lo pone el Price. */
export const PRECIO_HOJA_RUTA_CENT = 9000;
