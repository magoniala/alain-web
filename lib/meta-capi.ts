import { createHash } from "node:crypto";

// Envío de conversiones a Meta desde el servidor (Conversions API).
//
// Por qué desde el servidor y no solo con el píxel del navegador: Safari,
// iOS y los bloqueadores se cargan entre un 20% y un 40% de los eventos del
// píxel. Desde aquí no hay nada que bloquear.
//
// Los dos caminos mandan el MISMO evento, así que van con un `eventId`
// común. Meta usa ese identificador para entender que es uno solo. Sin él,
// contaría cada conversión dos veces y las cifras no valdrían nada.

const PIXEL_ID = process.env.META_PIXEL_ID;
const TOKEN = process.env.META_CAPI_TOKEN;
// Versión de la Graph API. Conviene comprobar en el Administrador de Eventos
// cuál es la vigente y actualizarla aquí cuando Meta retire versiones viejas.
const VERSION = process.env.META_API_VERSION ?? "v21.0";
// Código de prueba del Administrador de eventos. Mientras esté puesto, los
// envíos desde el servidor aparecen en la pestaña "Probar eventos" y se
// pueden comparar con los del navegador para confirmar que se deduplican.
// Se quita cuando termina la comprobación: si se queda, Meta trata esos
// eventos como de prueba y NO cuentan como conversiones reales.
const TEST_CODE = process.env.META_TEST_EVENT_CODE;

/** Sin credenciales configuradas, todo esto se queda quieto y no rompe nada. */
export function metaConfigurado() {
  return Boolean(PIXEL_ID && TOKEN);
}

// Meta exige los datos personales cifrados (SHA-256), en minúsculas y sin
// espacios. Nunca viaja el email en claro.
function hash(valor: string) {
  return createHash("sha256").update(valor.trim().toLowerCase()).digest("hex");
}

// El teléfono se cifra solo con dígitos y prefijo de país, sin símbolos: es
// como Meta lo normaliza al otro lado, y si no coincide no casa con nadie.
function hashTelefono(telefono: string) {
  let digitos = telefono.replace(/\D/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.length === 9) digitos = `34${digitos}`;
  return digitos ? createHash("sha256").update(digitos).digest("hex") : undefined;
}

export interface EventoMeta {
  /** Nombre del evento: "Lead", "Schedule", "ViewContent"… */
  nombre: string;
  /** El mismo que use el navegador, para que Meta no lo cuente dos veces. */
  eventId: string;
  /** URL donde ocurrió. */
  url: string;
  email?: string;
  telefono?: string;
  /** Cookies del píxel, si las hay: mejoran mucho la coincidencia. */
  fbp?: string;
  fbc?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Manda un evento a Meta. No lanza nunca: una conversión no registrada es un
 * problema de medición, pero reventar aquí dejaría al lead sin su respuesta.
 *
 * Devuelve true solo si Meta lo aceptó, para poder registrarlo.
 */
export async function enviarEventoMeta(evento: EventoMeta): Promise<boolean> {
  if (!metaConfigurado()) return false;

  const userData: Record<string, unknown> = {};
  if (evento.email) userData.em = [hash(evento.email)];
  const tel = evento.telefono ? hashTelefono(evento.telefono) : undefined;
  if (tel) userData.ph = [tel];
  if (evento.fbp) userData.fbp = evento.fbp;
  if (evento.fbc) userData.fbc = evento.fbc;
  if (evento.ip) userData.client_ip_address = evento.ip;
  if (evento.userAgent) userData.client_user_agent = evento.userAgent;

  try {
    const res = await fetch(`https://graph.facebook.com/${VERSION}/${PIXEL_ID}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: TOKEN,
        ...(TEST_CODE ? { test_event_code: TEST_CODE } : {}),
        data: [
          {
            event_name: evento.nombre,
            event_time: Math.floor(Date.now() / 1000),
            event_id: evento.eventId,
            event_source_url: evento.url,
            action_source: "website",
            user_data: userData,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("meta-capi: Meta rechazó el evento", evento.nombre, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("meta-capi: no se pudo enviar el evento", evento.nombre, err);
    return false;
  }
}

/** Lee de la petición lo que mejora la coincidencia: cookies del píxel, IP y navegador. */
export function datosDeLaPeticion(req: Request) {
  const cookies = req.headers.get("cookie") ?? "";
  const leer = (nombre: string) => cookies.match(new RegExp(`${nombre}=([^;]+)`))?.[1];
  return {
    fbp: leer("_fbp"),
    fbc: leer("_fbc"),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim(),
    userAgent: req.headers.get("user-agent") ?? undefined,
  };
}

/**
 * ¿Ha aceptado esta persona el seguimiento?
 *
 * CAPI no esquiva el consentimiento: son los mismos datos personales por otro
 * camino. Si no hay aceptación, no se manda nada.
 */
export function haAceptadoSeguimiento(req: Request): boolean {
  return /(?:^|;\s*)consentimiento=aceptado/.test(req.headers.get("cookie") ?? "");
}
