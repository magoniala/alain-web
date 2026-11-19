// Cierres contra duplicados (19-nov-2026).
//
// 1) Cierre del cron: dos pasadas de /api/charlas/cron que se solapan (cron-job.org + "Leer buzón
//    ahora", o un reintento) crearon dos veces la misma tarjeta y se mandó dos veces el mismo
//    recordatorio a eapamplo@ e iesonoai@. Con este cierre solo una pasada trabaja a la vez.
//    Se toma con un UPDATE condicionado en charlas_config (clave `cron_cierre`): atómico, y caduca
//    solo a los `segundos` por si la función se corta sin soltarlo.
// 2) Guardia de la tarjeta: justo antes de insertar, comprobar que no hay ya una del mismo tipo para
//    la misma ficha/centro en las últimas 12 h (viva o ya enviada, no descartada).
import { supabaseCharlas } from "@/lib/charlas";

const CLAVE = "cron_cierre";

export async function tomarCierre(segundos = 100): Promise<string | null> {
  const sb = supabaseCharlas();
  const token = crypto.randomUUID();
  await sb.from("charlas_config").upsert({ clave: CLAVE, valor: { hasta: "1970-01-01T00:00:00Z", token: null } }, { onConflict: "clave", ignoreDuplicates: true });
  const { data, error } = await sb
    .from("charlas_config")
    .update({ valor: { hasta: new Date(Date.now() + segundos * 1000).toISOString(), token } })
    .eq("clave", CLAVE)
    .lt("valor->>hasta", new Date().toISOString())
    .select("clave");
  if (error) return token; // ante un fallo del propio cierre, no se bloquea el cron
  return data && data.length ? token : null;
}

export async function soltarCierre(token: string): Promise<void> {
  await supabaseCharlas()
    .from("charlas_config")
    .update({ valor: { hasta: "1970-01-01T00:00:00Z", token: null } })
    .eq("clave", CLAVE)
    .eq("valor->>token", token);
}

/** ¿Ya existe una tarjeta de este tipo para esta ficha/centro en las últimas 12 h (no descartada)? */
export async function tarjetaYaCreada(tabla: "charlas_tareas" | "crm_tareas", campoId: "centro_id" | "ficha_id", id: string, tipos: string[]): Promise<boolean> {
  const desde = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const { data } = await supabaseCharlas()
    .from(tabla)
    .select("id")
    .eq(campoId, id)
    .in("tipo", tipos)
    .in("estado", ["revisar", "pendiente", "aprobada", "enviada", "hecha"])
    .gte("creado_en", desde)
    .limit(1);
  return !!(data && data.length);
}
