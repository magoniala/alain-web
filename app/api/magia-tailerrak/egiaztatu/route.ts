// Comprueba el código del email y abre la sesión.
import { NextResponse } from "next/server";
import { katalogoa } from "@/lib/magia-edukiak";
import { db, emailGarbia, kodeaEgiaztatu, saioaIreki } from "@/lib/magia-plataforma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = emailGarbia(body.email);
  const kodea = typeof body.kodea === "string" ? body.kodea.replace(/\s/g, "") : "";
  if (!email || !(await kodeaEgiaztatu(email, kodea))) {
    return NextResponse.json({ error: "Kode hori ez da zuzena edo iraungi da." }, { status: 400 });
  }
  const { data: u } = await db().from("magia_usuarios").select("librillo").eq("email", email).maybeSingle();
  const l = (await katalogoa()).liburutxoak.find((x) => x.slug === u?.librillo) ?? null;
  await saioaIreki(email, l);
  return NextResponse.json({ ok: true, librillo: u?.librillo ?? null });
}
