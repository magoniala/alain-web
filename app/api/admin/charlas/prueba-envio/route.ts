import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { supabaseCharlas } from "@/lib/charlas";
import { enviarCorreo } from "@/lib/charlas-correo";

// POST /api/admin/charlas/prueba-envio { para } → reenvía el último Mail 1
// real (mismo asunto y texto) por el mismo camino que el panel
// (`enviarCorreo`: SMTP de Arsys desde alain@), a una dirección de prueba.
// Para tests de entregabilidad (mail-tester). No toca fichas, mensajes ni
// tareas. Solo admite mail-tester.com o alainzulaika.com, para que nunca
// pueda salir a un centro.

const PERMITIDO = /@([a-z0-9-]+\.)*(mail-tester\.com|alainzulaika\.com)$/i;

export async function POST(req: Request) {
  if (!requireAdminAuth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { para?: string };
  const para = String(body.para ?? "").trim();
  if (!PERMITIDO.test(para)) return NextResponse.json({ error: "Solo direcciones de mail-tester.com o de alainzulaika.com." }, { status: 400 });

  // El tipo «mail_1» es de la tarea; el mensaje enviado guarda su tarea_id.
  const supabase = supabaseCharlas();
  const { data: tareas, error: errT } = await supabase
    .from("charlas_tareas")
    .select("id")
    .eq("tipo", "mail_1")
    .order("creado_en", { ascending: false })
    .limit(200);
  if (errT) return NextResponse.json({ error: errT.message }, { status: 500 });
  const ids = (tareas ?? []).map((t) => t.id as string);
  if (!ids.length) return NextResponse.json({ error: "No hay tareas de Mail 1." }, { status: 404 });
  const { data: m, error } = await supabase
    .from("charlas_mensajes")
    .select("asunto, texto, fecha, adjuntos")
    .eq("direccion", "saliente")
    .in("tarea_id", ids)
    .not("texto", "is", null)
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!m) return NextResponse.json({ error: "No hay ningún Mail 1 enviado del que copiar." }, { status: 404 });
  const adj = JSON.stringify(m.adjuntos ?? []);
  const dossier = /dossier_eu/.test(adj) ? "eu" : /dossier_es/.test(adj) ? "es" : null;

  try {
    const envio = await enviarCorreo({ para, asunto: m.asunto ?? "(sin asunto)", texto: m.texto, dossier });
    return NextResponse.json({ ok: true, enviado_a: envio.para, asunto: m.asunto, copia_de: m.fecha, dossier, smtp: envio.smtp });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
