import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { promptPresupuesto } from "@/lib/crm-presupuesto-prompt";
import { apuntarSubida, datosEnvio, enviarPresupuesto, urlSubida } from "@/lib/crm-presupuesto-envio";

// Presupuesto desde el panel (tarjetas de magia que piden propuesta y ficha del CRM).
//
//   GET  ?ficha=<uuid>[&show=<clave>]   → prompt para el chat de presupuestos (lib/crm-presupuesto-prompt)
//   GET  ?ficha=<uuid>&envio=1          → para, asunto del hilo y PDFs ya subidos (con enlace de 1 h)
//   POST { accion: "subir", ficha, nombre }        → URL firmada para subir el PDF directo a Storage
//   POST { accion: "subido", ficha, ruta }         → apunta en el Registro que se ha subido
//   POST { accion: "enviar", ficha, ruta, para, asunto, texto } → mail con el PDF en el hilo; ficha a «5 Propuesta enviada»
//   (lib/crm-presupuesto-envio)

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const url = new URL(req.url);
  const ficha = url.searchParams.get("ficha");
  if (!ficha) return NextResponse.json({ error: "Falta la ficha." }, { status: 400 });
  try {
    if (url.searchParams.get("envio")) return NextResponse.json(await datosEnvio(ficha));
    return NextResponse.json(await promptPresupuesto(ficha, url.searchParams.get("show")));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  try {
    if (b.accion === "subir") return NextResponse.json(await urlSubida(b.ficha, b.nombre));
    if (b.accion === "subido") return NextResponse.json(await apuntarSubida(b.ficha, b.ruta));
    if (b.accion === "enviar") return NextResponse.json(await enviarPresupuesto(b));
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
