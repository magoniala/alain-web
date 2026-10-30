// Notificaciones push al panel instalado como app en el móvil.
//
// Claves VAPID en Vercel: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY. La pública
// también la pide el navegador al suscribirse (GET /api/admin/charlas/push).
//
// Qué se notifica (desde el cron, tras crear tareas):
//   urgencia 3 → una notificación por tarea, al momento ("🔴 Lead caliente: …")
//   urgencia 2 → una por tarea también, pero agrupadas si hay varias
//   urgencia 1 → un resumen ("3 cosas nuevas por revisar")
// Cada notificación lleva la URL de la tarjeta, que el panel abre al tocarla.

import webpush from "web-push";
import { supabaseCharlas } from "./charlas";

let configurado = false;
function preparar() {
  if (configurado) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:alain@alainzulaika.com", pub, priv);
  configurado = true;
  return true;
}

export interface Aviso {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  renotify?: boolean;
}

/** Manda un aviso a todos los dispositivos suscritos. Devuelve cuántos lo recibieron. */
export async function enviarPush(aviso: Aviso): Promise<{ enviados: number; error?: string }> {
  if (!preparar()) return { enviados: 0, error: "Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY." };
  const supabase = supabaseCharlas();
  const { data: cfg } = await supabase.from("charlas_config").select("valor").eq("clave", "push_activo").maybeSingle();
  if (cfg && cfg.valor === false) return { enviados: 0 };

  const { data: subs } = await supabase.from("charlas_push_suscripciones").select("*");
  let enviados = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.claves as { p256dh: string; auth: string } },
        JSON.stringify({ ...aviso, url: aviso.url ?? "/admin?tab=Charlas&app=1" }),
        { TTL: 60 * 60 * 12, urgency: "high" }
      );
      enviados++;
      await supabase.from("charlas_push_suscripciones").update({ ultimo_envio: new Date().toISOString(), fallos: 0 }).eq("id", s.id);
    } catch (e) {
      const codigo = (e as { statusCode?: number }).statusCode;
      // 404/410: la suscripción ya no existe (app borrada, permiso retirado).
      if (codigo === 404 || codigo === 410 || (s.fallos ?? 0) >= 4) {
        await supabase.from("charlas_push_suscripciones").delete().eq("id", s.id);
      } else {
        await supabase.from("charlas_push_suscripciones").update({ fallos: (s.fallos ?? 0) + 1 }).eq("id", s.id);
      }
    }
  }
  return { enviados };
}

const URL_TAREA = (id: string) => `/admin?tab=Charlas&app=1&tarea=${id}`;

/**
 * Avisa de las tareas creadas que aún no se han notificado. Se llama al final
 * de cada ciclo del cron (y del botón del panel).
 */
export async function notificarTareasNuevas(): Promise<{ avisos: number; tareas: number }> {
  const supabase = supabaseCharlas();
  const { data: tareas } = await supabase
    .from("charlas_tareas")
    .select("id, tipo, nivel, urgencia, urgencia_motivo, contexto, centro:charlas_centros(nombre)")
    .eq("estado", "revisar")
    .is("notificada_en", null)
    .order("urgencia", { ascending: false })
    .order("creado_en");
  if (!tareas?.length) return { avisos: 0, tareas: 0 };

  let avisos = 0;
  const urgentes = tareas.filter((t) => t.urgencia === 3);
  const hoy = tareas.filter((t) => t.urgencia === 2);
  const tranquilas = tareas.filter((t) => t.urgencia === 1);

  for (const t of urgentes) {
    const nombre = (t.centro as unknown as { nombre: string } | null)?.nombre ?? "Centro";
    const r = await enviarPush({
      title: `🔴 ${nombre}`,
      body: t.urgencia_motivo ?? (t.contexto as { resumen?: string })?.resumen ?? "Requiere tu respuesta ya",
      url: URL_TAREA(t.id),
      tag: `tarea-${t.id}`,
      renotify: true,
    });
    if (r.enviados) avisos++;
  }

  if (hoy.length === 1) {
    const t = hoy[0];
    const nombre = (t.centro as unknown as { nombre: string } | null)?.nombre ?? "Centro";
    const r = await enviarPush({ title: `🟠 ${nombre}`, body: t.urgencia_motivo ?? (t.contexto as { resumen?: string })?.resumen ?? "Para hoy", url: URL_TAREA(t.id), tag: `tarea-${t.id}` });
    if (r.enviados) avisos++;
  } else if (hoy.length > 1) {
    const nombres = hoy.map((t) => (t.centro as unknown as { nombre: string } | null)?.nombre).filter(Boolean).slice(0, 3).join(", ");
    const r = await enviarPush({ title: `🟠 ${hoy.length} para hoy`, body: nombres + (hoy.length > 3 ? "…" : ""), tag: "resumen-hoy" });
    if (r.enviados) avisos++;
  }

  if (tranquilas.length) {
    const r = await enviarPush({
      title: `🟢 ${tranquilas.length} ${tranquilas.length === 1 ? "cosa nueva" : "cosas nuevas"} por revisar`,
      body: tranquilas.map((t) => (t.centro as unknown as { nombre: string } | null)?.nombre).filter(Boolean).slice(0, 3).join(", ") + (tranquilas.length > 3 ? "…" : ""),
      tag: "resumen-tranquilo",
    });
    if (r.enviados) avisos++;
  }

  await supabase.from("charlas_tareas").update({ notificada_en: new Date().toISOString() }).in("id", tareas.map((t) => t.id));
  return { avisos, tareas: tareas.length };
}
