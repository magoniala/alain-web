import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas, faseDeEstado } from "@/lib/charlas";
import { aprender, aprobarPropuesta, estadisticasPorTipo } from "@/lib/charlas-aprendizaje";

// Aprendizajes y métricas del carril charlas.
//
// GET → propuestas pendientes, reglas vigentes, estadísticas por tipo
//       (envíos, % editado, racha sin corrección), embudo por estado y
//       territorio, próximas reactivaciones por mes, coste de IA.
// POST { accion }
//   aprobar   { id, texto? }   descartar { id }   aprender {}   guardar_reglas { texto }

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const supabase = supabaseCharlas();

  const [propuestas, reglas, stats, embudo, reactivaciones, uso, tareas, config] = await Promise.all([
    supabase.from("charlas_reglas_propuestas").select("*").order("creado_en", { ascending: false }).limit(50),
    supabase.from("charlas_conocimiento").select("texto, actualizado_en").eq("clave", "reglas_aprendidas").maybeSingle(),
    estadisticasPorTipo(),
    supabase.from("charlas_v_embudo").select("*"),
    supabase.from("charlas_centros").select("fecha_proxima_accion, estado").not("fecha_proxima_accion", "is", null).not("estado", "like", "7%").not("estado", "like", "8%"),
    supabase.from("charlas_ia_uso").select("creado_en, coste_usd, proposito").gte("creado_en", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("charlas_tareas").select("estado, nivel, urgencia, tipo, creado_en, resuelto_en, resuelto_por, editado").gte("creado_en", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("charlas_config").select("clave, valor").in("clave", ["aprendizaje_ultima", "racha_para_automatico"]),
  ]);

  // Embudo por fase (0-9) y por territorio.
  const porFase: Record<string, number> = {};
  const porTerritorio: Record<string, Record<string, number>> = {};
  for (const f of (embudo.data ?? []) as { territorio: string | null; estado: string; n: number }[]) {
    const fase = String(faseDeEstado(f.estado));
    porFase[f.estado] = (porFase[f.estado] ?? 0) + f.n;
    const t = f.territorio ?? "¿?";
    porTerritorio[t] = porTerritorio[t] ?? {};
    porTerritorio[t][fase] = (porTerritorio[t][fase] ?? 0) + f.n;
  }

  // Reactivaciones y próximas acciones por mes.
  const porMes: Record<string, number> = {};
  for (const r of reactivaciones.data ?? []) {
    const m = String(r.fecha_proxima_accion).slice(0, 7);
    porMes[m] = (porMes[m] ?? 0) + 1;
  }

  // Coste por día (30 días).
  const costePorDia: Record<string, number> = {};
  for (const u of uso.data ?? []) {
    const d = u.creado_en.slice(0, 10);
    costePorDia[d] = Number(((costePorDia[d] ?? 0) + Number(u.coste_usd)).toFixed(3));
  }

  // Tareas: creadas, enviadas, editadas, descartadas, tiempo medio hasta resolver.
  const t = tareas.data ?? [];
  const enviadas = t.filter((x) => x.estado === "enviada");
  const resueltas = t.filter((x) => x.resuelto_en && x.resuelto_por === "alain");
  const mediaHoras = resueltas.length ? resueltas.reduce((s, x) => s + (new Date(x.resuelto_en!).getTime() - new Date(x.creado_en).getTime()), 0) / resueltas.length / 3600000 : null;

  const cfg = Object.fromEntries((config.data ?? []).map((c) => [c.clave, c.valor]));

  return NextResponse.json({
    propuestas: propuestas.data ?? [],
    reglas: reglas.data?.texto ?? "",
    reglas_actualizadas: reglas.data?.actualizado_en ?? null,
    stats,
    racha_para_automatico: Number(cfg.racha_para_automatico ?? 20),
    aprendizaje_ultima: cfg.aprendizaje_ultima ?? null,
    embudo: { por_estado: porFase, por_territorio: porTerritorio, total: Object.values(porFase).reduce((a, b) => a + b, 0) },
    proximas_por_mes: porMes,
    coste_por_dia: costePorDia,
    tareas_30d: {
      creadas: t.length,
      enviadas: enviadas.length,
      editadas: enviadas.filter((x) => x.editado).length,
      descartadas: t.filter((x) => x.estado === "descartada").length,
      pendientes: t.filter((x) => x.estado === "revisar").length,
      horas_medias_hasta_resolver: mediaHoras === null ? null : Number(mediaHoras.toFixed(1)),
      por_urgencia: { 3: t.filter((x) => x.urgencia === 3).length, 2: t.filter((x) => x.urgencia === 2).length, 1: t.filter((x) => (x.urgencia ?? 1) === 1).length },
    },
  });
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const supabase = supabaseCharlas();
  try {
    switch (body.accion) {
      case "aprobar":
        await aprobarPropuesta(String(body.id), typeof body.texto === "string" ? body.texto : undefined);
        return NextResponse.json({ ok: true });
      case "descartar":
        await supabase.from("charlas_reglas_propuestas").update({ estado: "descartada", resuelto_en: new Date().toISOString() }).eq("id", String(body.id));
        return NextResponse.json({ ok: true });
      case "aprender":
        return NextResponse.json(await aprender({ dias: Number(body.dias ?? 7), forzar: true }));
      case "guardar_reglas": {
        const texto = String(body.texto ?? "").trim();
        if (!texto) throw new Error("Texto vacío.");
        await supabase.from("charlas_conocimiento").upsert({ clave: "reglas_aprendidas", titulo: "Reglas aprendidas de las correcciones de Alain", tipo: "reglas", orden: 5, texto, activo: true, actualizado_en: new Date().toISOString() });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
