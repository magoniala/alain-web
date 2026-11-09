// Recuerda qué librillo tiene quien entra sin cuenta (cookie, a palabra).
// Con cuenta, el librillo es el de la cuenta y esto no lo cambia.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { liburutxoaDa } from "@/lib/magia-catalogo";
import { COOKIE_LIBURUTXOA } from "@/lib/magia-plataforma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!liburutxoaDa(body.librillo)) return NextResponse.json({ error: "?" }, { status: 400 });
  (await cookies()).set(COOKIE_LIBURUTXOA, body.librillo, {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
  return NextResponse.json({ ok: true });
}
