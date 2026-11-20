// Avisos al móvil cuando la newsletter de hoy no está asegurada (20-11-2026).
//
// Las tareas de Claude dejan los mails en estado 'pendiente' y solo salen
// cuando Alain los confirma en el panel. A las 19:15, si no hay mail del día
// confirmado, sale el primero de la cola B (que también está confirmado). Si
// tampoco hay cola B, ese día no sale nada. Para que no pase, tres avisos con
// tono creciente: 09:00, 13:00 y 18:15 (hora de Madrid). Si hay cola B pero el
// mail del día está sin confirmar, un aviso suave a las 09:00 y a las 18:15.
//
// Cada nivel se manda una sola vez al día: lo ya avisado se apunta en
// charlas_config (clave 'newsletter_avisos_confirmacion').

import { createClient } from "@supabase/supabase-js";
import { enviarPush } from "./charlas-push";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const CLAVE = "newsletter_avisos_confirmacion";
const URL_PANEL = "/admin?tab=Newsletter&app=1";
const VENTANA_MIN = 30;
const MOMENTOS = [
  { nivel: 1, minuto: 9 * 60 },
  { nivel: 2, minuto: 13 * 60 },
  { nivel: 3, minuto: 18 * 60 + 15 },
] as const;

function madrid(d: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return { fecha: `${get("year")}-${get("month")}-${get("day")}`, minutos: Number(get("hour")) * 60 + Number(get("minute")) };
}

const asunto = (c: { subject_es: string | null; subject_eu: string | null }) => c.subject_es || c.subject_eu || "sin asunto";

interface Fila {
  id: string;
  estado: string;
  subject_es: string | null;
  subject_eu: string | null;
  programado_para: string | null;
  enviado_en: string | null;
  orden_cola: number | null;
}

export async function avisarConfirmacionNewsletter(): Promise<number> {
  const ahora = madrid();
  const momento = MOMENTOS.find((m) => ahora.minutos >= m.minuto && ahora.minutos < m.minuto + VENTANA_MIN);
  if (!momento) return 0;

  const { data: cfg } = await supabase.from("charlas_config").select("valor").eq("clave", CLAVE).maybeSingle();
  const previo = (cfg?.valor ?? {}) as { fecha?: string; niveles?: number[] };
  const niveles = previo.fecha === ahora.fecha ? previo.niveles ?? [] : [];
  if (niveles.includes(momento.nivel)) return 0;

  const { data, error } = await supabase
    .from("newsletter_campanas")
    .select("id, estado, subject_es, subject_eu, programado_para, enviado_en, orden_cola")
    .in("estado", ["enviado", "enviando", "programado", "pendiente", "cola"])
    .or(`estado.in.(cola,pendiente,programado,enviando),enviado_en.gte.${new Date(Date.now() - 48 * 3600_000).toISOString()}`);
  // Si la consulta falla no se avisa: mejor un aviso de menos que uno falso.
  if (error || !data) {
    console.error("newsletter-aprobacion: no se ha podido leer las campañas:", error);
    return 0;
  }
  const filas = data as Fila[];
  const esHoy = (iso: string | null) => !!iso && madrid(new Date(iso)).fecha === ahora.fecha;

  const apuntar = async () => {
    await supabase.from("charlas_config").upsert({
      clave: CLAVE,
      valor: { fecha: ahora.fecha, niveles: [...niveles, momento.nivel] },
      actualizado_en: new Date().toISOString(),
    });
  };

  const hoyAsegurado = filas.some(
    (c) =>
      ((c.estado === "enviado" || c.estado === "enviando") && (esHoy(c.enviado_en) || esHoy(c.programado_para))) ||
      (c.estado === "programado" && esHoy(c.programado_para))
  );
  if (hoyAsegurado) {
    await apuntar();
    return 0;
  }

  const pendienteHoy = filas.find((c) => c.estado === "pendiente" && esHoy(c.programado_para));
  const colaB = filas
    .filter((c) => c.estado === "cola")
    .sort((a, b) => (a.orden_cola ?? 0) - (b.orden_cola ?? 0))[0];
  const pendientes = filas.filter((c) => c.estado === "pendiente").length;

  let aviso: { title: string; body: string; renotify?: boolean } | null = null;

  if (colaB) {
    // Hoy sale algo seguro (la cola B). Solo se avisa si el mail del día espera tu OK.
    if (pendienteHoy && momento.nivel !== 2) {
      aviso = {
        title: "Mail de hoy sin confirmar",
        body: `"${asunto(pendienteHoy)}" espera tu OK. Si no lo confirmas, a las 19:15 sale "${asunto(colaB)}" de la cola B.`,
      };
    }
  } else {
    const queHay = pendienteHoy
      ? `"${asunto(pendienteHoy)}" está preparado y solo falta tu OK.`
      : pendientes
        ? `Tienes ${pendientes} mail${pendientes === 1 ? "" : "s"} por confirmar en el panel.`
        : "No hay ningún mail preparado: hay que escribir uno.";
    if (momento.nivel === 1) {
      aviso = {
        title: "📭 Hoy no sale la newsletter",
        body: `No hay mail confirmado para hoy ni en la cola B. ${queHay}`,
      };
    } else if (momento.nivel === 2) {
      aviso = {
        title: "⚠️ Sigue sin haber newsletter hoy",
        body: `Es mediodía y nada está confirmado para las 19:15. ${queHay} Confírmalo ya.`,
        renotify: true,
      };
    } else {
      aviso = {
        title: "🚨 En una hora NO sale la newsletter",
        body: `Son las 18:15 y no hay ningún mail confirmado. Si no confirmas uno antes de las 19:15, hoy tus lectores no reciben nada. ${queHay}`,
        renotify: true,
      };
    }
  }

  await apuntar();
  if (!aviso) return 0;
  const r = await enviarPush({ ...aviso, url: URL_PANEL, tag: `newsletter-confirmar-${ahora.fecha}` });
  if (r.error) console.error("newsletter-aprobacion: push:", r.error);
  return 1;
}
