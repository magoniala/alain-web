import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminAuth as auth } from "@/lib/admin-auth";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export const dynamic = "force-dynamic";

// Respuestas anónimas de /arreta para /admin → Arreta.
export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data, error } = await supabase
    .from("arreta_respuestas")
    .select("id, created_at, probatu, ikasi, gustatu, gehitu, saioa")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ respuestas: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
