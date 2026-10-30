import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";
import { rastrearContactos } from "@/lib/charlas-rastreo";

// Rastreo web de correos de contacto (fase 3).
//
//   GET  /api/admin/charlas/rastreo         → resumen: cuántos centros revisados, con qué resultado, y los últimos hallazgos
//   POST /api/admin/charlas/rastreo { n? }  → lanza una pasada ahora (n centros, 10 por defecto)
//
// El cron lo hace solo, fuera de las ventanas de IA. Esto es para verlo y
// para empujarlo a mano tras una importación grande.

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const supabase = supabaseCharlas();
  const [{ data: filas }, { count: sinCorreo }] = await Promise.all([
    supabase.from("charlas_rastreo").select("centro_id, web, paginas_vistas, emails_encontrados, resultado, rastreado_en, charlas_centros(nombre, territorio, estado)").order("rastreado_en", { ascending: false }).limit(300),
    supabase.from("charlas_centros").select("id", { count: "exact", head: true }).is("responsable_email", null),
  ]);
  const porResultado: Record<string, number> = {};
  for (const f of filas ?? []) porResultado[f.resultado ?? "?"] = (porResultado[f.resultado ?? "?"] ?? 0) + 1;
  return NextResponse.json({
    sin_correo_directo: sinCorreo ?? 0,
    rastreados: filas?.length ?? 0,
    por_resultado: porResultado,
    ultimos: (filas ?? []).slice(0, 60),
  });
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { n?: number };
  const limite = Math.min(Math.max(1, Number(body.n ?? 10)), 25);
  const res = await rastrearContactos({ presupuestoMs: 50000, limite });
  return NextResponse.json({ ok: res.errores.length === 0, ...res });
}
