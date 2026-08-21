import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth as auth } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

// Reordena la cola B: recibe los ids en el orden deseado y les asigna
// orden_cola 1..n. Solo toca filas que sigan en la cola.
export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.some(id => typeof id !== "string")) {
    return NextResponse.json({ error: "Faltan ids." }, { status: 400 });
  }

  const results = await Promise.all(
    ids.map((id: string, i: number) =>
      supabase
        .from("newsletter_campanas")
        .update({ orden_cola: i + 1 })
        .eq("id", id)
        .eq("estado", "cola")
    )
  );

  if (results.some(r => r.error)) {
    return NextResponse.json({ error: "Error al reordenar." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
