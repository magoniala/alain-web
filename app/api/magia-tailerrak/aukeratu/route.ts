// Fija el librillo de quien visita (cookie). Si el librillo tiene palabra
// mágica, hay que escribirla bien; con cuenta, además, el librillo queda en la
// cuenta (magia_accesos «liburutxoa:<slug>», origen «giltza»), así una familia
// con dos librillos puede tener los dos.
import { NextResponse } from "next/server";
import { ikusgaiak, katalogoa } from "@/lib/magia-edukiak";
import { db, giltzaZuzena, liburutxoCookieaJarri, nireSaioa } from "@/lib/magia-plataforma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const l = ikusgaiak(await katalogoa()).liburutxoak.find((x) => x.slug === body.librillo);
  if (!l) return NextResponse.json({ error: "?" }, { status: 400 });
  if (!giltzaZuzena(l, body.giltza)) {
    // Un poco de espera para que no compense ir probando palabras.
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Hitz magiko hori ez da zuzena. Begiratu berriro zure liburutxoan." }, { status: 400 });
  }
  await liburutxoCookieaJarri(l);

  const saioa = l.giltza ? await nireSaioa() : null;
  if (saioa) {
    await db().from("magia_accesos").upsert({ email: saioa.email, contenido: `liburutxoa:${l.slug}`, origen: "giltza" }, { onConflict: "email,contenido", ignoreDuplicates: true });
    if (!saioa.librilloRaw) await db().from("magia_usuarios").update({ librillo: l.slug }).eq("email", saioa.email);
  }
  return NextResponse.json({ ok: true });
}
