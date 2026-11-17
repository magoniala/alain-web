import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";
import { trocearGuion, type ClaveGuion, type Guion } from "@/lib/charlas-guiones";

// GET /api/admin/charlas/guiones → los guiones de llamada, ya troceados.
// El texto lo sube desde el vault la pasada horaria del espejo
// (scripts/charlas/guiones-vault.mjs). Si la tabla aún no existe, lo dice.

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await supabaseCharlas().from("charlas_guiones").select("clave, contenido_md, actualizado_en");
  if (error) {
    const sinTabla = /charlas_guiones/.test(error.message) && /schema cache|does not exist/.test(error.message);
    return NextResponse.json({ guiones: {}, error: sinTabla ? "Falta crear la tabla: sql/charlas_guiones.sql" : error.message });
  }
  const guiones: Partial<Record<ClaveGuion, Guion & { actualizado_en: string }>> = {};
  for (const f of data ?? []) {
    guiones[f.clave as ClaveGuion] = { ...trocearGuion(f.clave as ClaveGuion, f.contenido_md), actualizado_en: f.actualizado_en };
  }
  return NextResponse.json({ guiones });
}
