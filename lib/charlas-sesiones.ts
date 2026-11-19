// Sesiones de llamadas en frío de charlas (19-nov-2026).
//
// Las llamadas de venta en frío (centros en fase 0-2 sin correo) no salen sueltas cada día: se acumulan
// y salen todas juntas en la «sesión de llamadas», cada `cada_dias` días a partir de `ancla`.
// Así Alain hace varias llamadas seguidas y se olvida hasta la siguiente, y sabe la fecha con antelación.
// Config en charlas_config.sesion_llamadas: { ancla: "AAAA-MM-DD", cada_dias: 14, gracia_dias: 3 }.
import { supabaseCharlas } from "./charlas";

export interface ConfigSesiones {
  ancla: string;
  cada_dias: number;
  gracia_dias: number;
}
const POR_DEFECTO: ConfigSesiones = { ancla: "2026-12-01", cada_dias: 14, gracia_dias: 3 };
const DIA = 86400000;
const aDias = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DIA);
const deDias = (n: number) => new Date(n * DIA).toISOString().slice(0, 10);

export async function leerSesiones(): Promise<ConfigSesiones> {
  const { data } = await supabaseCharlas().from("charlas_config").select("valor").eq("clave", "sesion_llamadas").maybeSingle();
  const v = (data?.valor ?? {}) as Partial<ConfigSesiones>;
  return {
    ancla: /^\d{4}-\d{2}-\d{2}$/.test(String(v.ancla ?? "")) ? String(v.ancla) : POR_DEFECTO.ancla,
    cada_dias: Number(v.cada_dias) > 0 ? Number(v.cada_dias) : POR_DEFECTO.cada_dias,
    gracia_dias: Number.isFinite(Number(v.gracia_dias)) && Number(v.gracia_dias) >= 0 ? Number(v.gracia_dias) : POR_DEFECTO.gracia_dias,
  };
}

/** Fecha de la primera sesión posterior a `desde` (siempre futura). */
export function proximaSesion(desde: string, cfg: ConfigSesiones): string {
  const a = aDias(cfg.ancla);
  const d = aDias(desde);
  if (d < a) return cfg.ancla;
  return deDias(a + (Math.floor((d - a) / cfg.cada_dias) + 1) * cfg.cada_dias);
}

/** Fecha de la sesión en curso si `hoy` es el día de la sesión o está dentro de la gracia; si no, null. */
export function sesionVigente(hoy: string, cfg: ConfigSesiones): string | null {
  const a = aDias(cfg.ancla);
  const d = aDias(hoy);
  if (d < a) return null;
  const k = Math.floor((d - a) / cfg.cada_dias);
  return d - (a + k * cfg.cada_dias) <= cfg.gracia_dias ? deDias(a + k * cfg.cada_dias) : null;
}

export const bonita = (iso: string) => iso.split("-").reverse().join("-");
