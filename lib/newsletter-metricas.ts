// Métricas por mail de la newsletter diaria (bucle de aprendizaje, 18-11-2026).
//
// Cada mail diario sale con la etiqueta CustomCampaign `diario-<id>-<idioma>`
// (ver enviarCampana en app/api/newsletter/cron). Aquí se piden a Mailjet los
// contadores de cada campaña y se guardan en newsletter_campanas.metricas
// (jsonb) para que el análisis semanal los lea de Supabase sin tocar Mailjet.
//
// Los mails anteriores al 18-11-2026 no llevan etiqueta: Mailjet los agrupó
// por su cuenta. Para esos se busca la campaña por asunto en una ventana de
// horas alrededor de `enviado_en`. Si no aparece, se deja sin métricas.

import Mailjet from "node-mailjet";
import { createClient } from "@supabase/supabase-js";

export type Idioma = "es" | "eu";

export function etiquetaMailjet(campanaId: string, idioma: Idioma): string {
  return `diario-${campanaId}-${idioma}`;
}

export interface Contadores {
  enviados: number;
  entregados: number;
  aperturas: number; // mensajes abiertos (únicos por destinatario)
  clics: number; // mensajes con al menos un clic
  bajas: number;
  spam: number;
  rebotes: number;
}

export interface MetricasMail {
  es?: Contadores & { campana_mj?: number; via: "etiqueta" | "asunto" | "mensajes" };
  eu?: Contadores & { campana_mj?: number; via: "etiqueta" | "asunto" | "mensajes" };
  total: Contadores;
}

let cliente: ReturnType<typeof Mailjet.apiConnect> | null = null;
function mj() {
  if (!cliente) cliente = Mailjet.apiConnect(process.env.MJ_APIKEY_PUBLIC!, process.env.MJ_APIKEY_PRIVATE!);
  return cliente;
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

type CampanaMj = { ID: number; Subject?: string; CustomValue?: string };

async function campanasEnVentana(desde: Date, hasta: Date): Promise<CampanaMj[]> {
  const r = await mj()
    .get("campaign", { version: "v3" })
    .request({}, {
      FromTS: Math.floor(desde.getTime() / 1000),
      ToTS: Math.floor(hasta.getTime() / 1000),
      Limit: 200,
    } as Record<string, unknown>);
  return ((r.body as { Data?: CampanaMj[] }).Data ?? []) as CampanaMj[];
}

async function contadores(idCampana: number): Promise<Contadores> {
  const r = await mj()
    .get("statcounters", { version: "v3" })
    .request({}, {
      CounterSource: "Campaign",
      CounterTiming: "Message",
      CounterResolution: "Lifetime",
      SourceId: idCampana,
    } as Record<string, unknown>);
  const d = (((r.body as { Data?: Record<string, number>[] }).Data ?? [])[0] ?? {}) as Record<string, number>;
  return {
    enviados: d.MessageSentCount ?? 0,
    entregados: d.MessageDeliveredCount ?? 0,
    aperturas: d.MessageOpenedCount ?? 0,
    clics: d.MessageClickedCount ?? 0,
    bajas: d.MessageUnsubscribedCount ?? 0,
    spam: d.MessageSpamCount ?? 0,
    rebotes: (d.MessageHardBouncedCount ?? 0) + (d.MessageSoftBouncedCount ?? 0),
  };
}

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

type MensajeMj = { Status?: string; Subject?: string };

/**
 * Plan B para los mails sin etiqueta (anteriores al 18-11-2026): Mailjet no los
 * agrupa en campañas, así que se cuentan mensaje a mensaje por asunto en la
 * ventana del envío. `Status` es el último estado de cada mensaje
 * (clicked implica opened). Mailjet solo guarda este detalle unos meses.
 */
async function contadoresPorMensajes(desde: Date, hasta: Date, asunto: string): Promise<Contadores & { vistos: number }> {
  const todos: MensajeMj[] = [];
  for (let offset = 0; offset < 5000; offset += 1000) {
    const r = await mj()
      .get("message", { version: "v3" })
      .request({}, {
        FromTS: Math.floor(desde.getTime() / 1000),
        ToTS: Math.floor(hasta.getTime() / 1000),
        ShowSubject: true,
        Limit: 1000,
        Offset: offset,
      } as Record<string, unknown>);
    const lote = ((r.body as { Data?: MensajeMj[] }).Data ?? []) as MensajeMj[];
    todos.push(...lote);
    if (lote.length < 1000) break;
  }
  const mios = todos.filter((m) => norm(m.Subject) === norm(asunto));
  const n = (...st: string[]) => mios.filter((m) => st.includes((m.Status ?? "").toLowerCase())).length;
  const rebotes = n("bounce", "hardbounced", "softbounced", "blocked");
  return {
    vistos: todos.length,
    enviados: mios.length,
    entregados: mios.length - rebotes,
    aperturas: n("opened", "clicked", "unsub", "spam"),
    clics: n("clicked"),
    bajas: n("unsub"),
    spam: n("spam"),
    rebotes,
  };
}

function sumar(a: Contadores, b: Contadores): Contadores {
  return {
    enviados: a.enviados + b.enviados,
    entregados: a.entregados + b.entregados,
    aperturas: a.aperturas + b.aperturas,
    clics: a.clics + b.clics,
    bajas: a.bajas + b.bajas,
    spam: a.spam + b.spam,
    rebotes: a.rebotes + b.rebotes,
  };
}

const CERO: Contadores = { enviados: 0, entregados: 0, aperturas: 0, clics: 0, bajas: 0, spam: 0, rebotes: 0 };

interface FilaCampana {
  id: string;
  subject_es: string | null;
  subject_eu: string | null;
  enviado_en: string;
}

/**
 * Actualiza las métricas de los mails enviados entre hace `dias` días y hace
 * `saltar` días. El histórico se pide por tramos (la ruta corta a los 60 s).
 */
export async function actualizarMetricas(dias = 21, saltar = 0) {
  const desde = new Date(Date.now() - dias * 86400_000).toISOString();
  const hasta = new Date(Date.now() - saltar * 86400_000).toISOString();
  const { data, error } = await supabase
    .from("newsletter_campanas")
    .select("id, subject_es, subject_eu, enviado_en")
    .eq("estado", "enviado")
    .gte("enviado_en", desde)
    .lt("enviado_en", hasta)
    .order("enviado_en", { ascending: true });
  if (error) throw new Error(`Supabase: ${error.message}`);

  const diagnostico: string[] = [];
  const resultado = { revisados: 0, con_metricas: 0, sin_campana_en_mailjet: [] as string[], errores: [] as string[], diagnostico };

  for (const c of (data ?? []) as FilaCampana[]) {
    resultado.revisados++;
    try {
      const envio = new Date(c.enviado_en);
      const candidatas = await campanasEnVentana(
        new Date(envio.getTime() - 2 * 3600_000),
        new Date(envio.getTime() + 3 * 3600_000)
      );
      const metricas: MetricasMail = { total: { ...CERO } };
      for (const idioma of ["es", "eu"] as const) {
        const asunto = idioma === "es" ? c.subject_es : c.subject_eu;
        const etiqueta = etiquetaMailjet(c.id, idioma);
        let mjc = candidatas.find((k) => k.CustomValue === etiqueta);
        let via: "etiqueta" | "asunto" = "etiqueta";
        if (!mjc && asunto) {
          via = "asunto";
          mjc = candidatas.find((k) => norm(k.Subject) === norm(asunto));
        }
        if (mjc) {
          const cont = await contadores(mjc.ID);
          metricas[idioma] = { ...cont, campana_mj: mjc.ID, via };
          metricas.total = sumar(metricas.total, cont);
          continue;
        }
        if (!asunto) continue;
        const { vistos, ...cont } = await contadoresPorMensajes(
          new Date(envio.getTime() - 10 * 60_000),
          new Date(envio.getTime() + 2 * 3600_000),
          asunto
        );
        diagnostico.push(`${asunto} [${idioma}]: ${candidatas.length} campañas en la ventana, ${vistos} mensajes, ${cont.enviados} con su asunto`);
        if (!cont.enviados) continue;
        metricas[idioma] = { ...cont, via: "mensajes" };
        metricas.total = sumar(metricas.total, cont);
      }
      if (!metricas.es && !metricas.eu) {
        resultado.sin_campana_en_mailjet.push(c.subject_es ?? c.subject_eu ?? c.id);
        continue;
      }
      const { error: e2 } = await supabase
        .from("newsletter_campanas")
        .update({ metricas, metricas_en: new Date().toISOString() })
        .eq("id", c.id);
      if (e2) throw new Error(e2.message);
      resultado.con_metricas++;
    } catch (e) {
      resultado.errores.push(`${c.subject_es ?? c.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return resultado;
}
