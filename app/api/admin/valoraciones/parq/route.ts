import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth as auth } from "@/lib/admin-auth";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export const dynamic = "force-dynamic";

// Los PAR-Q+ recibidos, para vincular uno a la valoración desde /admin.
export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await supabase
    .from("parq_respuestas")
    .select("id, nombre, email, telefono, resultado, respuestas, enviado_en")
    .order("enviado_en", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ parq: data }, { headers: { "Cache-Control": "no-store" } });
}
