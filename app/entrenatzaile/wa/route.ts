import { createClient } from "@supabase/supabase-js";
import { limpiarUtm } from "@/lib/entrenatzaile-formularios";
import { BOT_UA, dispositivoDeUA, navegadorDeUA } from "@/lib/landing-eventos";
import { WA_EVENTO, WA_LANDING, enlaceWaDirecto } from "@/lib/entrenatzaile-wa";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Nada de cachear. Toda la gracia de que la redirección sea temporal es poder
// cambiar el número o el mensaje y que valga desde el siguiente clic; un 307
// sin cabeceras lo puede guardar un proxy intermedio —o el propio navegador
// interno de la app— durante toda la sesión.
export const dynamic = "force-dynamic";

// Gemelo de limpiarDetalle() en /api/entrenatzaile/eventos: un código corto,
// nunca texto libre. Está duplicado a propósito y no importado, para no tocar
// el endpoint del embudo de /espalda, que está parado.
function codigoCorto(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  return /^[a-zA-Z0-9_-]{1,40}$/.test(v) ? v : null;
}

// Un clic en el botón de WhatsApp. Es el único sitio donde ese dato existe:
// Meta no reporta los clics del botón de su pantalla final.
//
// El evento no está en EVENTOS_EMBUDO y no hace falta que lo esté: esa lista
// es la que filtra el endpoint público de eventos, y aquí se escribe desde el
// servidor con la service key.
async function registrarClic(req: Request): Promise<void> {
  const userAgent = req.headers.get("user-agent") || "";
  // Previsualizadores de enlaces y crawlers no son clics. BOT_UA ya incluye
  // facebookexternalhit y el de WhatsApp, que son justo los que inflarían el
  // contador cada vez que este enlace se pegue en un chat.
  if (!userAgent || BOT_UA.test(userAgent)) return;

  const url = new URL(req.url);

  // La sesión del embudo si viene (?s=), para coser el clic al recorrido de
  // esa persona. Desde la pantalla final de Meta no viene ninguna: se genera
  // aquí para cumplir el NOT NULL de la tabla, y entonces una fila es un
  // clic. Cuenta clics, no personas: quien abra /wa dos veces suma dos.
  const sesion = (url.searchParams.get("s") || "").trim().slice(0, 64) || `wa-${randomUUID()}`;

  const { error } = await supabase.from("espalda_eventos").insert({
    sesion,
    landing: WA_LANDING,
    evento: WA_EVENTO,
    // El identificador del lead si la pantalla de Meta lo pasa (?lead=), y
    // si no, la tirada (?tirada=). Saneado como código corto en los dos
    // casos: por aquí no entra texto.
    detalle: codigoCorto(url.searchParams.get("lead")) ?? codigoCorto(url.searchParams.get("tirada")),
    ...limpiarUtm({
      ...Object.fromEntries(url.searchParams),
      referrer: req.headers.get("referer") ?? undefined,
    }),
    dispositivo: dispositivoDeUA(userAgent),
    navegador: navegadorDeUA(userAgent),
  });

  if (error) console.error("wa: no se pudo registrar el clic:", error);
}

export async function GET(req: Request) {
  // El apunte va antes de redirigir, pero no puede impedirla: cualquier fallo
  // se registra y se salta igual. Nadie se queda sin WhatsApp porque la
  // medición tenga un mal día.
  try {
    await registrarClic(req);
  } catch (err) {
    console.error("wa: error inesperado registrando el clic:", err);
  }

  // 307 y no 301: temporal a propósito. Un permanente se queda cacheado en el
  // navegador y el día que cambie el número o el mensaje la gente seguiría
  // yendo al viejo, sin forma de invalidarlo.
  const res = NextResponse.redirect(enlaceWaDirecto(), 307);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
