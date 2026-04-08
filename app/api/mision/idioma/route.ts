import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  const idioma = url.searchParams.get("idioma");

  if (!email || !idioma) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  await supabase
    .from("mision_contactos")
    .update({ idioma })
    .eq("email", email);

  const dest = idioma === "es" ? "/es/tumision/castellano" : "/es/tumision/euskera";
  return NextResponse.redirect(new URL(dest, req.url));
}
