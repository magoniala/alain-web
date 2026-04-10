import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);

const TIKTOK_URL = "https://www.tiktok.com/@proyecto_2026";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://alainzulaika.com";

export async function POST(req: Request) {
  const { conoce_gilipollas, cree_que_diran_su_nombre, respuesta_texto_libre, email, origen } = await req.json();

  if (!conoce_gilipollas || !cree_que_diran_su_nombre) {
    return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 });
  }

  const { error: dbError } = await supabase.from("arrogante_respuestas").insert({
    conoce_gilipollas,
    cree_que_diran_su_nombre,
    respuesta_texto_libre: respuesta_texto_libre || null,
    email: email?.trim() || null,
    origen: origen || "qr",
  });

  if (dbError) {
    return NextResponse.json({ error: "Error al guardar." }, { status: 500 });
  }

  // Auto-update stats
  const { data: current } = await supabase.from("arrogante_stats").select("*").eq("id", 1).single();
  const base = current ?? { personas_testadas: 0, conocen_gilipollas: 0, creen_que_diran_su_nombre: 0, tests_aceptados: 0 };
  const statsUpdate: Record<string, number> = {
    personas_testadas: (base.personas_testadas ?? 0) + 1,
    conocen_gilipollas: (base.conocen_gilipollas ?? 0) + (conoce_gilipollas === "si" ? 1 : 0),
    creen_que_diran_su_nombre: (base.creen_que_diran_su_nombre ?? 0) + ((cree_que_diran_su_nombre === "si" || cree_que_diran_su_nombre === "probablemente") ? 1 : 0),
  };
  if (current) {
    await supabase.from("arrogante_stats").update(statsUpdate).eq("id", 1);
  } else {
    await supabase.from("arrogante_stats").insert({ id: 1, ...statsUpdate, tests_aceptados: 0 });
  }

  if (email?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    await resend.emails.send({
      from: "Alain Zulaika <contacto@niala.es>",
      to: email.trim(),
      replyTo: "contacto@niala.es",
      subject: "Tu respuesta ya está dentro del experimento.",
      html: `
        <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:2.5rem 2rem;color:#1a1a1a;background:#ffffff;">
          <div style="font-size:1.05rem;line-height:2;color:#1a1a1a;">
            <p style="margin:0 0 1.4rem;">Gracias por participar.</p>
            <p style="margin:0 0 1.4rem;">Estamos recopilando respuestas y grabando interacciones en la calle durante estos días.</p>
            <p style="margin:0 0 1.4rem;">El documental final se publicará el 21 de abril.</p>
            <p style="margin:0 0 1.4rem;">Cuando esté listo, te lo enviaré por aquí.</p>
            <p style="margin:0 0 0.5rem;">Mientras tanto puedes ver algunas de las interacciones y el proceso que estamos grabando:</p>
            <p style="margin:0 0 1.4rem;"><a href="${TIKTOK_URL}" style="color:#DC2626;">${TIKTOK_URL}</a></p>
          </div>
          <div style="margin-top:2.5rem;padding-top:1.2rem;border-top:1px solid #eee;font-size:0.88rem;color:#999;">
            <p style="margin:0 0 0.5rem;">Alain Zulaika · <a href="mailto:contacto@niala.es" style="color:#999;">contacto@niala.es</a></p>
            <p style="margin:0;"><a href="${BASE_URL}/api/arrogante/baja?email=${encodeURIComponent(email.trim())}" style="color:#bbb;">Dejar de recibir estos emails</a></p>
          </div>
        </div>
      `,
    });
  }

  return NextResponse.json({ ok: true });
}
