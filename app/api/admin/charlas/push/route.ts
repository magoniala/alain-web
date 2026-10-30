import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";
import { enviarPush } from "@/lib/charlas-push";

// Suscripción push del panel instalado como app.
//   GET    → clave pública VAPID y nº de dispositivos suscritos
//   POST   { suscripcion, dispositivo }  → guarda (o actualiza) la suscripción de este dispositivo
//   DELETE { endpoint }                  → la quita
//   PUT    {}                            → manda una notificación de prueba a todos

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { count } = await supabaseCharlas().from("charlas_push_suscripciones").select("*", { count: "exact", head: true });
  return NextResponse.json({ clave_publica: process.env.VAPID_PUBLIC_KEY ?? null, dispositivos: count ?? 0 });
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { suscripcion?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; dispositivo?: string };
  const s = body.suscripcion;
  if (!s?.endpoint || !s.keys?.p256dh || !s.keys.auth) return NextResponse.json({ error: "Suscripción incompleta." }, { status: 400 });
  const { error } = await supabaseCharlas()
    .from("charlas_push_suscripciones")
    .upsert({ endpoint: s.endpoint, claves: { p256dh: s.keys.p256dh, auth: s.keys.auth }, dispositivo: (body.dispositivo ?? "").slice(0, 120), fallos: 0 }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (!body.endpoint) return NextResponse.json({ error: "Falta endpoint." }, { status: 400 });
  await supabaseCharlas().from("charlas_push_suscripciones").delete().eq("endpoint", body.endpoint);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const r = await enviarPush({ title: "Panel · prueba", body: "Si lees esto, las notificaciones funcionan.", tag: "prueba", renotify: true });
  return NextResponse.json(r);
}
