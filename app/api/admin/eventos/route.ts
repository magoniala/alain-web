import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { crearEvento, editarEvento, listarEventos, marcarPaso, sugerirEvento, type DatosNuevoEvento } from "@/lib/eventos";

// Pestaña «Eventos» del panel (23-11-2026).
//
//   GET  /api/admin/eventos                                  → eventos (60 días atrás en adelante) con sus pasos, post-evento y fichas ganadas sin evento
//   POST { accion: "paso", id, estado }                      → hecho | no_aplica | pendiente
//   POST { accion: "editar", id, fecha_evento?, estado_evento? }
//   POST { accion: "crear", ...DatosNuevoEvento }            → crea el evento y su checklist (el espejo escribe la nota del vault)
//   POST { accion: "sugerir", ficha_id }                     → rellena el formulario con lo del Registro (IA)

export async function GET(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    return NextResponse.json(await listarEventos());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    switch (body.accion) {
      case "paso": {
        const estado = String(body.estado);
        if (!["hecho", "no_aplica", "pendiente"].includes(estado)) throw new Error("Estado no válido.");
        return NextResponse.json(await marcarPaso(String(body.id), estado as "hecho" | "no_aplica" | "pendiente"));
      }
      case "editar":
        return NextResponse.json(await editarEvento(String(body.id), { fecha_evento: body.fecha_evento ? String(body.fecha_evento) : undefined, estado_evento: body.estado_evento ? String(body.estado_evento) : undefined }));
      case "crear":
        return NextResponse.json({ ok: true, evento: await crearEvento(body as unknown as DatosNuevoEvento) });
      case "sugerir":
        return NextResponse.json({ ok: true, datos: await sugerirEvento(String(body.ficha_id)) });
      default:
        return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
