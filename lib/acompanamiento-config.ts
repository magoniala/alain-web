// Contador de plazas libres de /acompanamiento, editable desde /admin.
//
// Vive aparte de lib/acompanamiento.ts porque aquel lo importa también el
// formulario, en el navegador, y esto necesita la clave de servicio.

import { createClient } from "@supabase/supabase-js";

export const PLAZAS_OPCIONES = [2, 1, 0] as const;

// Una fila por tanda de plazas. Cuando se abran las siguientes, basta con
// cambiar esto y el copy de la página.
const TANDA = "noviembre-2026";

// Si la tabla no existe todavía o Supabase no responde, la página se comporta
// como el primer día: dos plazas y el formulario abierto. Mejor recibir una
// solicitud de más que cerrar la puerta por un fallo.
const PLAZAS_POR_DEFECTO = 2;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function getPlazasLibres(): Promise<number> {
  const { data, error } = await supabase
    .from("acompanamiento_config")
    .select("plazas_libres")
    .eq("tanda", TANDA)
    .maybeSingle();
  if (error || !data || typeof data.plazas_libres !== "number") return PLAZAS_POR_DEFECTO;
  return data.plazas_libres;
}

export async function setPlazasLibres(plazas: number) {
  const { error } = await supabase
    .from("acompanamiento_config")
    .upsert({ tanda: TANDA, plazas_libres: plazas, updated_at: new Date().toISOString() }, { onConflict: "tanda" });
  if (error) throw new Error(error.message);
}
