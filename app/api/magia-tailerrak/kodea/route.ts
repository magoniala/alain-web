// Pide un código de acceso para entrar en la plataforma desde otro dispositivo.
import { NextResponse } from "next/server";
import { TESTUAK } from "@/lib/magia-hizkuntza";
import { db, emailGarbia, hizkuntza, kodeaBidali } from "@/lib/magia-plataforma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const h = await hizkuntza();
  const email = emailGarbia(body.email);
  if (!email) return NextResponse.json({ error: TESTUAK[h].emailOkerra }, { status: 400 });
  const { data: badago } = await db().from("magia_usuarios").select("email").eq("email", email).maybeSingle();
  if (!badago) return NextResponse.json({ ezDago: true });
  return NextResponse.json({ kodea: await kodeaBidali(email, h) });
}
