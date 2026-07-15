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
