import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Filtro anti-bot mínimo: descarta user-agents evidentes de crawlers,
// monitores de uptime, previsualizadores de enlaces y clientes HTTP de
// scripts. No busca precisión perfecta, solo quitar el ruido obvio.
const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|monitor|pingdom|uptime|curl|wget|python-requests|headlesschrome|phantom|ahrefs|semrush|mj12bot|dotbot|petalbot|bytespider|censys|scan|go-http-client|node-fetch|axios|okhttp/i;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const landing = typeof body.landing === "string" ? body.landing.trim() : "";
  if (!landing) {
    return NextResponse.json({ error: "Falta landing." }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent") || "";
  if (!userAgent || BOT_UA.test(userAgent)) {
    return NextResponse.json({ ok: true, tracked: false });
  }

  await supabase.from("landing_visitas").insert({ landing, user_agent: userAgent });

  return NextResponse.json({ ok: true, tracked: true });
}
