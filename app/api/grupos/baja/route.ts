import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { firmaBaja } from "@/lib/grupos-envio";

// Baja de los envíos a grupos: «No quiero recibir más correos como este».
// Llega por POST desde el botón de /correos/baja (no por GET desde el mail:
// los antivirus de correo abren los enlaces y darían de baja a la gente sin
// que lo pidiera). Apunta el correo en grupos_bajas, que lo saca de TODOS
// los grupos. No toca la newsletter.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const f = await req.formData().catch(() => null);
  const email = String(f?.get("e") ?? "").trim().toLowerCase();
  const t = String(f?.get("t") ?? "");
  const h = f?.get("h") === "es" ? "es" : "eu";
  const clave = String(f?.get("m") ?? "").slice(0, 80) || null;
  const vuelta = new URL("/correos/baja", req.url);
  vuelta.searchParams.set("h", h);

  if (!email || t !== firmaBaja(email)) {
    vuelta.searchParams.set("error", "1");
    return NextResponse.redirect(vuelta, 303);
  }
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const { error } = await sb.from("grupos_bajas").upsert({ email, clave }, { onConflict: "email", ignoreDuplicates: true });
  if (error) {
    console.error(`grupos_bajas: no se ha podido apuntar ${email}:`, error.message);
    vuelta.searchParams.set("error", "1");
    return NextResponse.redirect(vuelta, 303);
  }
  vuelta.searchParams.set("hecho", "1");
  return NextResponse.redirect(vuelta, 303);
}
