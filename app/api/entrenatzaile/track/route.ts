import { createClient } from "@supabase/supabase-js";
import { getVarianteActual } from "@/lib/entrenatzaile-variantes";
import { BOT_UA } from "@/lib/landing-eventos";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

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

  // Guarda qué plantilla estaba activa en el momento de la visita, para
  // poder desglosar las estadísticas por variante más adelante.
  const variante = await getVarianteActual(landing);

  await supabase.from("landing_visitas").insert({ landing, user_agent: userAgent, variante });

  return NextResponse.json({ ok: true, tracked: true });
}
