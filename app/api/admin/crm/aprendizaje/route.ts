import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";
import { aprenderMagia, aprobarPropuestaMagia, descartarPropuestaMagia, estadisticasMagia, guardarReglasMagia } from "@/lib/crm-aprendizaje";

// Aprendizajes del carril MAGIA (mismo contrato que /api/admin/charlas/aprendizaje).
//
// GET → propuestas (pendientes y últimas resueltas), reglas vigentes,
//       estadísticas por tipo (envíos, % editado, racha sin corrección,
//       con el segmento agencia aparte) y correcciones de los últimos 7 días.
// POST { accion }
//   aprobar { id, texto? }   descartar { id }   aprender { dias? }   guardar_reglas { texto }

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const sb = supabaseCharlas();
  const [propuestas, reglas, stats, config, correcciones] = await Promise.all([
    sb.from("crm_reglas_propuestas").select("*").eq("carril", "magia").order("creado_en", { ascending: false }).limit(50),
    sb.from("crm_conocimiento").select("texto, actualizado_en").eq("carril", "magia").eq("clave", "reglas_aprendidas").maybeSingle(),
    estadisticasMagia(),
    sb.from("charlas_config").select("clave, valor").in("clave", ["magia_aprendizaje_ultima", "magia_racha_para_automatico"]),
    sb.from("crm_correcciones").select("motivo").eq("carril", "magia").gte("creado_en", new Date(Date.now() - 7 * 86400000).toISOString()),
  ]);
  const cfg = Object.fromEntries((config.data ?? []).map((c) => [c.clave, c.valor]));
  const c7 = correcciones.data ?? [];
  return NextResponse.json({
    propuestas: propuestas.data ?? [],
    error_propuestas: propuestas.error?.message ?? null, // p. ej. si falta ejecutar sql/crm-aprendizaje.sql
    reglas: reglas.data?.texto ?? "",
    reglas_actualizadas: reglas.data?.actualizado_en ?? null,
    stats,
    racha_para_automatico: Number(cfg.magia_racha_para_automatico ?? 15),
    aprendizaje_ultima: cfg.magia_aprendizaje_ultima ?? null,
    correcciones_7d: { total: c7.length, sin_motivo: c7.filter((c) => !c.motivo).length },
  });
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    switch (body.accion) {
      case "aprobar":
        await aprobarPropuestaMagia(String(body.id), typeof body.texto === "string" ? body.texto : undefined);
        return NextResponse.json({ ok: true });
      case "descartar":
        await descartarPropuestaMagia(String(body.id));
        return NextResponse.json({ ok: true });
      case "aprender":
        return NextResponse.json(await aprenderMagia({ dias: Number(body.dias ?? 7), forzar: true }));
      case "guardar_reglas":
        await guardarReglasMagia(String(body.texto ?? ""));
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
