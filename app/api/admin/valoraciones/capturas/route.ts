import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth as auth } from "@/lib/admin-auth";

// Fotos y vídeos de una valoración (presencial): se suben desde el móvil al
// bucket privado `valoraciones` y la hoja guarda la ruta en datos.capturas.
// Solo Alain los ve: las URL que salen de aquí están firmadas y caducan.
//
//   POST { id, test, ext, tipo }      → URL firmada para subir (PUT directo a Storage)
//   GET  ?rutas=a,b,c                 → URL firmadas de lectura (1 h)
//   DELETE ?ruta=...                  → borra el fichero

export const dynamic = "force-dynamic";

const BUCKET = "valoraciones";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (typeof b.id !== "string" || !UUID.test(b.id)) return NextResponse.json({ error: "id inválido." }, { status: 400 });
  const test = String(b.test ?? "general").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "general";
  const ext = String(b.ext ?? "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 5) || "jpg";
  const sello = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const ruta = `${b.id}/${test}_${sello}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const { data, error } = await sb().storage.from(BUCKET).createSignedUploadUrl(ruta);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ruta, url: data.signedUrl, token: data.token });
}

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const rutas = (new URL(req.url).searchParams.get("rutas") ?? "").split(",").map((r) => r.trim()).filter(Boolean).slice(0, 100);
  if (!rutas.length) return NextResponse.json({ urls: {} });
  const { data, error } = await sb().storage.from(BUCKET).createSignedUrls(rutas, 3600);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const urls: Record<string, string> = {};
  for (const x of data ?? []) if (x.path && x.signedUrl) urls[x.path] = x.signedUrl;
  return NextResponse.json({ urls }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const ruta = new URL(req.url).searchParams.get("ruta");
  if (!ruta || !UUID.test(ruta.split("/")[0] ?? "")) return NextResponse.json({ error: "ruta inválida." }, { status: 400 });
  const { error } = await sb().storage.from(BUCKET).remove([ruta]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
