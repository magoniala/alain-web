import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";
import { CARRIL_CATALOGO, PLANTILLA_SHOW, TIPO_CATALOGO, claveDesdeTitulo, sembrarCatalogo } from "@/lib/conocimiento-catalogo";

// Catálogo de shows que leen las IAs de Prospectos de magia y de Charlas.
//
//   GET  /api/admin/crm/conocimiento            → { catalogo: docs completos (tipo catalogo), otros: lo demás que lee la IA de magia (sin texto), plantilla }
//   POST /api/admin/crm/conocimiento { accion, … }
//        guardar  { clave, titulo, texto }   → edita un documento del catálogo
//        nuevo    { titulo, texto? }         → crea un documento con la plantilla de show
//        activar  { clave, activo }          → la IA lo lee o no
//        sembrar                             → da de alta lo que falte del catálogo inicial (lib/catalogo-inicial.json); no pisa nada
//
// Solo se editan los documentos tipo "catalogo": los guiones, ejemplos y
// reglas los carga scripts/crm/cargar-conocimiento-magia.mjs desde el vault
// (y las reglas, Aprendizajes), así que aquí solo se listan.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await supabaseCharlas().from("crm_conocimiento").select("clave, titulo, tipo, texto, activo, orden, actualizado_en").eq("carril", CARRIL_CATALOGO).order("orden").order("clave");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const docs = data ?? [];
  return NextResponse.json({
    catalogo: docs.filter((d) => d.tipo === TIPO_CATALOGO),
    otros: docs.filter((d) => d.tipo !== TIPO_CATALOGO).map(({ texto, ...d }) => ({ ...d, kb: Math.round((texto?.length ?? 0) / 102.4) / 10 })),
    plantilla: PLANTILLA_SHOW,
  });
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sb = supabaseCharlas();
  const ahora = new Date().toISOString();
  try {
    switch (body.accion) {
      case "guardar": {
        const clave = String(body.clave ?? "");
        const titulo = String(body.titulo ?? "").trim();
        const texto = String(body.texto ?? "").trim();
        if (!titulo || !texto) throw new Error("El título y el texto no pueden quedar vacíos.");
        const { data: doc } = await sb.from("crm_conocimiento").select("tipo").eq("carril", CARRIL_CATALOGO).eq("clave", clave).maybeSingle();
        if (!doc) throw new Error("Ese documento no existe.");
        if (doc.tipo !== TIPO_CATALOGO) throw new Error("Solo se editan aquí los documentos del catálogo.");
        const { error } = await sb.from("crm_conocimiento").update({ titulo, texto, actualizado_en: ahora }).eq("carril", CARRIL_CATALOGO).eq("clave", clave);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "nuevo": {
        const titulo = String(body.titulo ?? "").trim();
        if (!titulo) throw new Error("Ponle nombre al show.");
        const base = claveDesdeTitulo(titulo);
        const { data: existentes } = await sb.from("crm_conocimiento").select("clave, orden").eq("carril", CARRIL_CATALOGO);
        const usadas = new Set((existentes ?? []).map((d) => d.clave));
        let clave = base;
        for (let i = 2; usadas.has(clave); i++) clave = `${base}_${i}`;
        const orden = Math.min(68, Math.max(66, ...(existentes ?? []).filter((d) => d.orden >= 60 && d.orden < 69).map((d) => d.orden + 1)));
        const texto = String(body.texto ?? "").trim() || PLANTILLA_SHOW;
        const { error } = await sb.from("crm_conocimiento").insert({ clave, carril: CARRIL_CATALOGO, titulo, tipo: TIPO_CATALOGO, texto, activo: true, orden, actualizado_en: ahora });
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, clave });
      }
      case "activar": {
        const clave = String(body.clave ?? "");
        const { error } = await sb.from("crm_conocimiento").update({ activo: body.activo === true, actualizado_en: ahora }).eq("carril", CARRIL_CATALOGO).eq("clave", clave).eq("tipo", TIPO_CATALOGO);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      case "sembrar":
        return NextResponse.json({ ok: true, creados: await sembrarCatalogo() });
      default:
        return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
