import { NextResponse } from "next/server";
import { VARIANTES, getVarianteActual, setVarianteActual, type Variante } from "@/lib/entrenatzaile-variantes";

function auth(req: Request) {
  return req.headers.get("x-stats-password") === process.env.STATS_PASSWORD;
}

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const url = new URL(req.url);
  const landing = url.searchParams.get("landing") || "guias";
  const variante = await getVarianteActual(landing);
  return NextResponse.json({ variante }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { landing, variante } = await req.json().catch(() => ({}));
  if (!landing || !(VARIANTES as readonly string[]).includes(variante)) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  await setVarianteActual(landing, variante as Variante);
  return NextResponse.json({ ok: true });
}
