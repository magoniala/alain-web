import { createClient } from "@supabase/supabase-js";
import { limpiarUtm } from "@/lib/entrenatzaile-formularios";
import {
  BOT_UA,
  dispositivoDeUA,
  esEventoEmbudo,
  navegadorDeUA,
} from "@/lib/landing-eventos";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Detalle de un evento. Solo se acepta un código corto —el status HTTP de
// un envío fallido, o "red" si ni llegó a salir—, nunca texto libre. Es la
// barrera que garantiza que por aquí no puede colarse una respuesta del
// formulario aunque alguien lo intente.
function limpiarDetalle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return /^[a-zA-Z0-9_-]{1,40}$/.test(v) ? v : null;
}

// Registro de un paso del embudo. Nunca devuelve error al navegador por
// nada que no sea culpa suya: el formulario no puede depender de esto, y
// el cliente lo llama sin esperar la respuesta.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const evento = body.evento;
  const sesion = typeof body.sesion === "string" ? body.sesion.trim().slice(0, 64) : "";
  const landing = typeof body.landing === "string" ? body.landing.trim().slice(0, 40) : "";

  if (!esEventoEmbudo(evento) || !sesion || !landing) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent") || "";
  if (!userAgent || BOT_UA.test(userAgent)) {
    return NextResponse.json({ ok: true, tracked: false });
  }

  const { error } = await supabase.from("espalda_eventos").insert({
    sesion,
    landing,
    evento,
    detalle: evento === "submit_error" ? limpiarDetalle(body.detalle) : null,
    ...limpiarUtm(body.utm),
    dispositivo: dispositivoDeUA(userAgent),
    navegador: navegadorDeUA(userAgent),
  });

  if (error) {
    console.error("espalda_eventos insert error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tracked: true });
}
