import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";
import { resumenAyuntamientos, importarAyuntamientos, mail1Ayuntamientos, configAyto, CLAVES_CONFIG_AYTO } from "@/lib/ayuntamientos";
import { investigarUno } from "@/lib/ayto-investigar";
import { estadisticasPorTipo } from "@/lib/charlas-aprendizaje";
import { esClaveAyto } from "@/lib/ayto-autoenvio";
import { ETIQUETAS_AYTO, TIPOS_AYTO, CLASIFICACIONES_AYTO } from "@/lib/ayto-flujo";

// Pestaña Charlas › Ayuntamientos del panel.
//
// GET  → embudo, investigación, lista de fichas, ajustes y rachas de automatización.
// POST { accion, … }
//   importar   { comprobar? }        carga los 251 ayuntamientos del padrón del INE (idempotente)
//   config     { clave, valor }      cambia un ajuste ayto_* (activo, por día, población mínima…)
//   investigar { id }                investiga ya la web de un ayuntamiento (no envía nada)
//   cola       {}                    prepara ahora los Mail 1 del día (si la vía está activa)
//   manual     { tipo, manual }      devuelve un tipo a manual (o lo deja volver a automático)

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const [resumen, stats] = await Promise.all([resumenAyuntamientos(), estadisticasPorTipo()]);
  const claves = [...TIPOS_AYTO, ...CLASIFICACIONES_AYTO.map((c) => `respuesta:${c}`)];
  const porClave = new Map(stats.filter((s) => esClaveAyto(s.tipo)).map((s) => [s.tipo, s]));
  const rachas = claves.map((k) => {
    const s = porClave.get(k);
    return { tipo: k, etiqueta: ETIQUETAS_AYTO[k] ?? k, enviados: s?.enviados ?? 0, editados: s?.editados ?? 0, racha: s?.racha_sin_editar ?? 0, manual: resumen.config.tiposManuales.includes(k) };
  });
  const sb = supabaseCharlas();
  const { data: modo } = await sb.from("charlas_config").select("valor").eq("clave", "modo_prueba").maybeSingle();
  return NextResponse.json({ ...resumen, rachas, modo_prueba: modo?.valor !== false });
}

const AJUSTES: Record<string, "bool" | "num"> = {
  [CLAVES_CONFIG_AYTO.activo]: "bool",
  [CLAVES_CONFIG_AYTO.mail1PorDia]: "num",
  [CLAVES_CONFIG_AYTO.poblacionMinima]: "num",
  [CLAVES_CONFIG_AYTO.investigarActivo]: "bool",
  [CLAVES_CONFIG_AYTO.investigarPorPasada]: "num",
  [CLAVES_CONFIG_AYTO.localizarPorDia]: "num",
  [CLAVES_CONFIG_AYTO.autoenvio]: "bool",
  [CLAVES_CONFIG_AYTO.racha]: "num",
  [CLAVES_CONFIG_AYTO.autoenvioTopeDia]: "num",
};

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sb = supabaseCharlas();
  try {
    switch (body.accion) {
      case "importar":
        return NextResponse.json(await importarAyuntamientos({ comprobar: body.comprobar === true }));
      case "config": {
        const clave = String(body.clave ?? "");
        const tipo = AJUSTES[clave];
        if (!tipo) throw new Error("Ajuste desconocido.");
        const valor = tipo === "bool" ? body.valor === true : Math.max(0, Math.round(Number(body.valor)));
        if (tipo === "num" && !Number.isFinite(valor as number)) throw new Error("Número no válido.");
        await sb.from("charlas_config").upsert({ clave, valor, actualizado_en: new Date().toISOString() });
        return NextResponse.json({ ok: true });
      }
      case "investigar": {
        const { data: f } = await sb.from("charlas_centros").select("id, nombre, localidad, web, telefono, email_centro, responsable, responsable_email, responsable_cargo, responsable_tel, tipo").eq("id", String(body.id)).single();
        if (!f || f.tipo !== "ayuntamiento") throw new Error("Ficha de ayuntamiento no encontrada.");
        if (!f.localidad) throw new Error("La ficha no tiene localidad.");
        return NextResponse.json({ ok: true, resultado: await investigarUno(f as never) });
      }
      case "cola":
        return NextResponse.json(await mail1Ayuntamientos({ presupuestoMs: 45000 }));
      case "manual": {
        const tipo = String(body.tipo ?? "");
        if (!esClaveAyto(tipo)) throw new Error("Tipo no válido.");
        const cfg = await configAyto();
        const lista = new Set(cfg.tiposManuales);
        if (body.manual === true) lista.add(tipo);
        else lista.delete(tipo);
        await sb.from("charlas_config").upsert({ clave: CLAVES_CONFIG_AYTO.tiposManuales, valor: [...lista], actualizado_en: new Date().toISOString() });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
