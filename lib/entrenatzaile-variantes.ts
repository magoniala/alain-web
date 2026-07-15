import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export const VARIANTES = ["lumbar", "rodilla", "ereccion"] as const;
export type Variante = (typeof VARIANTES)[number];

// Etiqueta que se añade a los leads captados según qué guía protagoniza
// la landing en el momento del alta.
export const VARIANTE_TAG: Record<Variante, string> = {
  lumbar: "LUMBAR",
  rodilla: "RODILLA",
  ereccion: "ERECCIONES",
};

export const VARIANTE_LABEL: Record<Variante, string> = {
  lumbar: "Lumbar",
  rodilla: "Rodilla",
  ereccion: "Erecciones",
};

function isVariante(v: unknown): v is Variante {
  return typeof v === "string" && (VARIANTES as readonly string[]).includes(v);
}

export async function getVarianteActual(landing: string): Promise<Variante> {
  const { data } = await supabase
    .from("landing_config")
    .select("variante")
    .eq("landing", landing)
    .single();
  return isVariante(data?.variante) ? data.variante : "lumbar";
}

export async function setVarianteActual(landing: string, variante: Variante) {
  await supabase
    .from("landing_config")
    .upsert({ landing, variante, updated_at: new Date().toISOString() }, { onConflict: "landing" });
}

export interface GuiaArchivo {
  file: string;
  name: string;
}

// Título/descripción de cada guía en PDF, para las tarjetas "de regalo" en
// la landing (se buscan por nombre de archivo).
export const GUIA_INFO: Record<string, { titulo: string; desc: string }> = {
  "espalda.pdf": {
    titulo: "Por qué tu espalda siempre vuelve a fallar",
    desc: "Por qué el dolor lumbar recae una y otra vez, y qué rompe de verdad el ciclo.",
  },
  "ereccion-50.pdf": {
    titulo: "Lo que nadie te cuenta sobre la erección después de los 50",
    desc: "Qué cambia de verdad, qué puedes mejorar con ejercicio, y qué merece que vayas al médico.",
  },
  "correr-rodillas.pdf": {
    titulo: "Correr no te destroza las rodillas",
    desc: "Lo que de verdad lesiona tu rodilla (spoiler: no es correr) y cómo seguir moviéndote sin miedo.",
  },
  "ejercicio-espalda-bonus.pdf": {
    titulo: "El mejor ejercicio para tu espalda no es el que crees",
    desc: "Por qué el ejercicio sí funciona para el dolor de espalda persistente, pero no como te han contado.",
  },
};

// La guía protagonista de cada plantilla.
export const GUIA_PRINCIPAL: Record<Variante, GuiaArchivo> = {
  lumbar: { file: "espalda.pdf", name: "Por qué tu espalda siempre vuelve a fallar.pdf" },
  ereccion: { file: "ereccion-50.pdf", name: "Lo que nadie te cuenta sobre la erección después de los 50.pdf" },
  rodilla: { file: "correr-rodillas.pdf", name: "Correr no te destroza las rodillas.pdf" },
};

// Las 2 guías "de regalo" que se anuncian en la landing y se entregan
// siempre por email — deben coincidir en ambos sitios para no prometer
// algo que luego no se envía. Son siempre los otros dos temas del trío
// (espalda / erección / rodilla) que no sea el protagonista de turno.
export const GUIAS_ANUNCIADAS_EXTRA: Record<Variante, GuiaArchivo[]> = {
  lumbar: [
    { file: "ereccion-50.pdf", name: "Lo que nadie te cuenta sobre la erección después de los 50.pdf" },
    { file: "correr-rodillas.pdf", name: "Correr no te destroza las rodillas.pdf" },
  ],
  ereccion: [
    { file: "espalda.pdf", name: "Por qué tu espalda siempre vuelve a fallar.pdf" },
    { file: "correr-rodillas.pdf", name: "Correr no te destroza las rodillas.pdf" },
  ],
  rodilla: [
    { file: "espalda.pdf", name: "Por qué tu espalda siempre vuelve a fallar.pdf" },
    { file: "ereccion-50.pdf", name: "Lo que nadie te cuenta sobre la erección después de los 50.pdf" },
  ],
};

// Cuarto PDF que solo se entrega por email, sin anunciar en la landing
// ("3+1 inesperado"). Es siempre la segunda guía de espalda — solo
// repetiría tema si el protagonista fuera espalda, y aun así se mantiene
// (ya lo llevaba la variante original), así que es constante en las 3.
export const GUIA_SORPRESA: Record<Variante, GuiaArchivo | null> = {
  lumbar: { file: "ejercicio-espalda-bonus.pdf", name: "El mejor ejercicio para tu espalda no es el que crees.pdf" },
  ereccion: { file: "ejercicio-espalda-bonus.pdf", name: "El mejor ejercicio para tu espalda no es el que crees.pdf" },
  rodilla: { file: "ejercicio-espalda-bonus.pdf", name: "El mejor ejercicio para tu espalda no es el que crees.pdf" },
};
