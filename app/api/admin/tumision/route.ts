// Seguimiento y prueba de la secuencia tumisión (lib/tumision.ts).
//   GET  → modo, mails activos por idioma, cuántos hay dentro y el estado de
//          los emails de prueba (en mision_contactos y en newsletter_contactos).
//   POST { accion: "pasada" } → solo en modo «prueba»: manda YA el siguiente
//          mail a los emails de prueba, sin esperar a su hora. Así la prueba
//          acelerada de los 9 mails se hace en minutos.
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/admin-auth";
import { EMAILS_PRUEBA_TUMISION, modoTumision, pasadaTumision } from "@/lib/tumision";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const modo = await modoTumision();
  const { data: mails } = await supabase
    .from("secuencia_mails")
    .select("posicion, idioma, activo")
    .eq("secuencia", "tumision")
    .order("posicion", { ascending: true });
  const activos = {
    es: (mails ?? []).filter((m) => m.idioma === "es" && m.activo).map((m) => m.posicion),
    eu: (mails ?? []).filter((m) => m.idioma === "eu" && m.activo).map((m) => m.posicion),
  };
  const { count: dentro } = await supabase
    .from("mision_contactos")
    .select("email", { count: "exact", head: true })
    .not("tumision_pos", "is", null);
  const { data: contactos, error } = await supabase
    .from("mision_contactos")
    .select("email, idioma, canal, unsubscribed, tumision_pos, tumision_proximo, tumision_ultimo_envio, tumision_fin_at")
    .in("email", EMAILS_PRUEBA_TUMISION);
  const { data: newsletter } = await supabase
    .from("newsletter_contactos")
    .select("email, origen, unsubscribed, transicion_para, transicion_enviada_en, fecha_alta")
    .in("email", EMAILS_PRUEBA_TUMISION);

  return NextResponse.json({ modo, activos, dentro: dentro ?? 0, prueba: contactos ?? [], newsletter: newsletter ?? [], error: error?.message });
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body.accion !== "pasada") return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  if ((await modoTumision()) !== "prueba") {
    return NextResponse.json({ error: "La pasada forzada solo funciona con tumisión en modo «prueba»." }, { status: 409 });
  }
  return NextResponse.json(await pasadaTumision({ forzar: true }));
}
