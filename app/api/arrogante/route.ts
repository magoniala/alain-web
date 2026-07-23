import { createClient } from "@supabase/supabase-js";
import { sendEmail, ALAIN_FROM } from "@/lib/email-ses";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const TIKTOK_URL = "https://www.tiktok.com/@proyecto_2026";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://alainzulaika.com";

const CUANTOS_VALOR: Record<string, number> = {
  "1-5": 3,
  "5-50": 28,
  "50-100": 75,
  "100-1000": 550,
  "1000-10000": 5500,
  "1000000": 1000000,
  "mas-1000000": 2000000,
};

export async function POST(req: Request) {
  const { cuantos_gilipollas, cree_que_diran_su_nombre, respuesta_texto_libre, email, origen } = await req.json();

  if (!cuantos_gilipollas || !cree_que_diran_su_nombre) {
    return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 });
  }

  const { error: dbError } = await supabase.from("arrogante_respuestas").insert({
    cuantos_gilipollas,
    cree_que_diran_su_nombre,
    respuesta_texto_libre: respuesta_texto_libre || null,
    email: email?.trim() || null,
    origen: origen || "qr",
  });

  if (dbError) {
    return NextResponse.json({ error: "Error al guardar." }, { status: 500 });
  }

  const { data: current } = await supabase.from("arrogante_stats").select("*").eq("id", 1).single();
  const base = current ?? { personas_testadas: 0, creen_que_diran_su_nombre: 0, suma_gilipollas: 0, media_gilipollas: null };

  const creeDirian = cree_que_diran_su_nombre === "si" || cree_que_diran_su_nombre === "probablemente-si";
  const valorCuantos = CUANTOS_VALOR[cuantos_gilipollas] ?? 0;
  const personasActuales = base.personas_testadas ?? 0;
  const nuevaPersonas = personasActuales + 1;

  const sumaActual = (base.suma_gilipollas && base.suma_gilipollas > 0)
    ? base.suma_gilipollas
    : (base.media_gilipollas && personasActuales > 0 ? base.media_gilipollas * personasActuales : 0);

  const nuevaSuma = sumaActual + valorCuantos;

  const statsUpdate: Record<string, number> = {
    personas_testadas: nuevaPersonas,
    creen_que_diran_su_nombre: (base.creen_que_diran_su_nombre ?? 0) + (creeDirian ? 1 : 0),
    suma_gilipollas: nuevaSuma,
    media_gilipollas: Math.round((nuevaSuma / nuevaPersonas) * 10) / 10,
  };

  if (current) {
    await supabase.from("arrogante_stats").update(statsUpdate).eq("id", 1);
  } else {
    await supabase.from("arrogante_stats").insert({ id: 1, ...statsUpdate });
  }

  if (email?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    await supabase.from("newsletter_contactos")
      .upsert({ email: email.trim(), origen: "arrogante" }, { onConflict: "email", ignoreDuplicates: true });
    await sendEmail(
      email.trim(),
      "Tu respuesta ya está dentro del experimento.",
      `
        <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
          <div style="font-size:1.05rem;line-height:2;color:#1a1a1a;">
            <p style="margin:0 0 1.4rem;">Gracias por participar.</p>
            <p style="margin:0 0 1.4rem;">Puedes ver el documental <a href="https://www.youtube.com/watch?v=79SYLUnoHmA" style="color:#DC2626;">aquí</a>.</p>
            <p style="margin:0 0 1.4rem;">Ahora estamos publicando las interacciones reales (sin tanto corte) grabadas en la calle.</p>
            <p style="margin:0 0 1.4rem;">Si quieres seguir el proceso, puedes hacerlo en <a href="${TIKTOK_URL}" style="color:#DC2626;">TikTok</a>.</p>
          </div>
          <div style="margin-top:2.5rem;padding-top:1.2rem;border-top:1px solid #eee;font-size:0.88rem;color:#999;">
            <p style="margin:0 0 0.5rem;">Alain Zulaika · <a href="mailto:contacto@alainzulaika.com" style="color:#999;">contacto@alainzulaika.com</a></p>
            <p style="margin:0;"><a href="${BASE_URL}/api/arrogante/baja?email=${encodeURIComponent(email.trim())}" style="color:#bbb;">Dejar de recibir estos emails</a></p>
          </div>
        </div>
      `,
      ALAIN_FROM
    );
  }

  return NextResponse.json({ ok: true });
}
