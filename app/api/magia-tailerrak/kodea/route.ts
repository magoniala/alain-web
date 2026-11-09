// Pide un código de acceso para entrar en la plataforma desde otro dispositivo.
import { NextResponse } from "next/server";
import { db, emailGarbia, kodeaBidali } from "@/lib/magia-plataforma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = emailGarbia(body.email);
  if (!email) return NextResponse.json({ error: "Sartu posta elektroniko baliodun bat." }, { status: 400 });
  const { data: badago } = await db().from("magia_usuarios").select("email").eq("email", email).maybeSingle();
  if (!badago) return NextResponse.json({ ezDago: true });
  return NextResponse.json({ kodea: await kodeaBidali(email) });
}
