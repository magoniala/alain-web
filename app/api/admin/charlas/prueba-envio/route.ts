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

  const { data: m, error } = await supabaseCharlas()
    .from("charlas_mensajes")
    .select("asunto, texto, fecha, centro_id")
    .eq("direccion", "saliente")
    .eq("tipo_salida", "mail_1")
    .not("texto", "is", null)
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!m) return NextResponse.json({ error: "No hay ningún Mail 1 enviado del que copiar." }, { status: 404 });

  try {
    const envio = await enviarCorreo({ para, asunto: m.asunto ?? "(sin asunto)", texto: m.texto });
    return NextResponse.json({ ok: true, enviado_a: envio.para, asunto: m.asunto, copia_de: m.fecha, smtp: envio.smtp });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
