// Embudo de las landings: qué pasos completa una sesión, y nada más.
//
// La regla dura del formulario de /espalda vale también aquí: lo que la
// persona escribe no sale nunca de su tabla. De un evento solo se guarda
// que el paso ocurrió.

// Lista cerrada. El servidor rechaza cualquier nombre que no esté aquí:
// es lo que impide que por este endpoint entre texto arbitrario.
export const EVENTOS_EMBUDO = [
  "page_view",
  "time_3s",
  "time_10s",
  "time_30s",
  "hero_cta_click",
  "form_visible",
  "form_open",
  "form_start",
  "q1_done",
  "q2_done",
  "q3_done",
  "datos_done",
  "perfil_done",
  "consent_done",
  "submit_ok",
  "submit_error",
  "hoja_ruta_click",
] as const;

export type EventoEmbudo = (typeof EVENTOS_EMBUDO)[number];

export function esEventoEmbudo(v: unknown): v is EventoEmbudo {
  return typeof v === "string" && (EVENTOS_EMBUDO as readonly string[]).includes(v);
}

// Los pasos del embudo en orden, con su etiqueta. submit_error queda fuera
// a propósito: no es un paso, es una salida lateral.
export const PASOS_EMBUDO: { clave: EventoEmbudo; etiqueta: string }[] = [
  { clave: "page_view", etiqueta: "Entran a la página" },
  // Los tres de tiempo van aquí, antes de que el formulario entre en juego:
  // separan "no les convence" de "no llegaron ni a leer". Cuentan solo el
  // tiempo con la pestaña delante, así que una pestaña abierta y olvidada no
  // suma.
  { clave: "time_3s", etiqueta: "Siguen a los 3 s" },
  { clave: "time_10s", etiqueta: "Siguen a los 10 s" },
  { clave: "time_30s", etiqueta: "Siguen a los 30 s" },
  { clave: "hero_cta_click", etiqueta: "Pulsan el botón de arriba" },
  { clave: "form_visible", etiqueta: "Ven el formulario" },
  { clave: "form_open", etiqueta: "Pulsan «Empezar»" },
  { clave: "form_start", etiqueta: "Tocan un campo" },
  { clave: "q1_done", etiqueta: "Pregunta 1" },
  { clave: "q2_done", etiqueta: "Pregunta 2" },
  { clave: "q3_done", etiqueta: "Pregunta 3" },
  { clave: "datos_done", etiqueta: "Nombre, email y teléfono" },
  { clave: "perfil_done", etiqueta: "Edad y género" },
  { clave: "consent_done", etiqueta: "Marcan el permiso" },
  { clave: "submit_ok", etiqueta: "Envían" },
  // Ocurre ya en /gracias, pero es la misma sesión: la lleva la URL a la que
  // se redirige después de enviar.
  { clave: "hoja_ruta_click", etiqueta: "Van a la Hoja de Ruta" },
];

// Filtro anti-bot mínimo: descarta user-agents evidentes de crawlers,
// monitores de uptime, previsualizadores de enlaces y clientes HTTP de
// scripts. No busca precisión perfecta, solo quitar el ruido obvio.
export const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|monitor|pingdom|uptime|curl|wget|python-requests|headlesschrome|phantom|ahrefs|semrush|mj12bot|dotbot|petalbot|bytespider|censys|scan|go-http-client|node-fetch|axios|okhttp/i;

// Móvil o escritorio, que es la única distinción que cambia decisiones.
// El iPad reciente miente y dice ser un Mac: sin client hints no hay forma
// de distinguirlo, y no compensa pedirlos solo para esto.
export function dispositivoDeUA(ua: string): "movil" | "escritorio" {
  return /android|iphone|ipod|ipad|iemobile|opera mini|mobile|silk|blackberry/i.test(ua)
    ? "movil"
    : "escritorio";
}

// El orden importa: casi todos los navegadores mienten diciendo también
// "Chrome" o "Safari". Los de dentro de una app van primero porque son
// justo los que trae el tráfico de Meta Ads, y son los que más rompen.
export function navegadorDeUA(ua: string): string {
  if (/instagram/i.test(ua)) return "Instagram (in-app)";
  if (/fban|fbav|fb_iab|fbios/i.test(ua)) return "Facebook (in-app)";
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/samsungbrowser/i.test(ua)) return "Samsung";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/chrome|crios|chromium/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "otro";
}
