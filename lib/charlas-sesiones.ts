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
  /** Festivos extra (fiestas locales, vacaciones…) que se suman a los de Euskadi. */
  festivos: string[];
}
// Festivos de Euskadi (BOPV: Decreto 82/2025 para 2026 y Decreto 90/2026 para 2027). Solo los que caen en día laborable.
const FESTIVOS_EUSKADI = [
  "2026-12-08", "2026-12-25",
  "2027-01-01", "2027-01-06", "2027-03-25", "2027-03-26", "2027-03-29", "2027-05-01",
  "2027-10-07", "2027-10-12", "2027-11-01", "2027-12-06", "2027-12-08", "2027-12-25",
];
const POR_DEFECTO: ConfigSesiones = { ancla: "2026-12-01", cada_dias: 14, gracia_dias: 3, festivos: [] };
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
    festivos: Array.isArray(v.festivos) ? v.festivos.map(String) : [],
  };
}

/** Laborable = lunes a viernes y no festivo (Euskadi + los extra de la config). Nunca toca llamar en fin de semana ni festivo. */
export function esLaborable(iso: string, cfg: ConfigSesiones): boolean {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6 && !FESTIVOS_EUSKADI.includes(iso) && !cfg.festivos.includes(iso);
}
function ajustar(iso: string, cfg: ConfigSesiones): string {
  let n = aDias(iso);
  while (!esLaborable(deDias(n), cfg)) n++;
  return deDias(n);
}

/** Fecha de la primera sesión posterior a `desde` (siempre futura). Si le toca fin de semana o festivo, pasa al siguiente día laborable. */
export function proximaSesion(desde: string, cfg: ConfigSesiones): string {
  const a = aDias(cfg.ancla);
  const d = aDias(desde);
  let k = d < a ? 0 : Math.floor((d - a) / cfg.cada_dias);
  for (;;) {
    const f = ajustar(deDias(a + k * cfg.cada_dias), cfg);
    if (aDias(f) > d) return f;
    k++;
  }
}

/** Fecha de la sesión en curso si `hoy` es laborable y es el día de la sesión o está dentro de la gracia; si no, null. */
export function sesionVigente(hoy: string, cfg: ConfigSesiones): string | null {
  const a = aDias(cfg.ancla);
  const d = aDias(hoy);
  if (d < a || !esLaborable(hoy, cfg)) return null;
  const k = Math.floor((d - a) / cfg.cada_dias);
  for (const kk of [k, k - 1]) {
    if (kk < 0) continue;
    const f = aDias(ajustar(deDias(a + kk * cfg.cada_dias), cfg));
    if (d >= f && d - f <= cfg.gracia_dias) return deDias(f);
  }
  return null;
}

export const bonita = (iso: string) => iso.split("-").reverse().join("-");
