// Alta en la plataforma de magia: el adulto deja su email en la página de un
// librillo y desbloquea el extra (el vaso). Primera vez: entra al momento y
// queda la sesión abierta. Si el email ya tenía cuenta: se le manda un código
// (así nadie entra en la cuenta de otro, que más adelante tendrá compras).
//
// No se da de alta en la newsletter directamente: entra en la secuencia
// tumisión (lib/tumision.ts), si está en marcha, con el mail 1 a las 19:15, y
// al terminarla pasa a la diaria (y se marca newsletter_alta_at). Con
// tumisión en «off», solo se guarda el email, como hasta ahora.
//
// Idioma: el que tenga elegido en la plataforma (cookie `lang`; sin cookie,
// euskera). Se guarda en magia_usuarios y decide el idioma de la bienvenida,
// del código y de tumisión (decisión de Alain, 27-nov).

import { NextResponse } from "next/server";
import { ikusgaiak, katalogoa } from "@/lib/magia-edukiak";
import { apuntarTumisionLibrillo } from "@/lib/tumision";
import { TESTUAK } from "@/lib/magia-hizkuntza";
import { db, emailGarbia, hizkuntza, kodeaBidali, liburutxoAukeratua, ongiEtorriaBidali, saioaIreki } from "@/lib/magia-plataforma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const h = await hizkuntza();
  const t = TESTUAK[h];
  const email = emailGarbia(body.email);
  if (!email) return NextResponse.json({ error: t.emailOkerra }, { status: 400 });
  if (body.baimena !== true) return NextResponse.json({ error: t.markatuLaukia }, { status: 400 });
  const k = await katalogoa();
  // El librillo solo se apunta en la cuenta si este navegador ya lo tiene
  // abierto (con su palabra mágica, si la tiene).
  const aukeratua = await liburutxoAukeratua(ikusgaiak(k).liburutxoak);
  const librillo = aukeratua && aukeratua === body.librillo ? aukeratua : null;

  const { data: badago } = await db().from("magia_usuarios").select("email").eq("email", email).maybeSingle();
  if (badago) {
    const r = await kodeaBidali(email, h);
    return NextResponse.json({ kodea: r });
  }

  const { error } = await db().from("magia_usuarios").insert({ email, librillo, canal: "librillo", idioma: h });
  if (error) {
    // Dos envíos a la vez del mismo email: el segundo va por código.
    if (error.code === "23505") return NextResponse.json({ kodea: await kodeaBidali(email, h) });
    console.error("magia: error en el alta:", error.message);
    return NextResponse.json({ error: t.gaizki }, { status: 500 });
  }
  // Queda apuntado qué se abrió con el email (todo lo «emaila» de ese momento).
  const opariak = k.edukiak.filter((e) => e.egoera === "emaila").map((e) => ({ email, contenido: e.slug, origen: "email" }));
  if (opariak.length) await db().from("magia_accesos").insert(opariak);
  await saioaIreki(email);

  const host = req.headers.get("host") || "alainzulaika.com";
  const base = `${host.includes("localhost") ? "http" : "https"}://${host}`;
  try {
    await ongiEtorriaBidali(email, base, h);
  } catch (err) {
    console.error("magia: no se ha podido enviar la bienvenida:", err);
  }
  try {
    const r = await apuntarTumisionLibrillo(email, h);
    if (r === "error") console.error("magia: no se ha podido apuntar en tumisión:", email);
  } catch (err) {
    console.error("magia: error apuntando en tumisión:", err);
  }
  return NextResponse.json({ ok: true });
}
