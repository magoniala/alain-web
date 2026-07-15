import type { Variante } from "@/lib/entrenatzaile-variantes";

export type EngancheBloque =
  | { tipo: "lines"; lineas: string[] }
  | { tipo: "emphasis"; texto: string }
  | { tipo: "prose"; texto: string };

export interface GuiasContenido {
  heroTitulo: string;
  heroSubtitulo: string;
  enganche: EngancheBloque[];
  guiaPrincipalTitulo: string;
  guiaPrincipalBullets: string[];
}

export const GUIAS_CONTENIDO: Record<Variante, GuiasContenido> = {
  lumbar: {
    heroTitulo: "Por qué tu espalda siempre vuelve a fallar",
    heroSubtitulo:
      "La guía honesta sobre el dolor lumbar recurrente: por qué se cura solo, por qué recae, y qué hacer para romper el ciclo. Sin dramas y sin venderte milagros.",
    enganche: [
      {
        tipo: "lines",
        lineas: [
          "Si has tenido dolor lumbar alguna vez, conoces el patrón: te da un tirón, lo pasas fatal una o dos semanas, mejora, vuelves a tu vida… y meses después, otra vez. Y otra.",
        ],
      },
      { tipo: "prose", texto: "No es mala suerte. Es lo normal." },
      {
        tipo: "emphasis",
        texto: "El 69% de las personas con un episodio de dolor lumbar vuelven a tenerlo dentro del año. Siete de cada diez.",
      },
      {
        tipo: "prose",
        texto:
          "El problema nunca fue el tirón de esta semana —ese se pasa casi solo—. El problema es el ciclo: tirón, mejora, debilidad, tirón. Y cada vuelta refuerza una idea peligrosa: “tengo la espalda mal, mejor no muevo mucho”.",
      },
      {
        tipo: "prose",
        texto: "He preparado una guía que explica, sin humo, por qué pasa esto y qué es lo que de verdad rompe el ciclo. Lo que dice la ciencia, contado en cristiano.",
      },
    ],
    guiaPrincipalTitulo: "Por qué tu espalda siempre vuelve a fallar",
    guiaPrincipalBullets: [
      "Por qué el brote agudo se cura casi solo (y por qué eso no es lo que importa).",
      "La trampa del miedo: cómo protegerte de más te debilita y te hace recaer.",
      "Qué rompe el ciclo de verdad: recuperar la confianza en el movimiento y construir fuerza de forma sostenida.",
      "Los 3 mitos que te están costando (reposo, resonancias, paracetamol).",
    ],
  },

  ereccion: {
    heroTitulo: "Lo que nadie te cuenta sobre la erección después de los 50",
    heroSubtitulo:
      "Una guía honesta sobre qué cambia de verdad, qué puedes mejorar, y qué merece que vayas al médico. Sin dramas y sin milagros.",
    enganche: [
      {
        tipo: "lines",
        lineas: ["Si has empezado a notar que las cosas no funcionan igual que antes, lo primero que deberías saber es esto:"],
      },
      {
        tipo: "emphasis",
        texto: "No estás roto, no estás solo, y buena parte de lo que notas se puede trabajar.",
      },
      {
        tipo: "lines",
        lineas: [
          "Casi ningún hombre de tu edad habla de esto en voz alta.",
          "Muchos lo viven en silencio, convencidos de que es el final de algo.",
          "No lo es.",
          "Pero como nadie lo cuenta, cada uno se lo come solo y saca sus propias conclusiones —normalmente las peores.",
        ],
      },
      {
        tipo: "prose",
        texto:
          "He preparado una guía para romper ese silencio con información seria: qué es de verdad la edad y qué no, qué puedes mejorar (y cuánto), y una cosa que casi nadie te cuenta y que conviene que sepas. Lo que dice la ciencia, contado en cristiano.",
      },
    ],
    guiaPrincipalTitulo: "Lo que nadie te cuenta sobre la erección después de los 50",
    guiaPrincipalBullets: [
      "Las dos cosas distintas que casi todo el mundo mezcla (y por qué distinguirlas lo cambia todo).",
      "Qué cambia de verdad con la edad y qué no vale la pena pelear.",
      "Qué sí puedes mejorar con ejercicio —y cuánto— sin suplementos ni humo.",
      "Lo más importante: por qué esto puede ser un aviso temprano de tu corazón, y qué hacer.",
    ],
  },

  rodilla: {
    heroTitulo: "Correr no te destroza las rodillas",
    heroSubtitulo:
      "Una guía honesta sobre el dolor de rodilla en personas activas: lo que de verdad lo causa —y tiene solución— sin dejar de moverte.",
    enganche: [
      {
        tipo: "lines",
        lineas: [
          "“Como sigas corriendo te vas a cargar las rodillas.” Lo habrás oído mil veces.",
          "Puede que lo hayas pensado tú mismo, la última vez que la rodilla te dio guerra tras una salida al monte.",
        ],
      },
      {
        tipo: "lines",
        lineas: [
          "Es uno de los mitos más extendidos y más falsos que existen sobre el cuerpo.",
          "Y creértelo tiene un coste: te frena, te asusta y te empuja al sofá, que es justo lo peor que puedes hacer.",
        ],
      },
      {
        tipo: "emphasis",
        texto:
          "Cuando se compara a corredores con no corredores —más de 14.000 personas—, los que NO corren tienen más dolor de rodilla y casi el doble de riesgo de acabar necesitando una prótesis.",
      },
      {
        tipo: "prose",
        texto:
          "He preparado una guía que explica qué lesiona de verdad tu rodilla (no es correr), por qué te duele, y cómo seguir moviéndote sin miedo, construyendo una rodilla que aguante lo que le pides. Lo que dice la ciencia, sin humo.",
      },
    ],
    guiaPrincipalTitulo: "Correr no te destroza las rodillas",
    guiaPrincipalBullets: [
      "El mito contra los números: qué pasa de verdad cuando comparas a quien corre y quien no.",
      "Entonces, ¿por qué me duele? La cuenta bancaria de carga de tu rodilla.",
      "Por qué parar del todo es el peor error, y qué hacer en su lugar.",
      "Las claves que sí respalda la ciencia: fuerza, progresión y las bajadas de monte.",
    ],
  },
};
