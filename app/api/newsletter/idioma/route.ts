import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  const idioma = url.searchParams.get("idioma");

  if (!email || !["eu", "es"].includes(idioma ?? "")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  await supabase
    .from("newsletter_contactos")
    .update({ idioma })
    .eq("email", email);

  return NextResponse.redirect(
    new URL(`/newsletter/idioma?ok=1&idioma=${idioma}`, req.url)
  );
}
