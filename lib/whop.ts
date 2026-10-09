// Eventos de conversión al píxel de Whop (cuenta biz_pvD09VuWBli5OP).
//
// El snippet del layout (app/layout.tsx) define window.whop con una cola
// propia: track() apila la llamada y s.js la vacía cuando termina de cargar.
// Eso significa que desde aquí se puede llamar en cualquier momento —al
// montar, en un submit, antes de navegar— sin esperar a que cargue nada y
// sin perder eventos por llegar temprano.
//
// Lo único que hay que vigilar es lo contrario: que el píxel NO esté. Con un
// bloqueador de anuncios, window.whop no existe, y una excepción aquí
// rompería el formulario que la llamó. De ahí el guardia y el try/catch:
// medir nunca puede impedir convertir.

// Los nombres estándar del catálogo de Whop. Un evento propio se pasa como
// string suelto (whop.track admite nombres libres), pero los estándar van
// tipados para que un typo no se descubra en el panel tres días después.
export type EventoWhop =
  | "lead"
  | "schedule"
  | "submit_application"
  | "contact"
  | "complete_registration"
  | "view_content"
  | "add_to_cart"
  | "purchase";

// Parámetros opcionales. Los datos de contacto van en claro a propósito: la
// documentación de Whop avisa de que un email hasheado se descarta por no
// ser una dirección válida.
export type DatosWhop = {
  value?: number;
  currency?: string;
  // Qué se ha visto o añadido al carrito. Lo usan las landings para
  // distinguir productos dentro de un mismo evento estándar.
  content_name?: string;
  // Paso dentro de un evento propio: lo manda el test de /otra-vez-lumbago
  // en cada `quiz_step`. Va aquí y no con un index signature porque abrir el
  // tipo a claves libres dejaría pasar los typos que esto quiere cazar.
  step?: string;
  // Clave de deduplicación. Whop cuenta una sola vez cada par
  // (nombre de evento, event_id), así que un reintento, un F5 o el mismo
  // evento disparado desde dos sitios colapsan en uno.
  event_id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  phone?: string;
  external_id?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

declare global {
  interface Window {
    whop?: {
      track: (evento: string, datos?: DatosWhop) => void;
    };
  }
}

export function whopTrack(evento: EventoWhop | string, datos?: DatosWhop) {
  if (typeof window === "undefined") return;
  try {
    window.whop?.track(evento, datos);
  } catch {
    // Un fallo midiendo no es un fallo del formulario.
  }
}
