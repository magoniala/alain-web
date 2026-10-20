import { NextResponse } from "next/server";
import { getPlazasLibres, PLAZAS_OPCIONES, setPlazasLibres } from "@/lib/acompanamiento-config";
import { requireAdminAuth as auth } from "@/lib/admin-auth";

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const plazasLibres = await getPlazasLibres();
  return NextResponse.json({ plazasLibres }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!(PLAZAS_OPCIONES as readonly number[]).includes(body.plazasLibres)) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  try {
    await setPlazasLibres(body.plazasLibres);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
