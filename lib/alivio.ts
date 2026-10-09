/* ---------------------------------------------------------------------------
   Textos del lead magnet "Alivia tu lumbago hoy" (/alivio).

   Viven aquí y no en un _content.ts junto a la página porque el endpoint de
   alta (/api/entrenatzaile/alivio) también necesita el título para el asunto
   del correo, y una ruta de API no puede importar de la carpeta de la página.
   --------------------------------------------------------------------------- */

/* El PDF vive en el repo, junto a las demás guías de nutrición de leads, y de
   ahí salen las dos vías: va adjunto al correo de bienvenida y se sirve por
   /api/nurture-pdf/alivio para quien prefiera bajárselo en el momento. */
export const ALIVIO_PDF = {
  file: "alivio.pdf",
  slug: "alivio",
  nombre: "Alivia tu lumbago hoy.pdf",
};

/* Textos del desplegable que pide el correo. Es el único paso entre el botón
   y la guía, así que va corto a propósito: un campo y un botón. */
export const ALIVIO_FORMULARIO = {
  titulo: "¿A dónde te la mando?",
  entrada: "Dejas el correo y te llega el PDF. Gratis, sin tarjeta.",
  placeholder: "tu@email.com",
  boton: "Enviarme la guía",
  enviando: "Enviando…",
  letraPequena: "Te apuntas también a mi newsletter. Te das de baja en un clic.",
  listoTitulo: "Listo. Va para allá.",
  listoDescarga: "Descargarla ahora",
  listoSpam: "Si no te llega en unos minutos, mira en spam.",
};

export const ALIVIO_TEXTOS = {
  titulo: "Alivia tu lumbago hoy",

  hero: {
    eyebrow: "Guía gratis · 3 páginas",
    titular: "Alivia tu lumbago hoy. En casa, sin forzar.",
    entrada:
      "Guía rápida de Alain Zulaika: evalúa el tirón, desbloquea la cadera y extiende sin forzar. Tres páginas. Acceso inmediato al PDF.",
    cta: "Descargar la guía gratis",
    pie: "Gratis · Acceso inmediato · Sin gimnasio",
  },

  cifras: [
    { k: "3 páginas", v: "lo que ocupa entero. Se lee de una sentada." },
    { k: "3 pasos", v: "evalúa, desbloquea la cadera, extiende sin forzar." },
    { k: "0 €", v: "PDF gratis. Lo tienes en cuanto dejas el correo." },
  ],

  relato: {
    titular: "El tirón de esta tarde no espera a un protocolo de tres meses.",
    parrafos: [
      "Te ha dado. Te cuesta levantarte, sentarte, girarte. Buscas un vídeo, otro, y acabas más tenso de lo que empezaste.",
      "No es el momento de un plan de 32 páginas. Es el momento de no forzar.",
      "Esta guía es el primer paso: en tres páginas sabes si puedes moverte, cómo desbloquear la cadera y cómo extender sin empeorar el tirón. En casa, sin máquinas.",
      "Sin milagros. Sin “esto lo cura”. Un filtro corto y tres gestos para hoy.",
    ],
  },

  cita: "“Tres páginas para no forzar. El resto, si hace falta, ya vendrá.”",

  autor: {
    eyebrow: "Quién la escribe",
    nombre: "Alain Zulaika",
    texto:
      "Entrenador personal titulado. Llevo entrenando desde los 14 y más de 6 años como entrenador. Ayudo a personas de 45 a 65 a mantener fuerza, movilidad y autonomía. Esta guía es el primer paso: corta, directa, para el tirón de hoy. Sin humo.",
  },

  descarga: {
    eyebrow: "PDF gratis",
    precio: "0 €",
    precioNota: "acceso inmediato",
    subtitulo: "Dejas el correo y te llega el PDF.",
    incluye: [
      "Evalúa el tirón en un minuto",
      "Desbloquea la cadera sin forzar",
      "Extiende sin alargar el episodio",
      "Hecho para hacerlo en casa, ahora",
    ],
    boton: "Descargar la guía ahora",
    letraPequena: "Gratis. Sin tarjeta.",
  },

  preguntas: [
    {
      q: "¿Es de verdad gratis?",
      a: "Sí. Dejas el correo, te llega el PDF. No hay tarjeta ni prueba de pago.",
    },
    {
      q: "¿Sirve si me acaba de dar el tirón?",
      a: "Está escrita para ese momento. Primero evalúas, luego te mueves. Si el filtro dice parar, paras.",
    },
    {
      q: "¿Necesito gimnasio o material?",
      a: "No. Tres páginas y el salón de tu casa. Una silla, si la tienes a mano.",
    },
    {
      q: "¿Esto es el pack de recursos?",
      a: "No. Esta guía es el primer paso de hoy, y va dentro del pack. El pack es todo lo demás: el protocolo del día 1 al mes 3, los registros y la infografía, para no repetir el ciclo.",
    },
  ],

  cierre: "Tres páginas. Empieza por no forzar.",
};
