import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { aprenderMagia, aprobarPropuestaMagia, descartarPropuestaMagia, guardarReglasMagia, panelAprendizajeMagia } from "@/lib/crm-aprendizaje";

// Aprendizaje del carril MAGIA (la lógica está en lib/crm-aprendizaje.ts).
//
// GET  → propuestas, reglas vigentes, rachas por tipo, resultado de la última pasada
// POST { accion }
//   aprobar { id, texto? } · descartar { id } · aprender { dias? } · guardar_reglas { texto }

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json(await panelAprendizajeMagia());
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
        return NextResponse.json(await aprenderMagia({ dias: Number(body.dias ?? 14), forzar: true }));
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
