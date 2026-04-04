import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");

  if (!email) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Buscar IDs de emails programados
  const { data } = await supabase
    .from("mision_contactos")
    .select("mail2_id, mail3_id")
    .eq("email", email)
    .single();

  // Cancelar emails programados en Resend
  if (data?.mail2_id) {
    try { await resend.emails.cancel(data.mail2_id); } catch {}
  }
  if (data?.mail3_id) {
    try { await resend.emails.cancel(data.mail3_id); } catch {}
  }

  // Marcar como dado de baja
  await supabase
    .from("mision_contactos")
    .update({ unsubscribed: true })
    .eq("email", email);

  return NextResponse.redirect(new URL("/es/tumision/baja", req.url));
}
