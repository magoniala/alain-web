import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { guardarRegla, panelRemitentes, quitarRegla } from "@/lib/correo-general";

// Bandeja general de correo · F0 (la lógica está en lib/correo-general.ts).
//
// GET                    → volumen de 30 días por remitente, reparto por categoría, reglas, histórico
// POST { accion }
//   regla  { patron, tratamiento, categoria?, nota? }  (crea o confirma una regla; reclasifica lo ya apuntado)
//   quitar { patron }                                   (borra la regla o descarta la sugerencia)

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const dias = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("dias") ?? 30) || 30));
  return NextResponse.json(await panelRemitentes(dias), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if (b.accion === "regla") return NextResponse.json(await guardarRegla(b as Parameters<typeof guardarRegla>[0]));
    if (b.accion === "quitar") return NextResponse.json(await quitarRegla(b.patron));
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
