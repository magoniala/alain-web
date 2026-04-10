import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");

  if (!email) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  await supabase
    .from("arrogante_respuestas")
    .update({ unsubscribed: true })
    .eq("email", email);

  return NextResponse.redirect(new URL("/arrogante/baja", req.url));
}
