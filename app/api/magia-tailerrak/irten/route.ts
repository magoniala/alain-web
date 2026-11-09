// Cierra la sesión de la plataforma en este dispositivo.
import { NextResponse } from "next/server";
import { saioaItxi } from "@/lib/magia-plataforma";

export async function POST() {
  await saioaItxi();
  return NextResponse.json({ ok: true });
}
