// Textos literales del formulario de reserva de creadores.alainzulaika.com.
//
// Viven aquí, en el servidor, y no en el navegador: la página los renderiza
// desde este módulo y el endpoint los graba desde este mismo módulo. Así, lo
// que queda escrito en Supabase es exactamente lo que la persona leyó, sin
// fiarse de lo que mande el cliente. El navegador solo manda el booleano.
//
// Al cambiar cualquiera de estos textos, sube CONSENT_CREADORES_VERSION: las
// filas antiguas conservan su texto y su versión, que es justo lo que hace
// falta para poder demostrar qué aceptó cada persona y cuándo.

export const CONSENT_CREADORES_VERSION = "2026-09-15";

// ============================================================================
// Por qué este consentimiento no es el de la Hoja de Ruta
// ============================================================================
//
// Este texto NO es el de la Hoja de Ruta. El de allí consiente el tratamiento
// de datos de salud por el artículo 9.2.a del RGPD (categoría especial), y
// además incluye el alta en la newsletter. Aquí no aplica ninguna de las dos
// cosas:
//
//   · No hay datos de salud ni de estado físico. Lo que se recoge es un
//     nombre y un correo, y la llamada es una reunión de trabajo. Consentir
//     una categoría especial de datos que no se van a tratar no es "por si
//     acaso": es declarar un tratamiento que no existe.
//   · No hay alta en la newsletter. La casilla no la nombra, así que el
//     endpoint NO da de alta a nadie en newsletter_contactos. Si algún día se
//     quiere captar desde aquí, hay que añadir una segunda casilla, separada
//     y opcional, y cambiar este texto. No vale dar de alta en silencio.
//
// Lo que sí declara este texto, y conviene comprobar que es verdad:
//
//   Responsable    Alain Zulaika.
//   Datos          nombre y correo electrónico. Nada más.
//   Finalidad      concertar la reunión, recordarla y mantenerla.
//   Base jurídica  el consentimiento de la persona, y la ejecución de
//                  medidas precontractuales a petición suya.
//   Conservación   mientras haga falta para la reunión y después el tiempo
//                  que exijan las obligaciones legales.
//   Derechos       acceso, rectificación, supresión, oposición, limitación y
//                  portabilidad, escribiendo a info@alainzulaika.com.
//
// La página /privacidad ya recoge este tratamiento (apartados 2, 4 y 5,
// actualizados el 2026-09-15), así que el enlace de la casilla lleva a un
// sitio que sí lo explica. El correo para ejercer derechos es el mismo que
// figura allí: info@alainzulaika.com. Si se cambia en un sitio, hay que
// cambiarlo en el otro.
//
// Sobre grabar la reunión: se avisa de viva voz al empezar la videollamada,
// así que no se nombra aquí. Si algún día se grabara por defecto y sin
// avisar en el momento, habría que declararlo en este texto y pedirlo aparte.
// ============================================================================

export const CONSENT_CREADORES = {
  datos:
    "He leído y acepto la política de privacidad, y consiento que Alain Zulaika trate mi nombre y mi correo electrónico con la única finalidad de concertar esta reunión de trabajo, recordármela y mantener el contacto necesario para celebrarla. Puedo retirar este consentimiento y ejercer mis derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a info@alainzulaika.com.",
} as const;

// Aclaración bajo la casilla. No es un consentimiento —no hay nada que
// aceptar en ella— sino la contrapartida honesta de no nombrar la newsletter:
// que quede claro que reservar aquí no apunta a nadie a ninguna lista.
export const AVISO_SIN_NEWSLETTER =
  "Reservar aquí no te apunta a ninguna lista de correo. Tu email se usa solo para esta reunión.";
