// Alta en la plataforma de magia: el adulto deja su email en la página de un
// librillo y desbloquea el extra (el vaso). Primera vez: entra al momento y
// queda la sesión abierta. Si el email ya tenía cuenta: se le manda un código
// (así nadie entra en la cuenta de otro, que más adelante tendrá compras).
//
// De momento NO se da de alta en la newsletter: falta la secuencia de talleres
// (ver newsletter_alta_at en sql/magia_plataforma.sql).

import { NextResponse } from "next/server";
import { ikusgaiak, katalogoa } from "@/lib/magia-edukiak";
import { db, emailGarbia, kodeaBidali, liburutxoAukeratua, ongiEtorriaBidali, saioaIreki } from "@/lib/magia-plataforma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = emailGarbia(body.email);
  if (!email) return NextResponse.json({ error: "Sartu posta elektroniko baliodun bat." }, { status: 400 });
  if (body.baimena !== true) return NextResponse.json({ error: "Markatu laukia jarraitzeko." }, { status: 400 });
  const k = await katalogoa();
  // El librillo solo se apunta en la cuenta si este navegador ya lo tiene
  // abierto (con su palabra mágica, si la tiene).
  const aukeratua = await liburutxoAukeratua(ikusgaiak(k).liburutxoak);
  const librillo = aukeratua && aukeratua === body.librillo ? aukeratua : null;

  const { data: badago } = await db().from("magia_usuarios").select("email").eq("email", email).maybeSingle();
  if (badago) {
    const r = await kodeaBidali(email);
    return NextResponse.json({ kodea: r });
  }

  const { error } = await db().from("magia_usuarios").insert({ email, librillo, canal: "librillo", idioma: "eu" });
  if (error) {
    // Dos envíos a la vez del mismo email: el segundo va por código.
    if (error.code === "23505") return NextResponse.json({ kodea: await kodeaBidali(email) });
    console.error("magia: error en el alta:", error.message);
    return NextResponse.json({ error: "Zerbait gaizki joan da. Saiatu berriro." }, { status: 500 });
  }
  // Queda apuntado qué se abrió con el email (todo lo «emaila» de ese momento).
  const opariak = k.edukiak.filter((e) => e.egoera === "emaila").map((e) => ({ email, contenido: e.slug, origen: "email" }));
  if (opariak.length) await db().from("magia_accesos").insert(opariak);
  await saioaIreki(email);

  const host = req.headers.get("host") || "alainzulaika.com";
  const base = `${host.includes("localhost") ? "http" : "https"}://${host}`;
  try {
    await ongiEtorriaBidali(email, base);
  } catch (err) {
    console.error("magia: no se ha podido enviar la bienvenida:", err);
  }
  return NextResponse.json({ ok: true });
}
