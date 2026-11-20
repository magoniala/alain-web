import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { configAutoenvio, marcarManual } from "@/lib/autoenvio";

// Envío automático por racha en charlas (centros) y magia (lib/autoenvio.ts).
// GET  → { activo, manuales: ["charlas:<tipo>", "magia:<tipo>"], modo_prueba }
// POST { carril: "charlas" | "magia", tipo, manual: boolean }  → deja un tipo en manual o le deja volver a automático

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const c = await configAutoenvio();
  return NextResponse.json({ activo: c.activo, manuales: c.manuales, modo_prueba: c.modoPrueba, tope_dia: c.topeDia });
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const carril = body.carril === "magia" ? "magia" : body.carril === "charlas" ? "charlas" : null;
  const tipo = String(body.tipo ?? "").trim();
  if (!carril || !tipo) return NextResponse.json({ error: "Faltan carril o tipo." }, { status: 400 });
  await marcarManual(carril, tipo, body.manual === true);
  return NextResponse.json({ ok: true });
}
