// Copy de /hoja-de-ruta/capacidades.
//
// Es el MISMO servicio que /hoja-de-ruta y el mismo formulario: lo que cambia
// es a quién le habla. La otra entra por el dolor de espalda; esta, por la
// capacidad física que se pierde sin enterarse. Por eso la mitad de arriba es
// distinta y las tres secciones de abajo (los tres pasos, por qué me dedico a
// esto y el caso de Jorge) son literalmente las mismas: se importan de
// ../_content en vez de copiarse, para que no puedan quedar desfasadas.
//
// Aquí no hay versión gratuita ni token: siempre 90 €. La estructura sigue
// pidiendo las dos variantes porque la plantilla es común, así que las dos
// claves llevan el mismo texto.

import {
  HOJA_RUTA_BOTON,
  SECCION_JORGE,
  SECCION_POR_QUE_ME_DEDICO,
  SECCION_TRES_PASOS,
  type ContenidoHR,
  type PorVariante,
  type SeccionHR,
} from "../_content";

/** Esta página se pinta siempre en su versión de pago. */
function igualEnLasDos(texto: string): PorVariante<string> {
  return { ventana: texto, evergreen: texto };
}

const HERO: ContenidoHR["hero"] = {
  titulo: "Confías en un cuerpo que no es el que tienes.",
  subtitulo: "Y te puedes enterar aquí o dándote una hostia",
  // Sin "sin compromiso de seguir conmigo": esa promesa solo se hace en la
  // versión gratuita de /hoja-de-ruta.
  entradilla: igualEnLasDos(
    "Una hora por videollamada conmigo y te llevas por escrito tu Hoja de Ruta: en qué estado están de verdad tu fuerza y tu movilidad, qué tienes que trabajar primero y qué esperar en los próximos meses. Sin gimnasio, sin estar en forma."
  ),
  boton: HOJA_RUTA_BOTON,
  bulletPrecio: igualEnLasDos("Vale 90 €."),
  bullets: [
    "La recibes por escrito en 24-48 h, garantizado.",
    "Es tuya: la ejecutas solo, conmigo o con otro entrenador.",
  ],
  pieVisual: "Esto es una parte. La tuya tendrá unas 9 páginas, con tu nombre y tu caso.",
};

const SECCIONES: SeccionHR[] = [
  {
    titulo: "Esto ya lo has vivido.",
    parrafos: [
      {
        texto:
          "Estábamos de ruta en el monte y había que bajar un desnivel.\nNada extremo, la altura de una cadera.",
      },
      {
        texto:
          "Yo salté.\nA mi cuñada le dije que se sentara en el borde y bajara desde ahí.\nNo lo hizo. Confiaba en sus piernas.\nDio un paso, los cuádriceps le fallaron, y la agarré antes de que terminara aplastada por su propio peso en el suelo.",
      },
      { texto: "No pasó nada.\nUn susto y unas agujetas considerables." },
      { texto: "Lo grave no es la caída. Es que no se la esperaba." },
      {
        destacado: "Nada de lo que haces en tu día a día te avisa.",
        texto:
          "Andar, sentarte, levantarte, subir un tramo de escaleras. Nada de eso te pide el máximo.\nAsí que vas perdiendo fuerza, agilidad y equilibrio sin enterarte, de forma silenciosa.",
      },
      {
        texto:
          "Y la idea que tienes de lo que puedes hacer sigue siendo la de hace cinco o diez años.\nNo la has actualizado porque no ha hecho falta.",
      },
      {
        texto:
          "Hasta el día en que sí hace falta.\nDesnivel, te vencen las piernas.\nTropezón inesperado, adiós menisco.\nAcelerón para coger al bus, rotura del tendón de Aquiles.\nUna caja pesada al cajón más alto, tirón y lumbago.\nY te enteras de golpe.",
      },
      {
        destacado: "Y después pasa esto.",
        texto:
          "Ella lo resumió semanas después en una frase: «No vuelvo a hacer esa ruta.»\nParece prudente. Es lo contrario de lo que hace falta.",
      },
      {
        texto:
          "Porque cada vez que algo no sale, lo tachas de la lista.\nLa lista se acorta sola.\nPrimero esa ruta. Luego una más fácil. Luego levantar al nieto «con cuidado». Luego las escaleras.\nSin que pase de un día para otro.\nMuchos terminan como mi abuela: «Sé que moverme me viene bien, pero donde mejor estoy es en la cama.»",
      },
      {
        destacado: "Pero lo ideal sería lo siguiente.",
        texto: "Hacerse la pregunta que sí sirve: «¿Por qué mi cuerpo no ha aguantado?»",
      },
      {
        texto:
          "Y para responderla hay que hacer algo que casi nadie hace: saber dónde estás hoy.\nNo hace diez años.\nAhora.",
      },
      { texto: "De esa parte me ocupo yo." },
    ],
  },

  {
    titulo: "Antes de seguir, lo que no te voy a prometer.",
    parrafos: [
      {
        texto:
          "No te voy a asegurar que vas a volver a estar como a los treinta.\nNi que no te vas a lesionar nunca.\nNadie serio puede decirte eso, y quien lo haga te está engañando con algún objetivo maligno.",
      },
      {
        texto:
          "No te voy a diagnosticar, ni recetar, ni interpretar resonancias.\nNo soy médico ni fisioterapeuta.",
      },
      {
        texto:
          "Entreno a gente con hernias, con ciática, con escoliosis y con años de dolor.\nTrabajo con lesiones, no las trato.",
      },
    ],
  },

  {
    titulo: "Lo que sí hago es darte tu Hoja de Ruta.",
    parrafos: [
      { texto: "Un documento escrito para ti, después de haberte visto moverte." },
      { texto: "Incluye:" },
      {
        destacado: "En qué estado está tu cuerpo hoy.",
        texto: "Para que puedas vivir sin miedo y reduciendo los riesgos.",
      },
      {
        destacado: "Qué trabajar primero y por qué.",
        texto: "Te quitas de listas genéricas de ejercicios de internet.",
      },
      {
        destacado: "Qué puedes conseguir en 3 meses.",
        texto: "Expectativas realistas y una meta que perseguir.",
      },
      {
        texto:
          "Eso es lo que compras aquí.\nProceso, criterio y capacidad.\nNo una promesa de que nunca te va a pasar nada.",
      },
      {
        texto:
          "Y si tu caso es de espalda —que es lo que más me llega— te enviaré también un protocolo de nueve páginas para cuando el dolor vuelva.",
      },
      { texto: "Recibes todo por escrito en 24 o 48 horas después de la llamada.\nY es tuya." },
    ],
    // Botón solo, sin check: el precio ya está dicho en el hero.
    cta: {},
  },

  SECCION_TRES_PASOS,
  SECCION_POR_QUE_ME_DEDICO,
  SECCION_JORGE,
];

const CIERRE: ContenidoHR["cierre"] = {
  titulo: "Mejor enterarte en una hora conmigo que dándote una hostia.",
  parrafos: [
    {
      texto:
        "Una hora por videollamada.\nTu Hoja de Ruta por escrito en 24 o 48 horas.\nEl protocolo por si el dolor vuelve, si tu caso es de espalda.",
    },
  ],
  precio: igualEnLasDos("90 €"),
  formularioTitulo: "Elige tu hueco",
  telefonoPista: "Para confirmarte y mandarte el enlace de la llamada.",
  privacidad: "Política de privacidad",
  boton: HOJA_RUTA_BOTON,
  enviando: "Guardando…",
  cierre: igualEnLasDos("Te confirmo por WhatsApp en cuanto reserves.\nNada más. No hay permanencia."),
};

export const CAPACIDADES_CONTENIDO: ContenidoHR = {
  hero: HERO,
  secciones: SECCIONES,
  cierre: CIERRE,
};

export const CAPACIDADES_HERO = HERO;
