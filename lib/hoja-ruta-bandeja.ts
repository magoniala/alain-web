// Bandeja de reservas de la Hoja de Ruta: qué cuenta como confirmada y el
// aviso al móvil de Alain cuando entra una que pide WhatsApp.

import { createClient } from "@supabase/supabase-js";
import { enviarPush } from "./charlas-push";
import { formatearHueco } from "./entrenatzaile-huecos";

export function reservaConfirmada(r: { pago_estado: string | null }) {
  return r.pago_estado === null || r.pago_estado === "pagado" || r.pago_estado === "pagado_fuera_de_plazo";
}

/** Desde el cron: push por cada reserva confirmada que aún no se ha avisado al panel. */
export async function notificarReservasHojaRuta(): Promise<{ avisos: number }> {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { data, error } = await sb
    .from("hoja_ruta_reservas")
    .select("id, nombre, hueco, pago_estado, pagado_en, tipo")
    .not("hueco", "is", null)
    .is("cancelada_en", null)
    .is("wa_confirmacion_en", null)
    .is("panel_notificada_en", null)
    .is("panel_descartada_en", null)
    .gte("creado_en", new Date(Date.now() - 7 * 86400000).toISOString());
  if (error || !data) return { avisos: 0 };
  let n = 0;
  for (const r of data) {
    if (!reservaConfirmada(r)) continue;
    const nombre = (r.nombre ?? "alguien").trim();
    const res = await enviarPush({
      title: r.pago_estado ? `💶 Hoja de Ruta pagada: ${nombre}` : `📅 Hoja de Ruta reservada: ${nombre}`,
      body: `${formatearHueco(r.hueco)} · toca mandarle el WhatsApp de confirmación`,
      url: "/admin?tab=Hoja%20de%20Ruta&app=1",
      tag: `hr-${r.id}`,
      renotify: true,
    }).catch(() => ({ enviados: 0 }));
    await sb.from("hoja_ruta_reservas").update({ panel_notificada_en: new Date().toISOString() }).eq("id", r.id);
    n += res.enviados;
  }
  return { avisos: n };
}
