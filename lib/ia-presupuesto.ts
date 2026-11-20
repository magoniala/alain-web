// Presupuesto mensual de la API de Anthropic (decisión de Alain, 20-11-2026):
// gastar lo más cerca posible del tope (100 US$ al mes) SIN PASARSE NUNCA.
//
// Todas las llamadas a la IA del proyecto pasan por llamarClaude (lib/charlas-ia.ts)
// y quedan apuntadas con su coste en charlas_ia_uso. Con eso:
//   · comprobarTopeIA(): freno duro. Si el gasto del mes llega a tope − margen,
//     ninguna llamada más sale hasta el mes siguiente (lanza un error claro).
//   · cupoAytoHoy(): cuántos Mail 1 de ayuntamientos caben hoy, repartiendo lo
//     que queda del mes entre los días laborables que faltan y descontando lo
//     que gastan de media el resto de carriles.
//
// Ajustes en charlas_config: ia_tope_mensual_usd (100) e ia_margen_usd (4).

import { supabaseCharlas } from "./charlas";

const madrid = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

function inicioMes(): string {
  return `${madrid().slice(0, 7)}-01T00:00:00+01:00`;
}

/** Días laborables (L-V) que quedan en el mes, contando hoy. */
export function laborablesRestantes(): number {
  const h = madrid();
  const d = new Date(`${h}T12:00:00Z`);
  const mes = d.getUTCMonth();
  let n = 0;
  while (d.getUTCMonth() === mes) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return Math.max(1, n);
}

async function config(): Promise<{ tope: number; margen: number }> {
  const { data } = await supabaseCharlas().from("charlas_config").select("clave, valor").in("clave", ["ia_tope_mensual_usd", "ia_margen_usd"]);
  const c = Object.fromEntries((data ?? []).map((f) => [f.clave, f.valor])) as Record<string, unknown>;
  return { tope: Number(c.ia_tope_mensual_usd ?? 100), margen: Number(c.ia_margen_usd ?? 4) };
}

export async function gastoDelMes(): Promise<number> {
  const sb = supabaseCharlas();
  let total = 0;
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.from("charlas_ia_uso").select("coste_usd").gte("creado_en", inicioMes()).range(desde, desde + 999);
    if (error) throw new Error(`Gasto de IA: ${error.message}`);
    for (const f of data ?? []) total += Number(f.coste_usd) || 0;
    if (!data || data.length < 1000) break;
  }
  return total;
}

export class TopeIAAlcanzado extends Error {}

let cache: { hasta: number; gastado: number; limite: number } | null = null;

/** Freno duro antes de cada llamada. Consulta la base como mucho una vez por minuto. */
export async function comprobarTopeIA(): Promise<void> {
  if (!cache || Date.now() > cache.hasta) {
    const [{ tope, margen }, gastado] = await Promise.all([config(), gastoDelMes()]);
    cache = { hasta: Date.now() + 60_000, gastado, limite: tope - margen };
  }
  if (cache.gastado >= cache.limite) {
    throw new TopeIAAlcanzado(`Tope mensual de IA alcanzado (${cache.gastado.toFixed(2)} US$ de ${cache.limite.toFixed(2)} permitidos este mes). No se hacen más llamadas hasta el día 1.`);
  }
}

/** Suma lo que acaba de costar una llamada a la caché del freno (para no pasarse entre consultas). */
export function anotarGasto(usd: number) {
  if (cache) cache.gastado += usd;
}

export interface PresupuestoIA {
  tope: number;
  margen: number;
  gastado: number;
  disponible: number;
  laborables_restantes: number;
  media_diaria_resto: number;
  coste_mail1_ayto: number;
  cupo_ayto_hoy: number;
}

/**
 * Cuántos Mail 1 de ayuntamientos caben hoy sin pasar del tope. Cada Mail 1
 * cuenta por 2,5 llamadas (el propio correo más, de media, recordatorio y
 * respuesta que vendrán después).
 */
export async function presupuestoIA(maximoDia: number): Promise<PresupuestoIA> {
  const sb = supabaseCharlas();
  const [{ tope, margen }, gastado] = await Promise.all([config(), gastoDelMes()]);
  const hace14 = new Date(Date.now() - 14 * 86400000).toISOString();
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: ult14 }, { data: ayto }] = await Promise.all([
    sb.from("charlas_ia_uso").select("coste_usd, proposito").gte("creado_en", hace14).limit(5000),
    sb.from("charlas_ia_uso").select("coste_usd").eq("proposito", "ayto_programada").gte("creado_en", hace30).limit(2000),
  ]);
  const resto = (ult14 ?? []).filter((f) => !String(f.proposito ?? "").startsWith("ayto_")).reduce((s, f) => s + (Number(f.coste_usd) || 0), 0);
  // Media por día laborable (los fines de semana el cron casi no gasta).
  const mediaResto = resto / 10;
  const costeMail1 = ayto?.length ? ayto.reduce((s, f) => s + (Number(f.coste_usd) || 0), 0) / ayto.length : 0.06;
  const disponible = Math.max(0, tope - margen - gastado);
  const dias = laborablesRestantes();
  const libreHoy = disponible / dias - mediaResto;
  const cupo = Math.max(0, Math.min(maximoDia, Math.floor(libreHoy / (costeMail1 * 2.5))));
  return {
    tope,
    margen,
    gastado: Number(gastado.toFixed(2)),
    disponible: Number(disponible.toFixed(2)),
    laborables_restantes: dias,
    media_diaria_resto: Number(mediaResto.toFixed(3)),
    coste_mail1_ayto: Number(costeMail1.toFixed(4)),
    cupo_ayto_hoy: cupo,
  };
}
